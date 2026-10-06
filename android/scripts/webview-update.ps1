<#
.SYNOPSIS
  给没有 Play 商店的安卓手机升级「Android System WebView」，让本项目的安卓版能跑起来。

.DESCRIPTION
  游戏前端用了可选链 / 空值合并等 ES2020 语法，系统 WebView 低于 80（Chrome 80，2020-02）时整机前端都不执行：
  首页静态 HTML 画得出来，但「建立主机」点了没反应。国产 ROM / 无 GMS 的机器常常还停在 2018 年的 WebView 66。

  这个脚本做三件事：

    1. 读设备的 API 级别与 ABI，挑一个钉住的 Google 签名 WebView APK（只认 com.google.android.webview：
       本机 framework 的 config_webview_packages.xml 里只白名单了这一个包名，LineageOS / Cromite 这些
       com.android.webview 构建装上去也不会被选为 WebView 提供者）；
    2. 下载（单个连接在本机只有 ~20-40 KB/s，所以拆成 1.5 MB 分片用 16 个并发连接抓，末尾校验 SHA-256）
       —— 已经有完整文件时跳过；
    3. `adb install -r` 装上去，然后打印 dumpsys 的验证结果。

  版本上限（Android 8/9 就到 138 为止，139 起把 minSdk 提到 29）：

    | 设备 API | 版本 | 文件 | ABI |
    |---|---|---|---|
    | 26–28（Android 8.0–9） | 138.0.7204.181 | google-webview-138.0.7204.181.apk | arm64-v8a + armeabi-v7a |
    | 32+（Android 12L+）    | 153.0.8010.36  | google-webview-153.0.8010.36.apk  | arm64-v8a + armeabi-v7a |

  两个包都是 Google 原签名的 com.google.android.webview，来自
  https://github.com/davidcoulson/kiosk-satellite-apk-mirror （release 资产 URL 固定、README 公布了 SHA-256；
  同一批构建在 https://github.com/JonaNorman/WebViewPackage 也有存档）。

.PARAMETER Serial
  adb 设备序列号；只连了一台时可以省略。

.PARAMETER Apk
  已经下好的 WebView APK 路径。给了就不联网下载，直接装。

.PARAMETER DownloadOnly
  只下载并校验，不安装。

.PARAMETER AndroidVersion
  覆盖从设备读到的 API 级别（想在没插手机时先下包可以用，例如 -AndroidVersion 26）。

.EXAMPLE
  pwsh -NoProfile -File android\scripts\webview-update.ps1

.EXAMPLE
  pwsh -NoProfile -File android\scripts\webview-update.ps1 -Apk D:\downloads\webview-138.apk -Serial d240c210
