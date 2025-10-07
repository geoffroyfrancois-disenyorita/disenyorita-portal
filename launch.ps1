#requires -version 5.1
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Command = 'dev',
    [Parameter(Position = 1)]
    [string]$Target = 'all'
)

function Show-Usage {
    @'
Usage: .\launch.ps1 [command] [logsTarget]

Commands:
  dev|run|foreground    Start backend and frontend in the foreground (default)
  up|start|background   Start backend and frontend in the background and return to the shell
  down|stop             Stop background services
  restart               Restart background services
  status                Show background service status
  verify                Check tooling, dependencies, and environment configuration
  logs [service]        Tail logs for backend, frontend, or both (default)

Examples:
  .\launch.ps1 up             # start both services in the background
  .\launch.ps1 logs backend   # follow backend logs
  .\launch.ps1 down           # stop background services
  .\launch.ps1                # run both services in the foreground (original behaviour)
'@
}

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$validCommands = @('dev', 'run', 'foreground', 'up', 'start', 'background', 'down', 'stop', 'restart', 'status', 'logs', 'verify', 'help', '--help', '-h')
$normalizedCommand = $Command.ToLowerInvariant()
if (-not $validCommands.Contains($normalizedCommand)) {
    Write-Error "Unknown command '$Command'."
    Show-Usage
    exit 1
}

if ($normalizedCommand -in @('help', '--help', '-h')) {
    Show-Usage
    exit 0
}

$RootDir = Split-Path -Parent $PSCommandPath
Set-Location $RootDir
$BackendDir = Join-Path $RootDir 'backend'
$FrontendDir = Join-Path $RootDir 'frontend'
$BackendVenv = Join-Path $BackendDir '.venv'
$DevStateDir = Join-Path $RootDir '.devserver'
$PidDir = Join-Path $DevStateDir 'pids'
$LogDir = Join-Path $DevStateDir 'logs'

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-ErrorMessage {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Ensure-StateDirectories {
    foreach ($dir in @($DevStateDir, $PidDir, $LogDir)) {
        if (-not (Test-Path $dir -PathType Container)) {
            New-Item -ItemType Directory -Path $dir | Out-Null
        }
    }
}

function Check-Command {
    param(
        [string]$Command,
        [string]$FriendlyName
    )

    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "Missing required command '$Command'. Install $FriendlyName before continuing."
    }
}

function Detect-Python {
    $candidates = @(
        @('py', '-3'),
        @('py'),
        @('python3'),
        @('python')
    )

    foreach ($candidate in $candidates) {
        $exe = $candidate[0]
        if (Get-Command $exe -ErrorAction SilentlyContinue) {
            $args = if ($candidate.Count -gt 1) { $candidate[1..($candidate.Count - 1)] } else { @() }
            try {
                & $exe @args '-c' 'import sys' *> $null
                return ,@($exe) + $args
            }
            catch {
                continue
            }
        }
    }

    throw 'Python 3 executable not found. Install Python 3 and ensure it is on your PATH.'
}

