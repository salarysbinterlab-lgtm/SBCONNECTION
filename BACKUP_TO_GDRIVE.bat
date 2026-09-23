@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  SB Connect - backup the project to Google Drive
REM
REM  ASCII only on purpose. Thai characters break cmd.exe batch
REM  parsing. The Thai guide lives in docs\33_BACKUP_GDRIVE.md
REM  and is copied next to the backup as RESTORE_GUIDE.md .
REM
REM  How it works
REM    The project folder in Drive is OVERWRITTEN every run so it
REM    always matches this machine. No version history is kept for
REM    the project, because .git is part of the backup and already
REM    holds the code history.
REM
REM    sql\ and .env are NOT in git. If they ever break and get
REM    overwritten there would be nothing to go back to, so a small
REM    dated zip of just those two is kept ( a few hundred KB ).
REM
REM  Usage
REM    BACKUP_TO_GDRIVE.bat           overwrite the mirror + small zip
REM    BACKUP_TO_GDRIVE.bat /check    dry run, writes nothing
REM    BACKUP_TO_GDRIVE.bat /full     also write a full project zip
REM    BACKUP_TO_GDRIVE.bat /nosnap   mirror only, no zip at all
REM    BACKUP_TO_GDRIVE.bat /yes      skip the first-run countdown
REM
REM  Destination is found automatically. To force it, set SB_GDRIVE
REM  or put the full path on line 1 of backup_target.txt .
REM ============================================================

cd /d "%~dp0"

set "KEEP=30"
set "EXITCODE=0"
set "DRYRUN="
set "FULLZIP="
set "NOSNAP="
set "ASSUMEYES="

:parseargs
if "%~1"=="" goto :parsed
if /i "%~1"=="/check"  set "DRYRUN=1"
if /i "%~1"=="/full"   set "FULLZIP=1"
if /i "%~1"=="/nosnap" set "NOSNAP=1"
if /i "%~1"=="/nozip"  set "NOSNAP=1"
if /i "%~1"=="/yes"    set "ASSUMEYES=1"
if /i "%~1"=="/adopt"  set "ASSUMEYES=1"
shift
goto :parseargs
:parsed

set "PROJECT=%~dp0"
if "%PROJECT:~-1%"=="\" set "PROJECT=%PROJECT:~0,-1%"
for %%I in ("%PROJECT%") do set "PROJNAME=%%~nxI"

echo.
echo ============================================================
echo  SB Connect - Backup to Google Drive
echo ============================================================
echo.
echo  Source : %PROJECT%

REM ---------- timestamp ----------
set "STAMP="
for /f "delims=" %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "STAMP=%%I"
if not defined STAMP (
  echo.
  echo  STOP. Could not read the date from PowerShell.
  goto :fail
)

REM ---------- find the Drive folder ----------
set "ROOT="
if defined SB_GDRIVE if exist "%SB_GDRIVE%" set "ROOT=%SB_GDRIVE%"

if not defined ROOT if exist "backup_target.txt" (
  for /f "usebackq delims=" %%L in ("backup_target.txt") do (
    if not defined ROOT if exist "%%L" set "ROOT=%%L"
  )
)
if not defined ROOT if exist "%USERPROFILE%\My Drive" set "ROOT=%USERPROFILE%\My Drive"
if not defined ROOT (
  for %%D in (G H I J K L M N O P Q R S T U V W X Y Z) do (
    if not defined ROOT if exist "%%D:\My Drive" set "ROOT=%%D:\My Drive"
  )
)
if not defined ROOT if exist "%USERPROFILE%\Google Drive" set "ROOT=%USERPROFILE%\Google Drive"

if not defined ROOT (
  echo.
  echo  STOP. Google Drive folder not found.
  echo.
  echo  Looked for:
  echo    the SB_GDRIVE environment variable
  echo    backup_target.txt   ^(full path on line 1^)
  echo    %USERPROFILE%\My Drive
  echo    G:\My Drive ... Z:\My Drive
  echo    %USERPROFILE%\Google Drive
  echo.
  echo  Fix: install Google Drive for desktop and sign in, OR create
  echo       backup_target.txt with the folder path inside it.
  goto :fail
)

REM  The project already has a home in Drive under SBconnection, use it.
if exist "%ROOT%\SBconnection" set "ROOT=%ROOT%\SBconnection"
if exist "%ROOT%\SBConnection" set "ROOT=%ROOT%\SBConnection"

set "MIRROR=%ROOT%\%PROJNAME%"
set "SNAPDIR=%ROOT%\_backup_snapshots"
set "LOGDIR=%ROOT%\_backup_logs"
set "MARKER=%MIRROR%\.sbconnect_backup"

