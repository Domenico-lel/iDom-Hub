param([string]$Job)
$ErrorActionPreference = 'Stop'
$m = Get-Content -LiteralPath (Join-Path $Job 'manifest.json') -Raw | ConvertFrom-Json
$changed = $false
$candidate = $null
$confirmed = $false
function Write-Result([bool]$Success, [string]$Message) {
  @{version=$m.version; token=$m.token; success=$Success; message=$Message} | ConvertTo-Json -Compress | Set-Content -LiteralPath ($m.result + '.tmp') -Encoding UTF8
  Move-Item -LiteralPath ($m.result + '.tmp') -Destination $m.result -Force
}
try {
  $parentProcess = Get-Process -Id $m.parentPid -ErrorAction SilentlyContinue
  if ($null -ne $parentProcess) {
    if ($parentProcess.Path -ne $m.target) { throw 'Parent identity mismatch' }
    if (-not $parentProcess.WaitForExit(60000)) { throw 'Launcher did not exit' }
  }
  $remaining = 0
  while ($remaining -lt 10) {
    $sameApp = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $m.target })
    if ($sameApp.Count -eq 0) { break }
    Start-Sleep -Seconds 1
    $remaining++
  }
  if ($remaining -eq 10) { throw 'Another launcher instance is running' }
  if ((Get-FileHash -LiteralPath $m.archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $m.digest) { throw 'Installer checksum mismatch' }
  $directory = Split-Path -Parent $m.target
  # NSIS requires /D last, with its full path unquoted even when it contains spaces.
  $changed = $true
  $installer = Start-Process -FilePath $m.archive -ArgumentList ("/S /currentuser /D=" + $directory) -PassThru
  if (-not $installer.WaitForExit(300000)) {
    $installer.Kill()
    $installer.WaitForExit()
    throw 'Installer timed out'
  }
  if ($installer.ExitCode -ne 0) { throw "Installer failed: $($installer.ExitCode)" }
  $candidate = Start-Process -FilePath $m.target -ArgumentList ('"--idom-update-job=' + $Job + '"') -PassThru
  for ($i=0; $i -lt $m.timeout; $i++) {
    $ackPath = Join-Path $Job 'ack.json'
    if (Test-Path -LiteralPath $ackPath) {
      $ack = Get-Content -LiteralPath $ackPath -Raw | ConvertFrom-Json
      if ($ack.version -eq $m.version -and $ack.token -eq $m.token) { $confirmed = $true; break }
    }
    Start-Sleep -Seconds 1
  }
  if (-not $confirmed) { throw 'New launcher did not confirm startup' }
  Write-Result $true 'iDom Launcher è stato aggiornato e riavviato.'
  Remove-Item -LiteralPath $m.backup -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $m.archive -Force -ErrorAction SilentlyContinue
} catch {
  $_ | Out-String | Add-Content -LiteralPath (Join-Path $Job 'helper.log')
  if ($confirmed) { exit 0 }
  if ($null -ne $candidate -and -not $candidate.HasExited) {
    $candidate.Kill()
    $candidate.WaitForExit()
  }
  if ($changed) {
    try {
      Copy-Item -Path (Join-Path $m.backup '*') -Destination (Split-Path -Parent $m.target) -Recurse -Force
      Write-Result $false 'Aggiornamento non riuscito. La versione precedente è stata ripristinata.'
    } catch {
      Write-Result $false 'Aggiornamento incompleto. Installa nuovamente il launcher con il suo installer.'
    }
  } else {
    Write-Result $false 'Aggiornamento non riuscito. La versione precedente è stata conservata.'
  }
  if (Test-Path -LiteralPath $m.target) { Start-Process -FilePath $m.target }
  exit 1
}
