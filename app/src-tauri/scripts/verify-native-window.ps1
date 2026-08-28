# Captures the ACTUAL content of a running Tauri window, by process id,
# using PrintWindow(PW_RENDERFULLCONTENT) rather than a desktop screen
# capture. Playwright cannot see into a native window - it only drives
# browser contexts - so this is how the Phase 5 gate is actually checked:
# "confirm a round trip to /health renders in the actual native window, not
# just the browser dev server" (plan.md Phase 5).
#
# A plain desktop screenshot (BitBlt/CopyFromScreen) is NOT reliable here:
# whatever window happens to be topmost at that screen region wins, and
# SetForegroundWindow is silently refused by Windows for a process that
# didn't just receive user input - so the "on top" window can visually stay
# beneath something else even after the call reports success. PrintWindow
# reads directly from the target window's own surface, which sidesteps all
# of that.
#
# Usage:
#   powershell -File verify-native-window.ps1 -ProcessId <pid> -OutPath out.png
#   powershell -File verify-native-window.ps1 -ProcessId <pid> -OutPath out.png -ClickX 965 -ClickY 730
#
# Find the pid first: tasklist /FI "IMAGENAME eq app.exe"  (debug builds;
# the release binary is named after productName instead).
param(
    [Parameter(Mandatory = $true)][int]$ProcessId,
    [Parameter(Mandatory = $true)][string]$OutPath,
    [int]$ClickX = -1,
    [int]$ClickY = -1
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class NyayaSetuWin32 {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
Add-Type -AssemblyName System.Drawing

function Find-WindowByPid([int]$pid) {
    $result = [IntPtr]::Zero
    $cb = {
        param($hWnd, $lParam)
        if ([NyayaSetuWin32]::IsWindowVisible($hWnd)) {
            $owner = 0
            [NyayaSetuWin32]::GetWindowThreadProcessId($hWnd, [ref]$owner) | Out-Null
            if ($owner -eq $pid) {
                $sb = New-Object System.Text.StringBuilder 256
                [NyayaSetuWin32]::GetWindowText($hWnd, $sb, 256) | Out-Null
                if ($sb.ToString().Length -gt 0) { $script:result = $hWnd; return $false }
            }
        }
        return $true
    }
    [NyayaSetuWin32]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
    return $result
}

$hwnd = Find-WindowByPid $ProcessId
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "NOT_FOUND: no visible window owned by pid $ProcessId"
    exit 1
}

# Force above whatever else is on screen. HWND_TOPMOST bypasses the
# foreground-focus-stealing restriction that SetForegroundWindow is subject
# to for a background automation process.
$HWND_TOPMOST = New-Object IntPtr(-1)
[NyayaSetuWin32]::SetWindowPos($hwnd, $HWND_TOPMOST, 0, 0, 0, 0, 0x0001 -bor 0x0002) | Out-Null
Start-Sleep -Milliseconds 300

$rect = New-Object NyayaSetuWin32+RECT
[NyayaSetuWin32]::GetWindowRect($hwnd, [ref]$rect) | Out-Null

if ($ClickX -ge 0 -and $ClickY -ge 0) {
    [NyayaSetuWin32]::SetCursorPos($rect.Left + $ClickX, $rect.Top + $ClickY) | Out-Null
    Start-Sleep -Milliseconds 150
    [NyayaSetuWin32]::mouse_event(0x0002, 0, 0, 0, 0) | Out-Null  # MOUSEEVENTF_LEFTDOWN
    Start-Sleep -Milliseconds 80
    [NyayaSetuWin32]::mouse_event(0x0004, 0, 0, 0, 0) | Out-Null  # MOUSEEVENTF_LEFTUP
    Start-Sleep -Milliseconds 1000
}

$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
# PW_RENDERFULLCONTENT (2): required for DirectComposition-backed content
# (WebView2 included) - plain PrintWindow(0) yields a blank/stale frame.
[NyayaSetuWin32]::PrintWindow($hwnd, $hdc, 2) | Out-Null
$g.ReleaseHdc($hdc)
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

# Good citizen: don't leave the window stuck topmost.
$HWND_NOTOPMOST = New-Object IntPtr(-2)
[NyayaSetuWin32]::SetWindowPos($hwnd, $HWND_NOTOPMOST, 0, 0, 0, 0, 0x0001 -bor 0x0002) | Out-Null

Write-Output "OK: ${width}x${height} -> $OutPath"
