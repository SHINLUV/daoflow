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
  $statusText = & npx --yes supabase status -o json 2>$null | Out-String
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
  'Start' { & npm run start -- --hostname 127.0.0.1 --port 3200 }
  'Command' { if (-not $Command) { throw 'Command is required.' }; & $Command @CommandArguments }
}
exit $LASTEXITCODE
