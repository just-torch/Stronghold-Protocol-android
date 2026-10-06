# android/scripts/build-apk.ps1 — assemble the game into android/web/nodejs, sync it into the native project and
# build a signed, installable APK.
#
# Everything the build needs lives inside android/ (see setup-sdk.ps1): the Android SDK in .build\sdk, the Gradle
# home in .build\gradle-home and the keystore in android\android. Nothing is written to the user profile, which
# this sandbox does not allow anyway.
#
# Usage:
#   pwsh -NoProfile -File android\scripts\build-apk.ps1
#   pwsh -NoProfile -File android\scripts\build-apk.ps1 -Variant devtest  # the side-by-side TEST app (debug console on)
#   pwsh -NoProfile -File android\scripts\build-apk.ps1 -DebugBuild     # debuggable APK instead of a release one
#   pwsh -NoProfile -File android\scripts\build-apk.ps1 -SkipAssemble   # reuse the existing web/nodejs tree
#   pwsh -NoProfile -File android\scripts\build-apk.ps1 -Clean
#
# -Variant release (default) builds the game as it ships: application id io.github.sganggs.strongholdprotocol, the
# staged server on its own debug-console default ('auto' — a loopback client, i.e. the app's own WebView, gets the
# console; DESIGN §21.33). -Variant devtest builds the same game as a SECOND app that installs next to it:
# application id …strongholdprotocol.dev, launcher label 卫戍协议：盟约·测试, versionName 0.1.1-dev, and the staged
# server forced to SP_CONSOLE=1 (every client of that app, LAN included). Both are signed with the same key.

[CmdletBinding()]
param(
  # Deliberately not named -Debug: that name is already taken by a PowerShell common parameter.
  [switch]$DebugBuild,
  [switch]$SkipAssemble,
  [switch]$Clean,
  [switch]$SkipSync,
  # release = the shipped app; devtest = the side-by-side test app (see the header).
  [ValidateSet('release', 'devtest')][string]$Variant = 'release'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# This script lives in android/scripts/, so the Capacitor project root is one level up.
$AndroidRoot = Split-Path -Parent $PSScriptRoot
$BuildRoot = Join-Path $AndroidRoot '.build'
$AppDir    = $AndroidRoot
$AndroidDir = Join-Path $AndroidRoot 'android'
$StatePath = Join-Path $BuildRoot 'sdk-state.json'

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Info($msg) { Write-Host "    $msg" }

if (-not (Test-Path $StatePath)) {
  throw "Android SDK not found. Run android\scripts\setup-sdk.ps1 first."
}
$state = Get-Content $StatePath -Raw | ConvertFrom-Json

# ---------------------------------------------------------------------------------------------------
# environment — keep every cache inside the repository
# ---------------------------------------------------------------------------------------------------
Step 'Configuring the build environment'
$env:JAVA_HOME        = $state.javaHome
$env:ANDROID_HOME     = $state.sdkRoot
$env:ANDROID_SDK_ROOT = $state.sdkRoot
$env:ANDROID_USER_HOME = Join-Path $BuildRoot 'android-user'
# Gradle refuses to run if it cannot write to its home (~/.gradle, which the sandbox blocks).
$env:GRADLE_USER_HOME = Join-Path $BuildRoot 'gradle-home'
# Same reason for npm.
$env:npm_config_cache = Join-Path $BuildRoot 'npm-cache'
foreach ($d in @($env:ANDROID_USER_HOME, $env:GRADLE_USER_HOME, $env:npm_config_cache)) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
}
Info "JAVA_HOME        = $env:JAVA_HOME"
Info "ANDROID_HOME     = $env:ANDROID_HOME"
Info "GRADLE_USER_HOME = $env:GRADLE_USER_HOME"

# AGP prefers android/local.properties over the environment for the SDK location.
Set-Content -Encoding ascii -Path (Join-Path $AndroidDir 'local.properties') -Value "sdk.dir=$($state.sdkRoot -replace '\\','\\')"

