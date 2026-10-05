$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# GitHub's parent shell can be PowerShell 7. Use this child Windows PowerShell's
# own modules instead of inheriting incompatible module paths from that shell.
$env:PSModulePath = Join-Path $PSHOME 'Modules'
# Pinned static build: no FFmpeg installation or PATH changes on the user's machine.
$version = '9.0.2'
$expectedHash = '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$staging = Join-Path $root 'target/packaging'
$archive = Join-Path $staging "ffmpeg-$version.zip"
$unpacked = Join-Path $staging "ffmpeg-$version-extracted"
$destination = Join-Path $staging 'ffmpeg-windows'
New-Item -ItemType Directory -Force -Path $staging | Out-Null
if (!(Test-Path $archive)) {
    Invoke-WebRequest -Uri "https://github.com/GyanD/codexffmpeg/releases/download/$version/ffmpeg-$version-essentials_build.zip" -OutFile $archive
}
if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
    Remove-Item $archive
    throw 'FFmpeg archive checksum mismatch; download rejected. Run again to retry.'
}
Expand-Archive -LiteralPath $archive -DestinationPath $unpacked -Force
$source = Join-Path $unpacked "ffmpeg-$version-essentials_build"
New-Item -ItemType Directory -Force -Path (Join-Path $destination 'bin') | Out-Null
foreach ($name in @('ffmpeg.exe', 'ffprobe.exe')) {
    Copy-Item -LiteralPath (Join-Path $source "bin/$name") -Destination (Join-Path $destination "bin/$name") -Force
}
foreach ($name in @('LICENSE', 'README.txt')) {
    Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $destination $name) -Force
}
Write-Host "Verified FFmpeg $version prepared for bundling."
