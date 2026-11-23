$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 1. Ensure cargo is on PATH
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (Test-Path $cargoBin) { $env:PATH = "$cargoBin;$env:PATH" }

# 2. Auto-detect MSVC + local WindowsSDKCpp if link.exe/rc.exe are not already on PATH
if (-not (Get-Command link.exe -ErrorAction SilentlyContinue)) {
    $msvcRoot = Get-ChildItem 'C:\Program Files (x86)\Microsoft Visual Studio','C:\Program Files\Microsoft Visual Studio' -ErrorAction SilentlyContinue |
        ForEach-Object { Get-ChildItem $_.FullName -Recurse -Filter 'link.exe' -ErrorAction SilentlyContinue } |
        Where-Object { $_.FullName -match 'Hostx64\\x64\\link\.exe$' } |
        Select-Object -First 1
    if ($msvcRoot) {
        $msvcVerDir = Split-Path (Split-Path (Split-Path $msvcRoot.DirectoryName))
        $env:PATH = "$($msvcRoot.DirectoryName);$env:PATH"
        $env:LIB = "$msvcVerDir\lib\x64;$env:LIB"
        $env:INCLUDE = "$msvcVerDir\include;$env:INCLUDE"
    }
}

$localSdk = Join-Path $env:LOCALAPPDATA 'WindowsSDKCpp'
if ((Test-Path $localSdk) -and (-not (Get-Command rc.exe -ErrorAction SilentlyContinue))) {
    $sdkVer = Get-ChildItem "$localSdk\base\c\bin" -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^10\.' } | Sort-Object Name -Descending | Select-Object -First 1
    if ($sdkVer) {
        $v = $sdkVer.Name
        $env:PATH = "$localSdk\base\c\bin\$v\x64;$env:PATH"
        $env:LIB = "$localSdk\x64\c\um\x64;$localSdk\x64\c\ucrt\x64;$env:LIB"
        $env:INCLUDE = "$localSdk\base\c\Include\$v\um;$localSdk\base\c\Include\$v\ucrt;$localSdk\base\c\Include\$v\shared;$env:INCLUDE"
    }
}

# 3. Build single-file frontend dist/index.html
python build_web.py

# 4. Build standalone Tauri v2 Windows binary (--no-bundle outputs self-contained .exe)
npx tauri build --no-bundle

# 5. Copy to release/ with friendly name
$exeSrc = Join-Path $root 'src-tauri\target\release\rift-manager.exe'
if (!(Test-Path $exeSrc)) { throw "Build finished but $exeSrc not found" }
$relDir = Join-Path $root 'release'
New-Item -ItemType Directory -Force -Path $relDir | Out-Null
$gameName = [string]::new([char[]]@(0x5CE1,0x8C37,0x7ECF,0x7406,0x4EBA))
$exeDst = Join-Path $relDir ($gameName + '.exe')
Copy-Item $exeSrc $exeDst -Force
$sizeMb = [Math]::Round((Get-Item $exeDst).Length / 1MB, 2)
Write-Output "BUILD_SUCCESS: $exeDst ($sizeMb MB)"
