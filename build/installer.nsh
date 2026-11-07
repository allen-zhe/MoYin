; MoPrint installer environment bootstrap.
; Electron bundles Chromium/Node, so there is no WebView2/.NET prerequisite.
; Create the per-user data directory and try to ensure the Windows print
; spooler is running. This is best-effort and never blocks the installer.

!macro customInstall
  CreateDirectory "$APPDATA\moprint"
  CreateDirectory "$APPDATA\moprint\received"

  ; NSIS is a 32-bit process. On 64-bit Windows, System32 is redirected to
  ; SysWOW64; use Sysnative when probing the 64-bit spooler binary.
  IfFileExists "$WINDIR\Sysnative\spoolsv.exe" 0 spooler_check_32
    nsExec::ExecToLog 'net start Spooler'
    Goto spooler_done
  spooler_check_32:
  IfFileExists "$WINDIR\System32\spoolsv.exe" 0 spooler_done
    nsExec::ExecToLog 'net start Spooler'
  spooler_done:
!macroend

!macro customUnInstall
  ; Keep user data on uninstall; the user can remove %APPDATA%\moprint manually.
!macroend
