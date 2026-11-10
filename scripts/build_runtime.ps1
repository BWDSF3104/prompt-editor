# runtime/python 組立（Embeddable 3.10.8 ＋ site-packages 4 本コピー ＋ _pth 修正 ＋ worker）。配布物には pip・setuptools を入れない（設計 §4）。
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$rt = Join-Path $root "runtime\python"
$zip = Join-Path $env:TEMP "kilo\python-3.10.8-embed-amd64.zip"
if (-not (Test-Path $zip)) {
    Invoke-WebRequest "https://www.python.org/ftp/python/3.10.8/python-3.10.8-embed-amd64.zip" -OutFile $zip
}
New-Item -ItemType Directory -Force $rt | Out-Null
Expand-Archive -Path $zip -DestinationPath $rt -Force

# _pth は既定で site-packages 無効・cwd 不在 → Lib\site-packages と import site を追記（設計 §4）
$pth = Get-ChildItem $rt -Filter "python3*._pth" | Select-Object -First 1
[IO.File]::AppendAllText($pth.FullName, "Lib\site-packages`nimport site`n")

foreach ($pkg in "dynamicprompts", "pyparsing", "jinja2", "markupsafe") {
    Copy-Item -Recurse -Force (Join-Path $root ".venv\Lib\site-packages\$pkg") (Join-Path $rt "Lib\site-packages\$pkg")
}
Copy-Item -Force (Join-Path $root "worker.py") $rt

# 検証: 正典 import チェック（インラインコード実行禁止条 → スクラッチファイルで）
& (Join-Path $rt "python.exe") (Join-Path $root "docs\ai\tmp\import_check.py")
