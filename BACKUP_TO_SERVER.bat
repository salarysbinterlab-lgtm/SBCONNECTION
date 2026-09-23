@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  SB Connect - backup EVERYTHING to the company file server
REM
REM  ASCII only on purpose. Thai characters break cmd.exe batch
REM  parsing. The Thai guide lives in docs\33_BACKUP_GDRIVE.md .
REM
REM  THIS IS THE COMPLETE COPY - the only one that has it all
REM    GitHub        code only, no sql
REM    Google Drive  code only, no sql, no apps_script
REM    this server   EVERYTHING including sql and apps_script
REM
REM  Like the Drive script it ADDS AND OVERWRITES but NEVER DELETES.
REM  No /MIR, no /PURGE. A file you removed from the project stays
REM  on the server until somebody deletes it there.
REM
REM  Usage
REM    BACKUP_TO_SERVER.bat           copy + dated zip on the server
REM    BACKUP_TO_SERVER.bat /check    dry run, writes nothing
REM    BACKUP_TO_SERVER.bat /full     also write a full project zip
REM    BACKUP_TO_SERVER.bat /nosnap   copy only, no zip at all
REM    BACKUP_TO_SERVER.bat /yes      no prompts, for use from push.bat
REM
REM  Destination order
REM    1  SB_SERVER environment variable
REM    2  server_target.txt next to this script, full path on line 1
REM    3  \\server-sblab\Project_IT
REM ============================================================

cd /d "%~dp0"

set "KEEP=30"
set "EXITCODE=0"
set "DRYRUN="
set "FULLZIP="
set "NOSNAP="
set "ASSUMEYES="
set "DEFAULTTARGET=\\server-sblab\Project_IT"

:parseargs
if "%~1"=="" goto :parsed
if /i "%~1"=="/check"  set "DRYRUN=1"
if /i "%~1"=="/full"   set "FULLZIP=1"
if /i "%~1"=="/nosnap" set "NOSNAP=1"
if /i "%~1"=="/nozip"  set "NOSNAP=1"
if /i "%~1"=="/yes"    set "ASSUMEYES=1"
shift
goto :parseargs
:parsed

set "PROJECT=%~dp0"
if "%PROJECT:~-1%"=="\" set "PROJECT=%PROJECT:~0,-1%"
for %%I in ("%PROJECT%") do set "PROJNAME=%%~nxI"

echo.
echo ============================================================
echo  SB Connect - Backup to the company server
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

REM ---------- find the server share ----------
set "ROOT="
if defined SB_SERVER if exist "%SB_SERVER%" set "ROOT=%SB_SERVER%"

if not defined ROOT if exist "server_target.txt" (
  for /f "usebackq delims=" %%L in ("server_target.txt") do (
    if not defined ROOT if exist "%%L" set "ROOT=%%L"
  )
)
if not defined ROOT if exist "%DEFAULTTARGET%" set "ROOT=%DEFAULTTARGET%"

if not defined ROOT (
  echo.
  echo  STOP. The company server share was not reachable.
  echo.
  echo  Looked for:
  echo    the SB_SERVER environment variable
  echo    server_target.txt   ^(full path on line 1^)
  echo    %DEFAULTTARGET%
  echo.
  echo  Things to check
  echo    1  Are you on the office network or VPN?
  echo    2  Open the path in File Explorer once and sign in if asked.
  echo    3  If the share has a different name, put the real path on
  echo       line 1 of server_target.txt next to this script.
  echo.
  echo  The other two backups are unaffected. Nothing was lost.
  goto :fail
)

set "MIRROR=%ROOT%\%PROJNAME%"
set "SNAPDIR=%ROOT%\_backup_snapshots"
set "LOGDIR=%ROOT%\_backup_logs"
set "MARKER=%MIRROR%\.sbconnect_backup"

echo  Target : %MIRROR%
echo  Stamp  : %STAMP%
echo  Mode   : add and overwrite. Nothing on the server is deleted.
if defined DRYRUN echo  Mode   : DRY RUN, nothing will be written
echo.

if not defined DRYRUN (
  if not exist "%MIRROR%" mkdir "%MIRROR%" >nul 2>nul
  if not exist "%SNAPDIR%" mkdir "%SNAPDIR%" >nul 2>nul
  if not exist "%LOGDIR%"  mkdir "%LOGDIR%"  >nul 2>nul
  if not exist "%MIRROR%" (
    echo  STOP. Cannot create "%MIRROR%".
    echo        You can reach the share but cannot write to it.
    echo        Ask IT for write permission on that folder.
    goto :fail
  )
  if not exist "%MARKER%" (
    echo Copy written by BACKUP_TO_SERVER.bat . This is the COMPLETE copy> "%MARKER%"
    echo of SB Connect, including sql with employee data. Keep it private.>> "%MARKER%"
  )
)

REM ---------- what does not go to the server ----------
REM  Only things that can be rebuilt. sql and apps_script DO go here.
set "XD=/XD node_modules dist .wrangler .wrangler-config outputs coverage .vite .turbo _local_snapshots"
set XD=%XD% "Claude outputs"

set "XF=/XF *.log Thumbs.db .DS_Store vite.config.ts.timestamp-*.mjs .sbconnect_backup desktop.ini"

REM  /E copies every folder including empty ones. There is deliberately
REM  no /MIR and no /PURGE here, so robocopy never removes anything.
set "RCFLAGS=/E /FFT /XJ /MT:8 /R:2 /W:2 /NP /NFL /NDL /NJH"
if defined DRYRUN set "RCFLAGS=%RCFLAGS% /L"