function Load-DotEnv {
    param([string]$Path)

    if (-not (Test-Path $Path -PathType Leaf)) {
        Write-Info "No environment file found at $Path (skipping)."
        if (Test-Path ($Path + '.example') -PathType Leaf) {
            Write-Info "Consider copying $Path.example to $Path and updating the values."
        }
        return
    }

    Write-Info "Loading environment variables from $Path"
    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed)) {
            continue
        }
        if ($trimmed.StartsWith('#')) {
            continue
        }
        if ($trimmed.StartsWith('export ')) {
            $trimmed = $trimmed.Substring(7).Trim()
        }
        $delimiterIndex = $trimmed.IndexOf('=')
        if ($delimiterIndex -lt 1) {
            continue
        }
        $key = $trimmed.Substring(0, $delimiterIndex).Trim()
        $value = $trimmed.Substring($delimiterIndex + 1).Trim()
        if ($value.StartsWith('"') -and $value.EndsWith('"') -and $value.Length -ge 2) {
            $value = $value.Substring(1, $value.Length - 2).Replace('""', '"')
        }
        elseif ($value.StartsWith("'") -and $value.EndsWith("'") -and $value.Length -ge 2) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $value = $value -replace '\\n', "`n"
        [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

$script:BackendHealthUrl = 'http://127.0.0.1:8000/health'
$script:FrontendDevUrl = 'http://127.0.0.1:3000'

function Initialize-ServiceUrls {
    $backendPort = $env:BACKEND_PORT
    if ([string]::IsNullOrWhiteSpace($backendPort)) {
        $backendPort = $env:API_PORT
    }
    if ([string]::IsNullOrWhiteSpace($backendPort)) {
        $backendPort = '8000'
    }
    $script:BackendHealthUrl = "http://127.0.0.1:$backendPort/health"

    $frontendPort = $env:FRONTEND_PORT
    if ([string]::IsNullOrWhiteSpace($frontendPort)) {
        $frontendPort = $env:PORT
    }
    if ([string]::IsNullOrWhiteSpace($frontendPort)) {
        $frontendPort = '3000'
    }
    $script:FrontendDevUrl = "http://127.0.0.1:$frontendPort"
}

$script:PythonCommandParts = @()
$script:VenvPython = $null

function Ensure-Prerequisites {
    if ($script:PythonCommandParts.Count -eq 0) {
        $script:PythonCommandParts = Detect-Python
    }

    $pythonExe = $script:PythonCommandParts[0]
    $pythonArgs = if ($script:PythonCommandParts.Count -gt 1) { $script:PythonCommandParts[1..($script:PythonCommandParts.Count - 1)] } else { @() }
    $pythonDisplay = ($script:PythonCommandParts -join ' ')

    try {
        & $pythonExe @pythonArgs '-m' 'pip' '--version' *> $null
    }
    catch {
        throw "pip for Python 3 is not available. Install pip (usually via '$pythonDisplay -m ensurepip --upgrade' or the Microsoft Store installer)."
    }

    Check-Command -Command 'node' -FriendlyName 'Node.js'
    Check-Command -Command 'npm' -FriendlyName 'npm (Node Package Manager)'

    Load-DotEnv (Join-Path $RootDir '.env')

    $venvPythonWin = Join-Path $BackendVenv 'Scripts/python.exe'
    $venvPythonUnix = Join-Path $BackendVenv 'bin/python'

    if (-not (Test-Path $venvPythonWin) -and -not (Test-Path $venvPythonUnix)) {
        Write-Info "Creating Python virtual environment for backend at $BackendVenv"
        & $pythonExe @pythonArgs '-m' 'venv' $BackendVenv
    }

    if (Test-Path $venvPythonWin) {
        $script:VenvPython = $venvPythonWin
    }
    elseif (Test-Path $venvPythonUnix) {
        $script:VenvPython = $venvPythonUnix
    }
    else {
        throw "Unable to locate the Python interpreter inside the virtual environment at $BackendVenv."
    }

    Write-Info 'Installing backend dependencies...'
    & $script:VenvPython '-m' 'pip' 'install' '-r' (Join-Path $BackendDir 'requirements.txt')

    $frontendNodeModules = Join-Path $FrontendDir 'node_modules'
    if (-not (Test-Path $frontendNodeModules)) {
        Write-Info 'Installing frontend dependencies (this may take a moment)...'
        Push-Location $FrontendDir
        try {
            npm install | Out-Null
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Info 'Frontend dependencies already installed.'
    }

    Initialize-ServiceUrls
}

function Get-PidPath {
    param([string]$Name)
    return (Join-Path $PidDir "$Name.pid")
}

function Get-LogPath {
    param([string]$Name)
    return (Join-Path $LogDir "$Name.log")
}

function Get-ProcessFromPidFile {
    param([string]$PidPath)

    if (-not (Test-Path $PidPath -PathType Leaf)) {
        return $null
    }

    $pidText = Get-Content $PidPath | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($pidText)) {
        return $null
    }

    $pidValue = 0
    if (-not [int]::TryParse($pidText, [ref]$pidValue)) {
        return $null
    }

    try {
        return Get-Process -Id $pidValue -ErrorAction Stop
    }
    catch {
        return $null
    }
}

function Start-BackgroundService {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    $pidPath = Get-PidPath $Name
    $existing = Get-ProcessFromPidFile $pidPath
    if ($null -ne $existing) {
        Write-Info "$Name is already running (PID $($existing.Id))."
        return
    }

    if (Test-Path $pidPath -PathType Leaf) {
        Remove-Item $pidPath -Force
    }

    $logPath = Get-LogPath $Name
    if (Test-Path $logPath -PathType Leaf) {
        Clear-Content $logPath
    }
    else {
        New-Item -ItemType File -Path $logPath | Out-Null
    }

    Write-Info "Starting $Name in background (logs: $logPath)..."
    $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -RedirectStandardOutput $logPath -RedirectStandardError $logPath -WindowStyle Hidden -PassThru
    Set-Content -Path $pidPath -Value $process.Id
    Write-Info "$Name started with PID $($process.Id)."
}

function Stop-BackgroundService {
    param([string]$Name)

    $pidPath = Get-PidPath $Name
    if (-not (Test-Path $pidPath -PathType Leaf)) {
        Write-Info "$Name is not running."
        return
    }

    $process = Get-ProcessFromPidFile $pidPath
    if ($null -eq $process) {
        Write-Info "$Name was not running but a PID file was present."
        Remove-Item $pidPath -Force
        return
    }

    Write-Info "Stopping $Name (PID $($process.Id))..."
    try {
        Stop-Process -Id $process.Id -ErrorAction Stop
    }
    catch {
        Write-ErrorMessage "Failed to send stop signal to $Name (PID $($process.Id))."
    }

    try {
        $process.WaitForExit(5000) | Out-Null
    }
    catch {
    }

    if (-not $process.HasExited) {
        Write-Info "$Name did not terminate gracefully; forcing stop."
        try {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
        catch {
        }
    }

    Remove-Item $pidPath -Force
}

function Wait-ForService {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds = 60,
        [int]$RetryDelayMilliseconds = 500,
        [string]$LogPath
    )

    if ([string]::IsNullOrWhiteSpace($Url)) {
        Write-ErrorMessage "No URL provided to verify $Name service startup."
        return $false
    }

    Write-Info "Waiting for $Name to become available at $Url ..."
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $invokeParams = @{ Uri = $Url; TimeoutSec = 5 }
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        $invokeParams['UseBasicParsing'] = $true
    }
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest @invokeParams
            if ($null -ne $response -and $response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Info "$Name is responding at $Url (HTTP $($response.StatusCode))."
                return $true
            }
        }
        catch {
            Start-Sleep -Milliseconds $RetryDelayMilliseconds
            continue
        }

        Start-Sleep -Milliseconds $RetryDelayMilliseconds
    }

    $message = "$Name did not become ready within $TimeoutSeconds seconds at $Url."
    if (-not [string]::IsNullOrWhiteSpace($LogPath)) {
        $message += " Check logs at $LogPath."
    }
    Write-ErrorMessage $message
    return $false
}