echo  Target : %MIRROR%
echo  Stamp  : %STAMP%
if defined DRYRUN echo  Mode   : DRY RUN, nothing will be written
echo.

REM ---------- first run into a folder that already has files ----------
REM  The mirror deletes anything in the destination that is not in the
REM  project. That is intended, but on the very first run we say how many
REM  files that is and give a short window to abort.
if not defined DRYRUN if exist "%MIRROR%" if not exist "%MARKER%" (
  set "HASFILES=0"
  for /f %%N in ('dir /a-d /b /s "%MIRROR%" 2^>nul ^| find /c /v ""') do set "HASFILES=%%N"
  if not "!HASFILES!"=="0" (
    echo  ------------------------------------------------------------
    echo   First run into a folder that already has !HASFILES! file^(s^).
    echo   Files there that are not part of the project WILL BE DELETED
    echo   so the copy matches this machine exactly.
    echo  ------------------------------------------------------------
    if not defined ASSUMEYES (
      echo   Press Ctrl+C now to stop, or wait 10 seconds to continue.
      ping -n 11 127.0.0.1 >nul 2>nul
    )
    echo.
  )
)

if not defined DRYRUN (
  if not exist "%MIRROR%"  mkdir "%MIRROR%"  >nul 2>nul
  if not exist "%SNAPDIR%" mkdir "%SNAPDIR%" >nul 2>nul
  if not exist "%LOGDIR%"  mkdir "%LOGDIR%"  >nul 2>nul
  if not exist "%MIRROR%" (
    echo  STOP. Cannot create "%MIRROR%".
    echo        Check that Google Drive is running and the disk is not full.
    goto :fail
  )
  if not exist "%MARKER%" (
    echo Mirror written by BACKUP_TO_GDRIVE.bat . It is overwritten on every> "%MARKER%"
    echo run, so do not keep anything of your own in here - it gets deleted.>> "%MARKER%"
  )
)

REM ---------- mirror, overwriting last time ----------
REM  Skipped folders are all regenerable: node_modules from npm install,
REM  dist and .wrangler from npm run build.
set "XD=/XD node_modules dist .wrangler .wrangler-config outputs coverage .vite .turbo"
set XD=%XD% "Claude outputs"
set "XF=/XF *.log Thumbs.db .DS_Store vite.config.ts.timestamp-*.mjs .sbconnect_backup"
REM  Google Drive native files live only in the cloud. They are NOT in the
REM  source folder, so /MIR would delete them from Drive. Deleting a .gscript
REM  sends the whole Apps Script project to the Drive trash. Never mirror them.
set XF=%XF% *.gscript *.gsheet *.gdoc *.gslides *.gform *.gdraw *.gtable *.glink *.gmap *.gjam *.gsite desktop.ini

set "RCFLAGS=/MIR /FFT /XJ /MT:8 /R:2 /W:2 /NP /NFL /NDL /NJH"
if defined DRYRUN set "RCFLAGS=%RCFLAGS% /L"

echo [1/4] Overwriting the mirror ...
if defined DRYRUN (
  robocopy "%PROJECT%" "%MIRROR%" %RCFLAGS% %XD% %XF%
) else (
  robocopy "%PROJECT%" "%MIRROR%" %RCFLAGS% %XD% %XF% /LOG+:"%LOGDIR%\backup_%STAMP%.log"
)
set "RC=%ERRORLEVEL%"
REM  robocopy: 0 to 7 means success, 8 and above is a real failure
if %RC% GEQ 8 (
  echo.
  echo  STOP. robocopy failed with code %RC%.
  echo        See "%LOGDIR%\backup_%STAMP%.log"
  goto :fail
)
echo    OK    mirror matches this machine ^(robocopy code %RC%^)
echo.

if defined DRYRUN (
  echo  Dry run done. Nothing was written.
  goto :end
)

if exist "%PROJECT%\docs\33_BACKUP_GDRIVE.md" (
  copy /y "%PROJECT%\docs\33_BACKUP_GDRIVE.md" "%ROOT%\RESTORE_GUIDE.md" >nul 2>nul
)

REM ---------- small dated zip of the parts git does not keep ----------
if defined NOSNAP (
  echo [2/4] Snapshot skipped ^(/nosnap^)
  echo.
  goto :prune
)

