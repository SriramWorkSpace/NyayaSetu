use std::process::Child;
use std::sync::Mutex;
use tauri::Manager;

/// Holds the bundled backend's child process handle so it can be killed on
/// exit - `Mutex<Option<Child>>` rather than `Option<Child>` bare because
/// Tauri's managed state must be `Send + Sync`, and so it can be cleanly
/// `.take()`n exactly once even if both the window-close and process-exit
/// paths fire.
struct BackendProcess(Mutex<Option<Child>>);

/// Spawns the PyInstaller-bundled backend (decisions.md D-037: a real
/// one-click installer, not the manual two-terminal workflow D-020/D-032
/// used through Phase 11) - only in a release build. `tauri dev` still
/// expects a manually-run `uvicorn` in a second terminal: `resource_dir()`
/// only resolves to a real bundle location in a packaged install, and the
/// whole point of the manual workflow during development is iterating on
/// the backend's own source directly, not a frozen copy of it.
fn spawn_backend(app: &tauri::AppHandle) {
    let resource_dir = match app.path().resource_dir() {
        Ok(p) => p,
        Err(e) => {
            log::error!("Could not resolve resource dir for the bundled backend: {e}");
            return;
        }
    };
    // Verified against a real `msiexec /a` extraction, not assumed: Tauri's
    // "backend-dist/" resource glob installs this one level shallower than
    // the source tree (app/src-tauri/backend-dist/nyayasetu_backend/...) -
    // the installed layout is backend-dist/nyayasetu_backend.exe directly,
    // not backend-dist/nyayasetu_backend/nyayasetu_backend.exe.
    let exe = resource_dir
        .join("backend-dist")
        .join("nyayasetu_backend.exe");

    if !exe.exists() {
        log::error!("Bundled backend not found at {}", exe.display());
        return;
    }

    match std::process::Command::new(&exe).spawn() {
        Ok(child) => {
            log::info!("Bundled backend started (pid {})", child.id());
            app.manage(BackendProcess(Mutex::new(Some(child))));
        }
        Err(e) => log::error!("Failed to start bundled backend: {e}"),
    }
}

fn kill_backend(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<BackendProcess>() {
        if let Some(mut child) = state.0.lock().unwrap().take() {
            let _ = child.kill();
            log::info!("Bundled backend stopped");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Rust-mediated HTTP so the frontend's plugin-http fetch bypasses browser
    // CORS entirely (ARCHITECTURE.md section 5.3) - the browser never makes
    // the cross-origin request to localhost:8000, Rust does.
    .plugin(tauri_plugin_http::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      } else {
        spawn_backend(&app.handle());
      }
      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        kill_backend(window.app_handle());
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