# ---------------------------------------------------------------------------------------------------
# release keystore (self-signed; only ever used to install this fan build by hand)
# ---------------------------------------------------------------------------------------------------
$keystoreProps = Join-Path $AndroidDir 'keystore.properties'
$keystoreFile  = Join-Path $AndroidDir 'stronghold-release.jks'
if (-not $DebugBuild) {
  Step 'Release keystore'
  if ((Test-Path $keystoreFile) -and (Test-Path $keystoreProps)) {
    Info "reusing $keystoreFile"
  } else {
    $keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
    if (-not (Test-Path $keytool)) { throw "keytool not found at $keytool" }
    # Not a secret: a throwaway self-signed key so the APK can be side-loaded. Publishing this app in any store
    # would need a real key that is kept private.
    $storePass = 'stronghold'
    $alias     = 'stronghold'
    & $keytool -genkeypair -v `
      -keystore $keystoreFile `
      -alias $alias `
      -keyalg RSA -keysize 2048 -validity 10000 `
      -storepass $storePass -keypass $storePass `
      -dname "CN=Stronghold Protocol Fan Build, OU=Unofficial, O=Stronghold Protocol, L=, ST=, C=CN" 2>&1 |
      ForEach-Object { Info $_ }
    if ($LASTEXITCODE -ne 0) { throw "keytool failed with exit code $LASTEXITCODE" }
    @"
storeFile=stronghold-release.jks
storePassword=$storePass
keyAlias=$alias
keyPassword=$storePass
"@ | Set-Content -Encoding ascii $keystoreProps
    Info "wrote $keystoreProps"
  }
}

# ---------------------------------------------------------------------------------------------------
# 1. stage the game
# ---------------------------------------------------------------------------------------------------
if (-not $SkipAssemble) {
  Step "Staging the game into android/web/nodejs (console: $(if ($Variant -eq 'devtest') { '1 (test app: every client)' } else { 'auto (the server''s default)' }))"
  $assembleArgs = @((Join-Path $PSScriptRoot 'assemble-nodejs.mjs'))
  $assembleArgs += if ($Variant -eq 'devtest') { '--console=1' } else { '--console=auto' }
  & node @assembleArgs
  if ($LASTEXITCODE -ne 0) { throw "assemble-nodejs.mjs failed with exit code $LASTEXITCODE" }
} else {
  Info 'skipped (-SkipAssemble)'
  # -SkipAssemble reuses the staged tree: make sure it carries THIS variant's console mode (a devtest build must not
  # silently ship the release staging, and the other way round).
  $stagedEntry = Join-Path $AppDir 'web\nodejs\index.js'
  if (Test-Path $stagedEntry) {
    $want = if ($Variant -eq 'devtest') { '1' } else { 'auto' }
    $m = Select-String -Path $stagedEntry -Pattern "^const consoleMode = '(.+)';" | Select-Object -First 1
    $got = if ($m) { $m.Matches[0].Groups[1].Value } else { '(none)' }
    if ($got -ne $want) {
      Write-Warning "the staged web/nodejs/index.js carries SP_CONSOLE='$got' but -Variant $Variant needs '$want' — rerun without -SkipAssemble"
    } else {
      Info "staged console mode ok: SP_CONSOLE='$got'"
    }
  }
}

# ---------------------------------------------------------------------------------------------------
# 2. copy the staged assets into the native project and refresh the plugin wiring
# ---------------------------------------------------------------------------------------------------
if (-not $SkipSync) {
  Step 'cap sync android'
  Push-Location $AppDir
  try {
    & npx --no-install cap sync android 2>&1 | ForEach-Object { Info $_ }
    if ($LASTEXITCODE -ne 0) { throw "cap sync failed with exit code $LASTEXITCODE" }
  } finally { Pop-Location }
} else {
  Info 'skipped (-SkipSync)'
}

# ---------------------------------------------------------------------------------------------------
# 3. build
# ---------------------------------------------------------------------------------------------------
# assembleRelease → app/build/outputs/apk/release/app-release.apk
# assembleDevtest → app/build/outputs/apk/devtest/app-devtest.apk  (its own application id, see the header)
$task = if ($Variant -eq 'devtest') { 'assembleDevtest' } elseif ($DebugBuild) { 'assembleDebug' } else { 'assembleRelease' }

# ---------------------------------------------------------------------------------------------------
# Gradle itself
#
# Two independent problems make the Gradle *wrapper* unusable in this environment, and neither affects
# dependency resolution (repo.maven.apache.org, dl.google.com and plugins.gradle.org all validate fine):
#
#   1. The JDK cannot build a trust path to services.gradle.org ("PKIX path building failed").
#   2. services.gradle.org 307-redirects the archive to GitHub Releases, and github.com /
#      release-assets.githubusercontent.com serve an *incomplete* certificate chain. Windows Schannel
#      silently fetches the missing intermediate over AIA; OpenSSL (Node, and the JDK) do not.
#
# So we download the same distribution ourselves, from whichever source works, and verify it against the
# checksum Gradle publishes (that file is served directly, with no redirect). The version is read from the
# wrapper properties so it stays in step with what `gradlew` would have used. `gradlew` still works normally
# on a machine whose trust store and AIA behaviour are unfiltered.
# ---------------------------------------------------------------------------------------------------
Step 'Resolving Gradle'
$wrapperProps = Join-Path $AndroidDir 'gradle\wrapper\gradle-wrapper.properties'
$distLine = (Select-String -Path $wrapperProps -Pattern '^distributionUrl=(.+)$' | Select-Object -First 1)
if (-not $distLine) { throw "could not read distributionUrl from $wrapperProps" }
$distributionUrl = $distLine.Matches[0].Groups[1].Value -replace '\\:', ':'
$distName = [System.IO.Path]::GetFileNameWithoutExtension($distributionUrl)   # gradle-8.11.1-all
$gradleVersion = ($distName -split '-')[1]
Info "wrapper wants $distName ($distributionUrl)"

$gradleRoot = Join-Path $BuildRoot "gradle-$gradleVersion"
$gradleBin  = Join-Path $gradleRoot 'bin\gradle.bat'
if (Test-Path $gradleBin) {
  Info "already available: $gradleRoot"
} else {
  # -bin is enough to build; -all only adds sources and docs.
  $zipName = "gradle-$gradleVersion-bin.zip"
  $zipPath = Join-Path $BuildRoot "dl\$zipName"
  Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

  $expected = ''
  try {
    $expected = (((& node -e "fetch(process.argv[1]).then(r=>r.text()).then(t=>process.stdout.write(String(t).trim().split(/\s+/)[0])).catch(()=>process.stdout.write(''))" "https://services.gradle.org/distributions/$zipName.sha256") -join '')).Trim()
  } catch { $expected = '' }
  if ($expected.Length -eq 64) { Info "published sha256: $expected" } else { Info 'published sha256 unavailable'; $expected = '' }

  $sources = @(
    "https://services.gradle.org/distributions/$zipName",
    "https://mirrors.cloud.tencent.com/gradle/$zipName",
    "https://mirrors.huaweicloud.com/gradle/$zipName"
  )

  $savedNodeOptions = $env:NODE_OPTIONS
  $downloaded = $false
  foreach ($src in $sources) {
    Info "trying $src"
    # Node 24 can fall back to the OS trust store, which does repair the incomplete GitHub chain.
    $env:NODE_OPTIONS = '--use-system-ca'
    try {
      & node (Join-Path $PSScriptRoot 'lib\download.mjs') $src $zipPath
      $code = $LASTEXITCODE
    } finally {
      $env:NODE_OPTIONS = $savedNodeOptions
    }
    if ($code -ne 0) { continue }

    if ($expected) {
      $actual = (Get-FileHash -Algorithm SHA256 -Path $zipPath).Hash.ToLower()
      if ($actual -ne $expected) {
        Info "checksum mismatch from $src ($actual); discarding and trying another source"
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        continue
      }
      Info 'sha256 verified'
    }
    $downloaded = $true
    break
  }
  if (-not $downloaded) { throw "could not obtain $zipName from any source" }

  Info "extracting to $BuildRoot"
  $tmp = Join-Path $BuildRoot 'gradle-extract'
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  & tar.exe -xf $zipPath -C $tmp
  if ($LASTEXITCODE -ne 0) { throw 'failed to extract the Gradle archive' }
  Remove-Item $gradleRoot -Recurse -Force -ErrorAction SilentlyContinue
  Move-Item (Join-Path $tmp "gradle-$gradleVersion") $gradleRoot
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Info "installed $gradleRoot"
}
if (-not (Test-Path $gradleBin)) { throw "Gradle not found at $gradleBin" }

Step "gradle $task"

$gradleArgs = @()
if ($Clean) { $gradleArgs += 'clean' }
$gradleArgs += $task
# The installed app's versionName/versionCode live in android/app/build.gradle as literals (Gradle reads that file with
# the platform charset, so no non-ASCII comment there); keep them in step with the game's own version (package.json) —
# a merge that bumps the game version must bump them, and this check refuses to build a mismatched APK silently.
$gameVer = (Get-Content (Join-Path (Split-Path -Parent $AndroidRoot) 'package.json') -Raw | ConvertFrom-Json).version
$gradleFile = Join-Path $AndroidDir 'app\build.gradle'
$gv = (Select-String -Path $gradleFile -Pattern '^\s*versionName "([^"]+)"' | Select-Object -First 1).Matches[0].Groups[1].Value
if ($gv -ne $gameVer) { throw "app/build.gradle names version $gv but package.json says $gameVer — update versionName/versionCode there" }
Info "app version $gameVer (app/build.gradle agrees)"
$gradleArgs += @('--no-daemon', '--console=plain')

Push-Location $AndroidDir
try {
  & $gradleBin @gradleArgs 2>&1 | ForEach-Object { $_ }
  $code = $LASTEXITCODE
} finally { Pop-Location }
if ($code -ne 0) { throw "Gradle failed with exit code $code" }

# ---------------------------------------------------------------------------------------------------
# 4. report
# ---------------------------------------------------------------------------------------------------
Step 'Result'
$apks = Get-ChildItem (Join-Path $AndroidDir 'app\build\outputs\apk') -Recurse -Filter '*.apk' -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending
if (-not $apks) { throw 'no APK was produced' }
foreach ($apk in $apks) {
  Info ("{0}  ({1:N1} MB)  {2}" -f $apk.Name, ($apk.Length / 1MB), $apk.FullName)
}
# the variant's own output first (a tree may hold both an earlier release and this devtest APK), never an unsigned one
$signed = $apks | Where-Object { $_.Name -notlike '*unsigned*' }
$best = $signed | Where-Object { $_.FullName -like "*\$Variant\*" } | Select-Object -First 1
if (-not $best) { $best = $signed | Select-Object -First 1 }
if ($best) {
  $outDir = Join-Path $AndroidRoot 'dist'
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  # the game's own version (package.json — the same one the merged upstream tree carries, e.g. 0.1.3), never a literal
  $gameVersion = (Get-Content (Join-Path (Split-Path -Parent $AndroidRoot) 'package.json') -Raw | ConvertFrom-Json).version
  $name = if ($Variant -eq 'devtest') { "Stronghold-Protocol-$gameVersion-dev-arm64.apk" } else { "Stronghold-Protocol-$gameVersion-arm64.apk" }
  $target = Join-Path $outDir $name
  Copy-Item $best.FullName $target -Force
  Write-Host "`nAPK ready: $target" -ForegroundColor Green
}