function Start-BackgroundServices {
    Ensure-StateDirectories

    Load-DotEnv (Join-Path $BackendDir '.env')
    Initialize-ServiceUrls
    Start-BackgroundService -Name 'backend' -FilePath $script:VenvPython -Arguments @('-m', 'uvicorn', 'app.main:app', '--reload') -WorkingDirectory $BackendDir

    if (-not (Wait-ForService -Name 'backend' -Url $script:BackendHealthUrl -TimeoutSeconds 90 -LogPath (Get-LogPath 'backend'))) {
        Stop-BackgroundService -Name 'backend'
        throw 'Backend service failed to start. Check the log output for details.'
    }

    Load-DotEnv (Join-Path $FrontendDir '.env')
    Initialize-ServiceUrls
    Start-BackgroundService -Name 'frontend' -FilePath 'npm' -Arguments @('run', 'dev') -WorkingDirectory $FrontendDir

    if (-not (Wait-ForService -Name 'frontend' -Url $script:FrontendDevUrl -TimeoutSeconds 120 -LogPath (Get-LogPath 'frontend'))) {
        Stop-BackgroundService -Name 'frontend'
        Stop-BackgroundService -Name 'backend'
        throw 'Frontend service failed to start. Check the log output for details.'
    }

    Write-Info "Backend API available at $script:BackendHealthUrl"
    Write-Info "Frontend app available at $script:FrontendDevUrl"
    Write-Info "Background services running. Use '.\launch.ps1 logs' to follow output or '.\launch.ps1 down' to stop."
}

function Stop-BackgroundServices {
    Stop-BackgroundService -Name 'frontend'
    Stop-BackgroundService -Name 'backend'
    Write-Info 'Background services stopped.'
}

function Show-Status {
    Ensure-StateDirectories

    foreach ($name in 'backend', 'frontend') {
        $pidPath = Get-PidPath $name
        $process = Get-ProcessFromPidFile $pidPath
        if ($null -ne $process) {
            Write-Host "${name}: running (PID $($process.Id))"
        }
        else {
            Write-Host "${name}: stopped"
        }
    }

    Write-Host 'Log files:'
    Write-Host "  Backend : $(Get-LogPath 'backend')"
    Write-Host "  Frontend: $(Get-LogPath 'frontend')"
}

function Tail-Logs {
    param([string]$Target)

    Ensure-StateDirectories
    $targetNormalized = $Target.ToLowerInvariant()

    switch ($targetNormalized) {
        'backend' {
            Write-Info 'Streaming backend logs...'
            Get-Content -Path (Get-LogPath 'backend') -Tail 20 -Wait
        }
        'frontend' {
            Write-Info 'Streaming frontend logs...'
            Get-Content -Path (Get-LogPath 'frontend') -Tail 20 -Wait
        }
        default {
            Write-Info 'Streaming backend and frontend logs...'
            Get-Content -Path (Get-LogPath 'backend'), (Get-LogPath 'frontend') -Tail 20 -Wait
        }
    }
}

