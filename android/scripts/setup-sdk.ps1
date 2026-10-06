# android/scripts/setup-sdk.ps1 — install the Android SDK / NDK / CMake needed to build the APK.
#
# Everything is installed under android\.build\ so the game repository stays clean and the user profile is never
# touched (the DSH sandbox only allows writes inside the workspace). Delete android\.build\ to reclaim ~3.9 GB.
#
# Usage:  pwsh -NoProfile -File android\scripts\setup-sdk.ps1 [-Force]

[CmdletBinding()]
param(
  [switch]$Force,
  # Command-line tools build id from https://dl.google.com/android/repository/repository2-3.xml
  [string]$CmdlineToolsBuild = '13114758',
  [string]$NdkVersion = '27.0.12077973',
  [string]$CmakeVersion = '3.22.1',
  [string]$BuildTools = '35.0.0',
  [string]$Platform = 'android-35'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# This script lives in android/scripts/, so the Capacitor project root is one level up.
$AndroidRoot = Split-Path -Parent $PSScriptRoot
$BuildRoot = Join-Path $AndroidRoot '.build'
$SdkRoot   = Join-Path $BuildRoot 'sdk'
$DlRoot    = Join-Path $BuildRoot 'dl'
$Downloader = Join-Path $PSScriptRoot 'lib\download.mjs'

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Info($msg) { Write-Host "    $msg" }

# ---------------------------------------------------------------------------------------------------
# 0. Locate a JDK (Gradle and sdkmanager both need it)
# ---------------------------------------------------------------------------------------------------
Step 'Locating a JDK'
$javaExe = (Get-Command java -ErrorAction SilentlyContinue)?.Source
if (-not $javaExe) { throw 'java was not found on PATH. Install a JDK 17+ first.' }
$javaHome = Split-Path -Parent (Split-Path -Parent $javaExe)
$env:JAVA_HOME = $javaHome
Info "JAVA_HOME = $javaHome"
& $javaExe -version 2>&1 | ForEach-Object { Info $_ }

# ---------------------------------------------------------------------------------------------------
# 1. Command-line tools
# ---------------------------------------------------------------------------------------------------
Step 'Android SDK command-line tools'
New-Item -ItemType Directory -Force -Path $DlRoot, $SdkRoot | Out-Null

$zipName = "commandlinetools-win-$CmdlineToolsBuild`_latest.zip"
$zipPath = Join-Path $DlRoot $zipName
$zipUrl  = "https://dl.google.com/android/repository/$zipName"

# sha1 values published in https://dl.google.com/android/repository/repository2-3.xml.
# Needed because several dl.google.com endpoints send a stale Content-Length, so size alone cannot validate a download.
$ctSha1 = @{
  '16111833' = '57d04f2d75eb8e8fffc5000a987e5de4b5a63e9d'
  '15859902' = 'b9862337a13e2809a5159dc3a08d058091bd59f6'
  '15641748' = '2bea1388b8a248040a340a08ca0638138633f687'
  '14742923' = '16b3f45ddb3d85ea6bbe6a1c0b47146daf0db450'
  '13114758' = '54a582f3bf73e04253602f2d1c80bd5868aac115'
  '12996373' = '26805d62669b20af583074f67926e31600e43185'
  '12266719' = '32787c10f55911fd109848906b1275723e79f659'
  '11076708' = '3d2917302740f476999a091bc5558837c7a863c5'
}
$wantSha1 = $ctSha1[$CmdlineToolsBuild]
if (-not $wantSha1) { Write-Warning "no known sha1 for build $CmdlineToolsBuild; the download will not be checksum-verified" }

if ($Force) { Remove-Item $zipPath -Force -ErrorAction SilentlyContinue }
if ($wantSha1) {
  & node $Downloader $zipUrl $zipPath --sha1 $wantSha1
} else {
  & node $Downloader $zipUrl $zipPath
}
if ($LASTEXITCODE -ne 0) { throw "download failed: $zipUrl" }

$ctRoot = Join-Path $SdkRoot 'cmdline-tools'
$latest = Join-Path $ctRoot 'latest'
if ((Test-Path $latest) -and -not $Force) {
  Info "cmdline-tools already installed at $latest"
} else {
  Info 'extracting…'
  $tmp = Join-Path $BuildRoot 'ct-extract'
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  # bsdtar handles .zip and is far quicker than Expand-Archive for ~155 MB
  & tar.exe -xf $zipPath -C $tmp
  if ($LASTEXITCODE -ne 0) { throw 'failed to extract command-line tools' }
  Remove-Item $latest -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $ctRoot | Out-Null
  Move-Item (Join-Path $tmp 'cmdline-tools') $latest
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Info "installed to $latest"
}

$sdkManager = Join-Path $latest 'bin\sdkmanager.bat'
if (-not (Test-Path $sdkManager)) { throw "sdkmanager not found at $sdkManager" }

$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot

# sdkmanager keeps its settings/repository cache under $ANDROID_USER_HOME (default ~/.android). That directory
# lives outside the workspace, where the sandbox refuses writes — and when it cannot be written sdkmanager silently
# fails to fetch the remote package list ("Failed to download any source lists"), so every install then 404s.
$AndroidUserHome = Join-Path $BuildRoot 'android-user'
New-Item -ItemType Directory -Force -Path $AndroidUserHome | Out-Null
$env:ANDROID_USER_HOME = $AndroidUserHome
Info "ANDROID_USER_HOME = $AndroidUserHome"

# ---------------------------------------------------------------------------------------------------
# 2. Accept licences
# ---------------------------------------------------------------------------------------------------
Step 'Accepting SDK licences'
# sdkmanager --licenses reads "y" answers from stdin until it stops asking.
$answers = (1..60 | ForEach-Object { 'y' }) -join "`n"
$answers | & $sdkManager --sdk_root="$SdkRoot" --licenses 2>&1 | ForEach-Object { Info $_ }
Info 'licences done'

# ---------------------------------------------------------------------------------------------------
# 3. Install packages
# ---------------------------------------------------------------------------------------------------
Step 'Installing SDK packages'
$packages = @(
  'platform-tools',
  "platforms;$Platform",
  "build-tools;$BuildTools",
  "ndk;$NdkVersion",
  "cmake;$CmakeVersion"
)
Info ($packages -join ' ')

& $sdkManager --sdk_root="$SdkRoot" @packages 2>&1 | ForEach-Object { Info $_ }
if ($LASTEXITCODE -ne 0) { throw "sdkmanager failed with exit code $LASTEXITCODE" }

# ---------------------------------------------------------------------------------------------------
# 4. Verify
# ---------------------------------------------------------------------------------------------------
Step 'Verifying installation'
foreach ($p in @("platform-tools", "platforms\$Platform", "build-tools\$BuildTools", "ndk\$NdkVersion", "cmake\$CmakeVersion")) {
  $full = Join-Path $SdkRoot $p
  if (Test-Path $full) { Info "OK   $p" } else { Write-Warning "MISSING $p" }
}

# Record the resolved toolchain so later scripts do not have to guess.
$statePath = Join-Path $BuildRoot 'sdk-state.json'
@{
  sdkRoot      = $SdkRoot
  javaHome     = $javaHome
  ndkVersion   = $NdkVersion
  cmakeVersion = $CmakeVersion
  buildTools   = $BuildTools
  platform     = $Platform
} | ConvertTo-Json | Set-Content -Encoding utf8 $statePath
Info "wrote $statePath"

Write-Host "`nSDK setup complete." -ForegroundColor Green
