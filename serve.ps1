$ErrorActionPreference = 'Stop'
$node = (Get-Command node -ErrorAction Stop).Source
& $node (Join-Path $PSScriptRoot 'server.mjs')