echo [1/4] Copying new and changed files to the server ...
if defined DRYRUN (
  robocopy "%PROJECT%" "%MIRROR%" %RCFLAGS% %XD% %XF%
) else (
  robocopy "%PROJECT%" "%MIRROR%" %RCFLAGS% %XD% %XF% /LOG+:"%LOGDIR%\server_%STAMP%.log"
)
set "RC=%ERRORLEVEL%"
REM  robocopy: 0 to 7 means success, 8 and above is a real failure
if %RC% GEQ 8 (
  echo.
  echo  STOP. robocopy failed with code %RC%.
  echo        See "%LOGDIR%\server_%STAMP%.log"
  echo        Code 8 and above usually means the network dropped or
  echo        you do not have write permission on the share.
  goto :fail
)
echo    OK    server now has every file from this machine ^(code %RC%^)
echo.

if defined DRYRUN (
  echo  Dry run done. Nothing was written.
  goto :end
)

REM ---------- dated zip, so a bad overwrite can be undone ----------
if defined NOSNAP (
  echo [2/4] Dated zip skipped ^(/nosnap^)
  echo.
  goto :prune
)

echo [2/4] Saving a dated zip of sql, apps_script and .env ...
set "SNAPZIP=%SNAPDIR%\private_%STAMP%.zip"
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; try{ $t=Join-Path $env:TEMP ('sbsrv_' + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory -Path $t | Out-Null; if(Test-Path '%PROJECT%\sql'){Copy-Item -LiteralPath '%PROJECT%\sql' -Destination (Join-Path $t 'sql') -Recurse -Force}; if(Test-Path '%PROJECT%\apps_script'){Copy-Item -LiteralPath '%PROJECT%\apps_script' -Destination (Join-Path $t 'apps_script') -Recurse -Force}; if(Test-Path '%PROJECT%\.env'){Copy-Item -LiteralPath '%PROJECT%\.env' -Destination (Join-Path $t 'env.txt') -Force}; Compress-Archive -Path (Join-Path $t '*') -DestinationPath '%SNAPZIP%' -Force; Remove-Item -LiteralPath $t -Recurse -Force; exit 0 }catch{ Write-Output ('   WARN  ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 (
  echo    WARN  zip failed. The file copy above is still good.
) else (
  for %%F in ("%SNAPZIP%") do set /a SKB=%%~zF/1024
  echo    OK    _backup_snapshots\private_%STAMP%.zip  ^(!SKB! KB^)
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
powershell -NoProfile -Command "$d='%SNAPDIR%'; if(Test-Path $d){ foreach($p in @('private_*.zip','full_*.zip')){ $old=Get-ChildItem -LiteralPath $d -Filter $p -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -Skip %KEEP%; if($old){ $old | Remove-Item -Force; Write-Output ('   removed ' + $old.Count + ' old ' + $p) } } }"
powershell -NoProfile -Command "$d='%LOGDIR%'; if(Test-Path $d){ $old=Get-ChildItem -LiteralPath $d -Filter 'server_*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -Skip %KEEP%; if($old){ $old | Remove-Item -Force } }"
echo.

echo [4/4] Summary
powershell -NoProfile -Command "$m='%MIRROR%'; $f=@(Get-ChildItem -LiteralPath $m -Recurse -File -Force -ErrorAction SilentlyContinue); $mb=[math]::Round((($f | Measure-Object Length -Sum).Sum)/1MB,1); Write-Output ('   on server    : ' + $f.Count + ' files, ' + $mb + ' MB'); $q=Join-Path $m 'sql'; if(Test-Path $q){ Write-Output ('   sql          : ' + @(Get-ChildItem -LiteralPath $q -Filter '*.sql' -Recurse -ErrorAction SilentlyContinue).Count + ' files, correct') } else { Write-Output '   sql          : MISSING - this copy is supposed to have it' }; $a=Join-Path $m 'apps_script'; if(Test-Path $a){ Write-Output ('   apps_script  : ' + @(Get-ChildItem -LiteralPath $a -Filter '*.gs' -ErrorAction SilentlyContinue).Count + ' files, correct') } else { Write-Output '   apps_script  : MISSING - this copy is supposed to have it' }; if(Test-Path (Join-Path $m '.env')){ Write-Output '   .env         : ok' } else { Write-Output '   .env         : MISSING' }; if(Test-Path (Join-Path $m '.git')){ Write-Output '   .git         : ok, code history included' } else { Write-Output '   .git         : MISSING' }; $s='%SNAPDIR%'; if(Test-Path $s){ $z=@(Get-ChildItem -LiteralPath $s -Filter '*.zip' -ErrorAction SilentlyContinue); Write-Output ('   dated zips   : ' + $z.Count + ' file(s), ' + [math]::Round((($z | Measure-Object Length -Sum).Sum)/1MB,1) + ' MB') }"
echo.

echo ============================================================
echo  Server backup done - this is the complete copy
echo ============================================================
echo.
echo  PRIVACY: this folder holds sql\ with the real names and emails
echo  of every employee and the shared first-login password.
echo  It must stay on the IT share with restricted access. Do not
echo  copy it onto a shared desktop or a public folder.
echo.
goto :end

:fail
echo.
echo ============================================================
echo  Server backup stopped.
echo ============================================================
set "EXITCODE=1"

:end
echo.
if not defined ASSUMEYES pause
endlocal & exit /b %EXITCODE%