echo [2/4] Saving a dated copy of sql and .env ...
set "SNAPZIP=%SNAPDIR%\sql_env_%STAMP%.zip"
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; try{ $t=Join-Path $env:TEMP ('sbsnap_' + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory -Path $t | Out-Null; if(Test-Path '%PROJECT%\sql'){Copy-Item -LiteralPath '%PROJECT%\sql' -Destination (Join-Path $t 'sql') -Recurse -Force}; if(Test-Path '%PROJECT%\.env'){Copy-Item -LiteralPath '%PROJECT%\.env' -Destination (Join-Path $t 'env.txt') -Force}; Compress-Archive -Path (Join-Path $t '*') -DestinationPath '%SNAPZIP%' -Force; Remove-Item -LiteralPath $t -Recurse -Force; exit 0 }catch{ Write-Output ('   WARN  ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 (
  echo    WARN  snapshot failed. The mirror is still good.
) else (
  for %%F in ("%SNAPZIP%") do set /a SKB=%%~zF/1024
  echo    OK    sql_env_%STAMP%.zip  ^(!SKB! KB^)
)
echo.

if defined FULLZIP (
  echo        Writing a full project zip as well ...
  set "FULLZIPFILE=%SNAPDIR%\full_%STAMP%.zip"
  set "ZIPOK="
  where tar >nul 2>nul
  if not errorlevel 1 (
    tar -a -c -f "!FULLZIPFILE!" -C "%MIRROR%" . 2>nul
    if not errorlevel 1 set "ZIPOK=1"
  )
  if not defined ZIPOK (
    powershell -NoProfile -Command "try{Compress-Archive -Path '%MIRROR%\*' -DestinationPath '!FULLZIPFILE!' -Force -ErrorAction Stop; exit 0}catch{exit 1}"
    if not errorlevel 1 set "ZIPOK=1"
  )
  if not defined ZIPOK (
    echo    WARN  full zip failed.
  ) else (
    for %%F in ("!FULLZIPFILE!") do set /a FMB=%%~zF/1048576
    echo    OK    full_%STAMP%.zip  ^(!FMB! MB^)
  )
  echo.
)

:prune
echo [3/4] Keeping the newest %KEEP% dated copies ...
powershell -NoProfile -Command "$d='%SNAPDIR%'; if(Test-Path $d){ foreach($p in @('sql_env_*.zip','full_*.zip')){ $old=Get-ChildItem -LiteralPath $d -Filter $p -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -Skip %KEEP%; if($old){ $old | Remove-Item -Force; Write-Output ('   removed ' + $old.Count + ' old ' + $p) } } }"
powershell -NoProfile -Command "$d='%LOGDIR%'; if(Test-Path $d){ $old=Get-ChildItem -LiteralPath $d -Filter 'backup_*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -Skip %KEEP%; if($old){ $old | Remove-Item -Force } }"
echo.

echo [4/4] Summary
powershell -NoProfile -Command "$m='%MIRROR%'; $f=@(Get-ChildItem -LiteralPath $m -Recurse -File -Force -ErrorAction SilentlyContinue); $mb=[math]::Round((($f | Measure-Object Length -Sum).Sum)/1MB,1); Write-Output ('   mirror    : ' + $f.Count + ' files, ' + $mb + ' MB'); $q=Join-Path $m 'sql'; if(Test-Path $q){ Write-Output ('   sql/      : ' + @(Get-ChildItem -LiteralPath $q -Filter '*.sql' -Recurse -ErrorAction SilentlyContinue).Count + ' files') } else { Write-Output '   sql/      : MISSING - is the folder still in the project?' }; if(Test-Path (Join-Path $m '.env')){ Write-Output '   .env      : ok' } else { Write-Output '   .env      : MISSING' }; if(Test-Path (Join-Path $m '.git')){ Write-Output '   .git      : ok, code history included' } else { Write-Output '   .git      : MISSING' }; $s='%SNAPDIR%'; if(Test-Path $s){ $z=@(Get-ChildItem -LiteralPath $s -Filter '*.zip' -ErrorAction SilentlyContinue); Write-Output ('   dated zip : ' + $z.Count + ' file(s), ' + [math]::Round((($z | Measure-Object Length -Sum).Sum)/1MB,1) + ' MB') }"
echo.

echo ============================================================
echo  Backup done - previous copy overwritten
echo ============================================================
echo.
echo  Google Drive uploads in the background. Watch the Drive tray
echo  icon until it says everything is up to date BEFORE shutting
echo  the computer down, otherwise the files never left this machine.
echo.
echo  PRIVACY: this copy holds sql\ with the real names and emails of
echo  every employee and the shared first-login password, plus .env
echo  with the connection keys. The Drive folder must stay Restricted.
echo.
goto :end

:fail
echo.
echo ============================================================
echo  Backup stopped.
echo ============================================================
set "EXITCODE=1"

:end
echo.
pause
endlocal & exit /b %EXITCODE%
