#requires -version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSCommandPath
Set-Location $RootDir
$BackendDir = Join-Path $RootDir 'backend'
$FrontendDir = Join-Path $RootDir 'frontend'
$BackendVenv = Join-Path $BackendDir '.venv'

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-ErrorMessage {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
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

$pythonCommandParts = Detect-Python
$pythonExe = $pythonCommandParts[0]
$pythonArgs = if ($pythonCommandParts.Count -gt 1) { $pythonCommandParts[1..($pythonCommandParts.Count - 1)] } else { @() }
$pythonDisplay = ($pythonCommandParts -join ' ')

try {
    & $pythonExe @pythonArgs '-m' 'pip' '--version' *> $null
}
catch {
    throw "pip for Python 3 is not available. Install pip (usually via '$pythonDisplay -m ensurepip --upgrade' or the Microsoft Store installer)."
}

Check-Command -Command 'node' -FriendlyName 'Node.js'
Check-Command -Command 'npm' -FriendlyName 'npm (Node Package Manager)'

Load-DotEnv (Join-Path $RootDir '.env')

$venvPython = $null
$venvPythonWin = Join-Path $BackendVenv 'Scripts/python.exe'
$venvPythonUnix = Join-Path $BackendVenv 'bin/python'

if (-not (Test-Path $venvPythonWin) -and -not (Test-Path $venvPythonUnix)) {
    Write-Info "Creating Python virtual environment for backend at $BackendVenv"
    & $pythonExe @pythonArgs '-m' 'venv' $BackendVenv
}

if (Test-Path $venvPythonWin) {
    $venvPython = $venvPythonWin
}
elseif (Test-Path $venvPythonUnix) {
    $venvPython = $venvPythonUnix
}
else {
    throw "Unable to locate the Python interpreter inside the virtual environment at $BackendVenv."
}

Write-Info 'Installing backend dependencies...'
& $venvPython '-m' 'pip' 'install' '-r' (Join-Path $BackendDir 'requirements.txt')

$frontendNodeModules = Join-Path $FrontendDir 'node_modules'
if (-not (Test-Path $frontendNodeModules)) {
    Write-Info 'Installing frontend dependencies (this may take a moment)...'
    Push-Location $FrontendDir
    try {
        npm install
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Info 'Frontend dependencies already installed.'
}

Load-DotEnv (Join-Path $BackendDir '.env')
Write-Info 'Starting backend server...'
$backendProcess = Start-Process -FilePath $venvPython -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--reload') -WorkingDirectory $BackendDir -PassThru -NoNewWindow
Write-Info "Backend server started (PID $($backendProcess.Id))."

Load-DotEnv (Join-Path $FrontendDir '.env')
Write-Info 'Starting frontend server...'
$frontendProcess = Start-Process -FilePath 'npm' -ArgumentList @('run', 'dev') -WorkingDirectory $FrontendDir -PassThru -NoNewWindow
Write-Info "Frontend server started (PID $($frontendProcess.Id))."

$script:LaunchProcesses = @($backendProcess, $frontendProcess)
$script:StopRequested = $false
$script:ExitCode = 0

$cancelRegistration = Register-EngineEvent -SourceIdentifier ConsoleCancelEvent -SupportEvent -Action {
    param($sender, $eventArgs)
    $eventArgs.Cancel = $true
    Write-Host ''
    Write-Host '[INFO] Ctrl+C detected. Stopping services...' -ForegroundColor Cyan
    Set-Variable -Name StopRequested -Scope Script -Value $true
}

Write-Info 'Both services are running. Press Ctrl+C to stop.'

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
