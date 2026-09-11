param(
  [ValidateSet('Start', 'Build', 'Command')][string]$Action = 'Start',
  [switch]$WithoutDatabase,
  [string]$Command,
  [string[]]$CommandArguments = @()
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot

# The ignored local env file is the user-owned credential source. Never print it.
$envFile = Join-Path $projectRoot '.env.local'
if (Test-Path -LiteralPath $envFile) {
  foreach ($line in (Get-Content -LiteralPath $envFile)) {
    if ($line -match '^(AGNES_API_KEY|AGNES_BASE_URL)=(.*)$') {
      [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim().Trim('"'), 'Process')
    }
  }
}
if (-not $env:AGNES_API_KEY) {
  $env:AGNES_API_KEY = [Environment]::GetEnvironmentVariable('AGNES_API_KEY', 'User')
}
if (-not $env:AGNES_API_KEY) { throw 'Agnes key unavailable. Configure AGNES_API_KEY in the parent environment; do not paste secrets into source.' }
$env:AGNES_BASE_URL = 'https://apihub.agnes-ai.com/v1'

if (-not $WithoutDatabase) {
  # The local stack intentionally leaves optional services stopped. Supabase
  # reports that fact on stderr even when status itself succeeds, so isolate
  # the native diagnostic and decide solely from its exit code below.
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $statusText = & npx --yes supabase status -o json 2>$null | Out-String
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($LASTEXITCODE -ne 0) { throw 'Local Supabase is not running. Start the DAOFLOW local stack first.' }
  $localStatus = $statusText | ConvertFrom-Json
  $localUrl = [uri]$localStatus.API_URL
  if ($localUrl.Host -notin @('localhost', '127.0.0.1', '::1')) { throw 'This launcher only accepts loopback Supabase.' }
  $env:NEXT_PUBLIC_SUPABASE_URL = $localStatus.API_URL
  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $localStatus.ANON_KEY
  $env:SUPABASE_SERVICE_ROLE_KEY = $localStatus.SERVICE_ROLE_KEY
  if (-not $env:SUPABASE_SERVICE_ROLE_KEY -or -not $env:NEXT_PUBLIC_SUPABASE_ANON_KEY) { throw 'Local Supabase keys unavailable.' }
  $localStatus = $null
  $statusText = $null
}

Write-Host ('Agnes configured; local database: ' + (-not $WithoutDatabase) + '. No secret values printed or written.')
switch ($Action) {
  'Build' { & npm run build }
  'Start' {
    # `output: standalone` intentionally omits public/.next/static. Prepare the
    # generated runtime tree before launch so the browser never receives an
    # HTML shell whose JavaScript and CSS chunks 404.
    $standaloneRoot = Join-Path $projectRoot '.next\standalone'
    $standaloneServer = Join-Path $standaloneRoot 'server.js'
    $staticSource = Join-Path $projectRoot '.next\static'
    if (-not (Test-Path -LiteralPath $standaloneServer) -or -not (Test-Path -LiteralPath $staticSource)) {
      throw 'Standalone build output is missing. Run scripts/local-session.ps1 -Action Build first.'
    }
    $staticTarget = Join-Path $standaloneRoot '.next\static'
    New-Item -ItemType Directory -Force -Path $staticTarget | Out-Null
    Copy-Item -Path (Join-Path $staticSource '*') -Destination $staticTarget -Recurse -Force
    $publicSource = Join-Path $projectRoot 'public'
    if (Test-Path -LiteralPath $publicSource) {
      Copy-Item -Path (Join-Path $publicSource '*') -Destination $standaloneRoot -Recurse -Force
    }
    $env:PORT = '3200'
    $env:HOSTNAME = '127.0.0.1'
    & node $standaloneServer
  }
  'Command' { if (-not $Command) { throw 'Command is required.' }; & $Command @CommandArguments }
}
exit $LASTEXITCODE
