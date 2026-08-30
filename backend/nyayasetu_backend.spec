# PyInstaller spec for the sidecar Tauri bundles and launches automatically
# (decisions.md D-037: PyInstaller sidecar, superseding D-020/D-032's manual
# two-terminal workflow for a genuinely one-click installer).
#
# --onedir, not --onefile: onefile self-extracts its entire payload to a
# temp directory on every single launch, which is slow and fragile for a
# bundle this size (torch/transformers/faiss). onedir extracts once, at
# build time, and starts fast every run after that.
#
# Data bundling mirrors the repo's own relative layout (backend/artifacts,
# backend/vendor, ml/reports) so app/base_dir.py's frozen-path resolution
# needs no bundle-specific special-casing - repo_root()/backend_dir() point
# at the right place either way.
import os

from PyInstaller.utils.hooks import collect_all

datas = [
    ('artifacts', 'backend/artifacts'),
    ('vendor/tesseract', 'backend/vendor/tesseract'),
    ('../ml/reports', 'ml/reports'),
]
binaries = []
hiddenimports = [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'sklearn.utils._typedefs',
    'sklearn.utils._heap',
    'sklearn.utils._sorting',
    'sklearn.utils._vector_sentinel',
    'sklearn.neighbors._partition_nodes',
]

# collect_all pulls in each package's own data files (tokenizer configs,
# etc.) and hidden submodules its hook knows about - torch, transformers,
# spacy, and sentence_transformers all have real non-code assets bundled
# inside the package itself, separate from this project's own model
# checkpoints in backend/artifacts/.
for pkg in ['torch', 'transformers', 'spacy', 'sentence_transformers', 'sklearn', 'xgboost']:
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

a = Analysis(
    ['run_server.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib'],
    noarchive=False,
    optimize=0,
)

# Two real, installer-breaking MAX_PATH problems, found by decoding an
# actual msiexec verbose log against a real build (not assumed from
# collect_all()'s own returned data - PyInstaller bundles a package's
# .dist-info separately from what collect_all() reports, so filtering
# collect_all()'s output before Analysis() ran never touched these; this
# has to run on a.datas, after Analysis has already pulled everything in):
#
# 1. torch/include/** - C++ headers for building custom torch extensions,
#    irrelevant to a pure-Python inference process (~63MB / 9,375 files,
#    measured). Some filenames
#    (_upsample_nearest_exact1d_backward_compositeexplicitautogradnon
#    functional_dispatch.h) are long enough on their own that nesting them
#    under a real install path exceeds Windows' MAX_PATH limit - the actual
#    cause of WiX Error 1304 ("Error writing to file") during a real MSI
#    build, not the permissions error a first, separate silent-install
#    attempt had shown.
# 2. torch's own dist-info bundles third-party dependencies' LICENSE files
#    nested under paths like torch-2.13.0.dist-info/licenses/third_party/
#    kineto/.../prometheus-cpp/3rdparty/civetweb/.../duktape-1.8.0/
#    LICENSE.txt - ~180 chars on its own, same overflow. Checked directly
#    that torch's dist-info has no separate top-level LICENSE file outside
#    this nested tree, so excluding it is a real, disclosed loss of bundled
#    third-party attribution text, not something quietly assumed to still
#    be covered elsewhere - torch's own license terms are still stated in
#    its (un-excluded) METADATA file.
a.datas = [
    d for d in a.datas
    if 'torch' + os.sep + 'include' not in d[0]
    and ('dist-info' + os.sep + 'licenses') not in d[0]
]

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='nyayasetu_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='nyayasetu_backend',
)
