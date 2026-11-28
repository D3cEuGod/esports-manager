# 峡谷经理人：一次性生成发布签名密钥（应用内自动更新 + 安卓覆盖安装）
# 用法：在仓库根目录右键「使用 PowerShell 运行」，或在 PowerShell 里执行：
#   powershell -ExecutionPolicy Bypass -File scripts\setup_release_keys.ps1
# 私钥只保存在你的电脑（%USERPROFILE%\RiftManager-keys），不会写进仓库。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$keyDir = Join-Path $env:USERPROFILE 'RiftManager-keys'
New-Item -ItemType Directory -Force -Path $keyDir | Out-Null

function New-Password {
  $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.ToCharArray()
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

# ---------- 1. Tauri 更新签名密钥 ----------
$tauriKey = Join-Path $keyDir 'tauri-updater.key'
$tauriPwFile = Join-Path $keyDir 'tauri-updater.password.txt'
if (Test-Path $tauriKey) {
  Write-Host "已存在 Tauri 更新密钥，跳过生成：$tauriKey" -ForegroundColor Yellow
  $tauriPw = Get-Content $tauriPwFile -Raw
} else {
  if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { throw '没找到 Node.js（npx）。请先安装 https://nodejs.org 后重试。' }
  if (-not (Test-Path (Join-Path $root 'node_modules\@tauri-apps\cli'))) { npm install }
  $tauriPw = New-Password
  npx tauri signer generate --ci -w "$tauriKey" -p "$tauriPw"
  if (-not (Test-Path $tauriKey)) { throw 'Tauri 密钥生成失败' }
  Set-Content -Path $tauriPwFile -Value $tauriPw -NoNewline
}
$pub = (Get-Content "$tauriKey.pub" -Raw).Trim()
# 公钥是公开的，写进仓库供 Claude 填入 tauri.conf.json
Set-Content -Path (Join-Path $root 'src-tauri\updater-pubkey.txt') -Value $pub -NoNewline

# ---------- 2. 安卓签名密钥 ----------
$jks = Join-Path $keyDir 'android-release.p12'
$andPwFile = Join-Path $keyDir 'android-release.password.txt'
if (Test-Path $jks) {
  Write-Host "已存在安卓签名密钥，跳过生成：$jks" -ForegroundColor Yellow
  $andPw = Get-Content $andPwFile -Raw
} else {
  $andPw = New-Password
  $keytool = $null
  $cands = @()
  $cmd = Get-Command keytool -ErrorAction SilentlyContinue
  if ($cmd) { $cands += $cmd.Source }
  if ($env:JAVA_HOME) { $cands += (Join-Path $env:JAVA_HOME 'bin\keytool.exe') }
  $cands += 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe'
  $cands += Get-ChildItem 'C:\Program Files\Java','C:\Program Files\Eclipse Adoptium','C:\Program Files\Microsoft' -Recurse -Filter keytool.exe -ErrorAction SilentlyContinue | ForEach-Object FullName
  foreach ($c in $cands) { if ($c -and (Test-Path $c)) { $keytool = $c; break } }
  if ($keytool) {
    & $keytool -genkeypair -keystore "$jks" -storetype PKCS12 -storepass "$andPw" -keypass "$andPw" `
      -alias riftmanager -keyalg RSA -keysize 2048 -validity 10000 `
      -dname "CN=RiftManager, OU=Game, O=D3cEuGod, C=CN"
  } else {
    # 没装 Java 时用 .NET 生成同等的 PKCS12 密钥库
    $rsa = [System.Security.Cryptography.RSA]::Create(2048)
    $req = New-Object System.Security.Cryptography.X509Certificates.CertificateRequest(
      'CN=RiftManager, OU=Game, O=D3cEuGod, C=CN', $rsa,
      [System.Security.Cryptography.HashAlgorithmName]::SHA256,
      [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $cert = $req.CreateSelfSigned([DateTimeOffset]::UtcNow.AddDays(-1), [DateTimeOffset]::UtcNow.AddYears(27))
    $cert.FriendlyName = 'riftmanager'
    $bytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, $andPw)
    [System.IO.File]::WriteAllBytes($jks, $bytes)
  }
  if (-not (Test-Path $jks)) { throw '安卓密钥生成失败' }
  Set-Content -Path $andPwFile -Value $andPw -NoNewline
}
$jksB64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($jks))

# ---------- 3. 逐个复制到 GitHub Secrets ----------
$secrets = [ordered]@{
  'TAURI_SIGNING_PRIVATE_KEY'          = (Get-Content $tauriKey -Raw).Trim()
  'TAURI_SIGNING_PRIVATE_KEY_PASSWORD' = $tauriPw
  'ANDROID_KEYSTORE_BASE64'            = $jksB64
  'ANDROID_KEYSTORE_PASSWORD'          = $andPw
}
Start-Process 'https://github.com/D3cEuGod/esports-manager/settings/secrets/actions/new'
Write-Host ''
Write-Host '已在浏览器打开 GitHub「New repository secret」页面。' -ForegroundColor Cyan
Write-Host '下面会依次把每个值复制到剪贴板：在网页里 Name 填提示的名字，Secret 处粘贴（Ctrl+V），点 Add secret。' -ForegroundColor Cyan
foreach ($k in $secrets.Keys) {
  Set-Clipboard -Value $secrets[$k]
  Write-Host ''
  Write-Host "Name：$k   （值已复制到剪贴板）" -ForegroundColor Green
  Read-Host '添加好后按回车继续（下一个需要再点 New repository secret）'
}
Set-Clipboard -Value ' '
Write-Host ''
Write-Host "全部完成。请备份文件夹 $keyDir ：丢失后老用户将无法自动更新/覆盖安装。" -ForegroundColor Yellow
Write-Host '公钥已写入 src-tauri\updater-pubkey.txt，告诉 Claude「密钥好了」即可。' -ForegroundColor Yellow
Read-Host '按回车关闭'
