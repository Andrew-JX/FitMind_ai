$ErrorActionPreference = 'Stop'
Get-Content 'server/.env.local' | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $name = $matches[1].Trim()
    $value = $matches[2].Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path ("Env:" + $name) -Value $value
  }
}
if (-not $env:JWT_SECRET) {
  $env:JWT_SECRET = 'fitmind-browser-smoke-secret'
}
pnpm --filter @fitmind/server dev