#>
[CmdletBinding()]
param(
  [string]$Serial = "",
  [string]$Apk = "",
  [switch]$DownloadOnly,
  [int]$AndroidVersion = 0
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$cacheDir = Join-Path $root 'android\.build\webview-update'

# 钉住的构建。size 用来做分片长度校验，sha256 来自上游 README / 本机实测。
$builds = @{
  26 = [pscustomobject]@{
    Api = '26-28'; Version = '138.0.7204.181'; File = 'google-webview-138.0.7204.181.apk'
    Url = 'https://github.com/davidcoulson/kiosk-satellite-apk-mirror/releases/download/webview-mirror/google-webview-138.0.7204.181.apk'
    Mirror = 'https://gh-proxy.com/'   # 本机实测：8 并发 ~950 KB/s（直连 ~200 KB/s）
    Size = 222218902
    Sha256 = 'ef90254b3fd31edfc8c8cd35dbfbc4d81a2a4554a278b5cad9d4acfdd85e59ca'
  }
  32 = [pscustomobject]@{
    Api = '32+'; Version = '153.0.8010.36'; File = 'google-webview-153.0.8010.36.apk'
    Url = 'https://github.com/davidcoulson/kiosk-satellite-apk-mirror/releases/download/webview-mirror/google-webview-153.0.8010.36.apk'
    Mirror = 'https://gh-proxy.com/'   # 本机实测：8 并发 ~950 KB/s（直连 ~200 KB/s）
    Size = 0   # 0 = 下载前用 HEAD 问服务器要长度
    Sha256 = 'fc03b62418543ec2027b0a2a02af4887eebd2b1e394e5403f8cde62823582034'
  }
}

function Resolve-Adb {
  $local = Join-Path $root 'android\.build\sdk\platform-tools\adb.exe'
  if (Test-Path $local) { return $local }
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "找不到 adb：既没有 $local，PATH 上也没有。先跑 android\scripts\setup-sdk.ps1。"
}

function Invoke-Adb {
  # 参数名不能叫 $Args —— 那是 PowerShell 的自动变量，绑定不上（会变成「adb 什么都不带」）。
  param([string[]]$AdbArgs, [switch]$AllowFailure)
  $argv = @()
  if ($Serial) { $argv += @('-s', $Serial) }
  $argv += $AdbArgs
  $out = & $script:Adb @argv 2>&1
  if ($LASTEXITCODE -ne 0 -and -not $AllowFailure) {
    throw "adb $($AdbArgs -join ' ') 失败（$LASTEXITCODE）：`n$($out -join "`n")"
  }
  return $out
}

function Get-RemoteSize {
  param([string]$Url)
  $head = & curl.exe -sSL --ssl-no-revoke --noproxy '*' -I -m 60 $Url 2>&1
  foreach ($line in $head) {
    if ("$line" -match '^\s*content-length:\s*(\d+)\s*$') { return [int64]$Matches[1] }
  }
  throw "拿不到 $Url 的 content-length"
}

# 下载：单个连接在这条跨国链路上只有 20-40 KB/s，所以拆成 1.5 MB 分片、十几个并发 curl。
# 用「滚动连接池」而不是分批等待：某个分片慢/断不会拖住后面的分片，连接一空出来就补上下一个。
# 分片文件留在原地，重跑本脚本会跳过已完成的分片（断点续传）。
function Get-RemoteFile {
  param([string]$Url, [string]$OutFile, [int64]$Size, [string]$Sha256, [string]$Mirror = '', [int]$Connections = 16)
  if (-not $Size) { $Size = Get-RemoteSize $Url }
  $dir = "$OutFile.chunks"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $chunkSize = [int64]1536 * 1KB
  $plan = New-Object System.Collections.ArrayList
  $start = [int64]0
  $i = 0
  while ($start -lt $Size) {
    $end = [Math]::Min($start + $chunkSize - 1, $Size - 1)
    [void]$plan.Add([pscustomobject]@{
      Index = $i; Start = $start; End = $end; Len = $end - $start + 1
      Path = (Join-Path $dir ('chunk{0:D4}' -f $i))
    })
    $start = $end + 1; $i++
  }

  $queue = [System.Collections.Generic.Queue[object]]::new()
  # 上次中断留下的 curl 可能还握着分片文件的句柄（脚本被 Ctrl-C / job 取消时子进程不一定跟着死），
  # 先按命令行里的分片目录把它们收掉，否则没法清理半截文件。
  foreach ($proc in (Get-CimInstance Win32_Process -Filter "Name='curl.exe'" -ErrorAction SilentlyContinue)) {
    if ($proc.CommandLine -and $proc.CommandLine.Contains($dir)) {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Milliseconds 500
  foreach ($c in $plan) {
    $have = if (Test-Path $c.Path) { (Get-Item $c.Path).Length } else { 0 }
    if ($have -eq $c.Len) { continue }
    if ($have) { Remove-Item -Force $c.Path -ErrorAction SilentlyContinue }
    $queue.Enqueue($c)
  }
  Write-Host ("下载 {0}：{1:N1} MB，{2} 个分片（已完成 {3}）" -f (Split-Path $OutFile -Leaf), ($Size / 1MB), $plan.Count, ($plan.Count - $queue.Count))

  $running = @{}
  $attempts = @{}
  $failed = @()
  $lastReport = Get-Date
  while ($queue.Count -gt 0 -or $running.Count -gt 0) {
    while ($queue.Count -gt 0 -and $running.Count -lt $Connections) {
      $c = $queue.Dequeue()
      $n = 1 + [int]$attempts[$c.Index]
      $attempts[$c.Index] = $n
      # 默认走国内可达的 GitHub 代理镜像，每三次尝试回一次直连（两条路的拥塞情况互不相同）
      $useUrl = if ($Mirror -and ($n % 3 -ne 0)) { $Mirror + $Url } else { $Url }
      $p = Start-Process -FilePath 'curl.exe' -WindowStyle Hidden -PassThru -ArgumentList @(
        '-sS', '-L', '--ssl-no-revoke', '--noproxy', '*',
        '-r', ("{0}-{1}" -f $c.Start, $c.End),
        '--connect-timeout', '20', '-m', '90',
        '-o', $c.Path, $useUrl)
      $running[[string]$p.Id] = [pscustomobject]@{ Proc = $p; Chunk = $c }
    }

    Start-Sleep -Milliseconds 400
    foreach ($key in @($running.Keys)) {
      $e = $running[$key]
      $stuck = -not $e.Proc.HasExited -and ((Get-Date) - $e.Proc.StartTime).TotalSeconds -gt 100
      if (-not $e.Proc.HasExited -and -not $stuck) { continue }
      if ($stuck) { Stop-Process -Id $e.Proc.Id -Force -ErrorAction SilentlyContinue }
      $running.Remove($key)
      $c = $e.Chunk
      $have = if (Test-Path $c.Path) { (Get-Item $c.Path).Length } else { 0 }
      if ($have -eq $c.Len) { continue }
      if ($attempts[$c.Index] -lt 6) { $queue.Enqueue($c) } else { $failed += $c }
    }

    if (((Get-Date) - $lastReport).TotalSeconds -ge 20) {
      $got = ($plan | ForEach-Object { if (Test-Path $_.Path) { (Get-Item $_.Path).Length } else { 0 } } | Measure-Object -Sum).Sum
      Write-Host ("  {0:P1}  {1:N1}/{2:N1} MB  在传 {3}  队列 {4}" -f ($got / $Size), ($got / 1MB), ($Size / 1MB), $running.Count, $queue.Count)
      $lastReport = Get-Date
    }
  }
  if ($failed.Count) { throw "有 $($failed.Count) 个分片反复失败（重跑本脚本续传）" }

  $short = @($plan | Where-Object { -not (Test-Path $_.Path) -or (Get-Item $_.Path).Length -ne $_.Len })
  if ($short.Count) { throw "下载不完整：还差 $($short.Count) 个分片（可重跑本脚本续传）" }

  # 拼接。分片可能还被上面没退干净的 curl 握着句柄，所以每个分片最多重试 10 次。
  $fs = [System.IO.File]::Create($OutFile)
  foreach ($c in $plan) {
    for ($try = 1; ; $try++) {
      try { $ins = [System.IO.File]::OpenRead($c.Path); break }
      catch { if ($try -ge 10) { $fs.Dispose(); throw }; Start-Sleep -Milliseconds 500 }
    }
    $ins.CopyTo($fs); $ins.Dispose()
  }
  $fs.Dispose()
  Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue

  $hash = (Get-FileHash -Algorithm SHA256 $OutFile).Hash.ToLower()
  if ($hash -ne $Sha256.ToLower()) { throw "SHA-256 不匹配：得到 $hash，期望 $Sha256" }
  Write-Host "  SHA-256 校验通过"
}

function Get-ApkAbis {
  param([string]$Path)
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $abis = $zip.Entries | ForEach-Object {
      if ($_.FullName -match '^lib/([^/]+)/') { $Matches[1] }
    } | Sort-Object -Unique
    return @($abis)
  } finally { $zip.Dispose() }
}

# --- 设备 -------------------------------------------------------------------
$script:Adb = Resolve-Adb
$api = $AndroidVersion
$abilist = @()
$model = '（未连接设备）'
if (-not $api) {
  $devices = & $script:Adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' }
  if (-not $devices) { throw "没有已授权的 adb 设备。插上手机、打开 USB 调试，或加 -AndroidVersion 只下包不安装。" }
  if (-not $Serial -and $devices.Count -gt 1) { throw "连了多台设备，用 -Serial 指定一台。" }
  $model = "$(Invoke-Adb @('shell', 'getprop', 'ro.product.model') | Select-Object -First 1)".Trim()
  $api = [int]"$(Invoke-Adb @('shell', 'getprop', 'ro.build.version.sdk') | Select-Object -First 1)".Trim()
  $abilist = ("$(Invoke-Adb @('shell', 'getprop', 'ro.product.cpu.abilist') | Select-Object -First 1)".Trim() -split ',') | Where-Object { $_ }
  Write-Host "设备：$model，API $api，ABI $($abilist -join ', ')"
}

# 挑构建：138 覆盖 API 26-28，153 覆盖 32+；中间档（29-31）本项目用不到，留给 -Apk 手动指定。
$build = if ($api -ge 32) { $builds[32] } elseif ($api -ge 26) { $builds[26] } else { $null }
if (-not $build -and -not $Apk) {
  throw "API $api 不在脚本钉住的档位里（$($builds[26].Api) / $($builds[32].Api)）。要装现成 APK 请用 -Apk。"
}

# --- 下载 -------------------------------------------------------------------
if (-not $Apk) {
  $Apk = Join-Path $cacheDir $build.File
  $ok = (Test-Path $Apk) -and ((Get-Item $Apk).Length -eq $build.Size) -and
        ((Get-FileHash -Algorithm SHA256 $Apk).Hash.ToLower() -eq $build.Sha256)
  if ($ok) {
    Write-Host "已有 $Apk（校验通过），跳过下载"
  } else {
    Write-Host "下载 Google WebView $($build.Version)（适配 Android $($build.Api)）"
    Get-RemoteFile -Url $build.Url -OutFile $Apk -Size $build.Size -Sha256 $build.Sha256 -Mirror $build.Mirror
  }
}
if ($DownloadOnly) { Write-Host "只下载：$Apk"; return }
if (-not (Test-Path $Apk)) { throw "APK 不存在：$Apk" }

# --- 安装 -------------------------------------------------------------------
# 关键坑：这个包必须能在**64 位进程**里加载。系统 WebView 是「已更新的系统应用」，系统那份的
# primaryCpuAbi 会被继承下来（本机是 armeabi-v7a），所以真正决定 64 位应用能不能用的是包里有没有
# arm64-v8a 的 lib —— 只有 arm32 的包会让每个 64 位应用报
# UnsatisfiedLinkError（... is 32-bit instead of 64-bit），框架还会弹「Android System WebView 已停止运行」，
# App 直接全黑。这里拦在安装之前。
$abis = Get-ApkAbis $Apk
Write-Host "APK：$Apk（含 ABI：$($abis -join ', ')）"
$deviceIsArm64 = ($abilist -contains 'arm64-v8a')
if ($deviceIsArm64 -and -not ($abis -contains 'arm64-v8a')) {
  throw "这个 APK 只有 $($abis -join ', ')；arm64 设备上装它会让所有 64 位应用加载不了 WebView。请换带 arm64-v8a 的包。"
}

$installArgs = @('install', '-r', '-d', $Apk)
Write-Host "安装：adb install -r -d $Apk"
$result = Invoke-Adb $installArgs
$result | ForEach-Object { "  $_" }
if (($result -join "`n") -notmatch 'Success') { throw "安装失败，见上面的 adb 输出。" }

# --- 验证 -------------------------------------------------------------------
Write-Host "`n当前 WebView："
$dump = Invoke-Adb @('shell', 'dumpsys', 'webviewupdate') -AllowFailure
$dump | Select-String 'Current WebView package|Preferred WebView package|Valid package' | ForEach-Object { "  $($_.Line.Trim())" }

$pkg = Invoke-Adb @('shell', 'dumpsys', 'package', 'com.google.android.webview') -AllowFailure
$pkg | Select-String 'versionName|primaryCpuAbi|secondaryCpuAbi' | Select-Object -First 4 | ForEach-Object { "  $($_.Line.Trim())" }

if ($deviceIsArm64) {
  # 注意 $m.Matches[0].Groups[1]：Matches 是「行里第几个匹配」，捕获组要再下一层。
  $secondary = ($pkg | Select-String 'secondaryCpuAbi=(\S+)' | Select-Object -First 1)
  $secondaryAbi = if ($secondary) { $secondary.Matches[0].Groups[1].Value } else { '' }
  if ($secondaryAbi -notmatch 'arm64') {
    Write-Warning "secondaryCpuAbi 是 '$secondaryAbi'（不是 arm64）—— 64 位应用加载不了这个 WebView，App 会全黑。换一个带 arm64-v8a 的包重装。"
  }
}
Write-Host "`n接下来：启动游戏 App，首页应该能点得动了（WebView 版本不够时只有静态 HTML，点「建立主机」没反应）。"