function Stop-Processes {
    param([System.Diagnostics.Process[]]$Processes)

    foreach ($proc in $Processes) {
        if ($null -ne $proc -and -not $proc.HasExited) {
            try {
                Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue
            }
            catch {
            }
        }
    }

    foreach ($proc in $Processes) {
        if ($null -ne $proc) {
            try {
                $proc.WaitForExit()
            }
            catch {
            }
        }
    }
}

function Start-ForegroundServices {
    $script:LaunchProcesses = @()
    $script:StopRequested = $false
    $script:ExitCode = 0

    Load-DotEnv (Join-Path $BackendDir '.env')
    Initialize-ServiceUrls
    Write-Info 'Starting backend server...'
    $backendProcess = Start-Process -FilePath $script:VenvPython -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--reload') -WorkingDirectory $BackendDir -PassThru -NoNewWindow
    Write-Info "Backend server started (PID $($backendProcess.Id))."

    if (-not (Wait-ForService -Name 'backend' -Url $script:BackendHealthUrl -TimeoutSeconds 90)) {
        Set-Variable -Name ExitCode -Scope Script -Value 1
        Set-Variable -Name StopRequested -Scope Script -Value $true
        Write-ErrorMessage "Backend did not become ready at $script:BackendHealthUrl."
    }

    $frontendProcess = $null
    if (-not $script:StopRequested) {
        Load-DotEnv (Join-Path $FrontendDir '.env')
        Initialize-ServiceUrls
        Write-Info 'Starting frontend server...'
        $frontendProcess = Start-Process -FilePath 'npm' -ArgumentList @('run', 'dev') -WorkingDirectory $FrontendDir -PassThru -NoNewWindow
        Write-Info "Frontend server started (PID $($frontendProcess.Id))."

        if (-not (Wait-ForService -Name 'frontend' -Url $script:FrontendDevUrl -TimeoutSeconds 120)) {
            Set-Variable -Name ExitCode -Scope Script -Value 1
            Set-Variable -Name StopRequested -Scope Script -Value $true
            Write-ErrorMessage "Frontend did not become ready at $script:FrontendDevUrl."
        }
    }

    $script:LaunchProcesses = @($backendProcess, $frontendProcess)

    $cancelRegistration = Register-EngineEvent -SourceIdentifier ConsoleCancelEvent -SupportEvent -Action {
        param($sender, $eventArgs)
        $eventArgs.Cancel = $true
        Write-Host ''
        Write-Host '[INFO] Ctrl+C detected. Stopping services...' -ForegroundColor Cyan
        Set-Variable -Name StopRequested -Scope Script -Value $true
    }

    if (-not $script:StopRequested) {
        Write-Info "Backend API available at $script:BackendHealthUrl"
        Write-Info "Frontend app available at $script:FrontendDevUrl"
        Write-Info 'Both services are running. Press Ctrl+C to stop.'
    }

    try {
        while (-not $script:StopRequested) {
            foreach ($proc in $script:LaunchProcesses) {
                if ($null -eq $proc) {
                    continue
                }
                if ($proc.HasExited) {
                    if ($proc.ExitCode -ne 0 -and $script:ExitCode -eq 0) {
                        Set-Variable -Name ExitCode -Scope Script -Value $proc.ExitCode
                        Write-ErrorMessage "Process PID $($proc.Id) exited unexpectedly with status $($proc.ExitCode)."
                    }
                    else {
                        Write-Info "Process PID $($proc.Id) exited."
                    }
                    Set-Variable -Name StopRequested -Scope Script -Value $true
                    break
                }
            }

            if (-not $script:StopRequested) {
                Start-Sleep -Milliseconds 500
            }
        }
    }
    finally {
        Write-Host ''
        Write-Info 'Shutting down services...'
        Stop-Processes -Processes $script:LaunchProcesses
        if ($null -ne $cancelRegistration) {
            Unregister-Event -SourceIdentifier ConsoleCancelEvent -ErrorAction SilentlyContinue
        }
        Write-Info 'All services stopped.'
    }

    exit $script:ExitCode
}

switch ($normalizedCommand) {
    {$_ -in 'dev', 'run', 'foreground'} {
        Ensure-Prerequisites
        Start-ForegroundServices
    }
    {$_ -in 'up', 'start', 'background'} {
        Ensure-Prerequisites
        Start-BackgroundServices
    }
    {$_ -in 'down', 'stop'} {
        Stop-BackgroundServices
    }
    'restart' {
        Stop-BackgroundServices
        Ensure-Prerequisites
        Start-BackgroundServices
    }
    'status' {
        Show-Status
    }
    'logs' {
        Tail-Logs -Target $Target
    }
    'verify' {
        Ensure-Prerequisites
        Write-Info 'Environment verification complete. Use "dev" or "up" to start the servers.'
    }
    default {
        Show-Usage
    }
}
