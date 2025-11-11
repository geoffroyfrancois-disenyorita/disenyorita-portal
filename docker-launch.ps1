#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Docker Desktop launcher for Disenyorita Portal on Windows
.DESCRIPTION
    Manages the Disenyorita Portal application using Docker Desktop.
    Supports starting, stopping, viewing logs, and rebuilding containers.
.PARAMETER Command
    The command to execute: up, down, logs, rebuild, status, clean
.EXAMPLE
    .\docker-launch.ps1 up
    Starts the application in detached mode
.EXAMPLE
    .\docker-launch.ps1 logs
    Shows logs from all containers
.EXAMPLE
    .\docker-launch.ps1 rebuild
    Rebuilds and restarts all containers
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet('up', 'down', 'logs', 'rebuild', 'status', 'clean', 'help')]
    [string]$Command = 'help'
)

$ErrorActionPreference = 'Stop'

function Write-Banner {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║     Disenyorita Portal - Docker Desktop Launcher          ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Test-DockerDesktop {
    Write-Host "[INFO] Checking Docker Desktop status..." -ForegroundColor Yellow
    try {
        $dockerVersion = docker --version 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "Docker command failed"
        }
        Write-Host "[OK] Docker Desktop is installed: $dockerVersion" -ForegroundColor Green

        # Check if Docker daemon is running
        docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Docker Desktop is not running!" -ForegroundColor Red
            Write-Host "[INFO] Please start Docker Desktop and try again." -ForegroundColor Yellow
            exit 1
        }
        Write-Host "[OK] Docker daemon is running" -ForegroundColor Green

        # Check docker-compose
        $composeVersion = docker compose version 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARNING] Docker Compose plugin not found, trying docker-compose..." -ForegroundColor Yellow
            $composeVersion = docker-compose --version 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[ERROR] Docker Compose is not available!" -ForegroundColor Red
                exit 1
            }
        }
        Write-Host "[OK] Docker Compose is available: $composeVersion" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "[ERROR] Docker Desktop is not installed or not accessible!" -ForegroundColor Red
        Write-Host "[INFO] Please install Docker Desktop from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        return $false
    }
}

function Start-Application {
    Write-Host "[INFO] Starting Disenyorita Portal..." -ForegroundColor Yellow

    # Check for .env files
    if (-not (Test-Path ".env")) {
        Write-Host "[WARNING] No .env file found in root directory" -ForegroundColor Yellow
        Write-Host "[INFO] Using default environment variables" -ForegroundColor Yellow
    }

    # Build and start containers
    Write-Host "[INFO] Building and starting containers (this may take a few minutes on first run)..." -ForegroundColor Yellow
    docker compose up -d --build

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[SUCCESS] Application started successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Access the application at:" -ForegroundColor Cyan
        Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
        Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
        Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor White
        Write-Host ""
        Write-Host "Useful commands:" -ForegroundColor Cyan
        Write-Host "  View logs:    .\docker-launch.ps1 logs" -ForegroundColor White
        Write-Host "  Stop:         .\docker-launch.ps1 down" -ForegroundColor White
        Write-Host "  View status:  .\docker-launch.ps1 status" -ForegroundColor White
        Write-Host ""
    }
    else {
        Write-Host "[ERROR] Failed to start application!" -ForegroundColor Red
        Write-Host "[INFO] Check the logs with: .\docker-launch.ps1 logs" -ForegroundColor Yellow
        exit 1
    }
}

function Stop-Application {
    Write-Host "[INFO] Stopping Disenyorita Portal..." -ForegroundColor Yellow
    docker compose down

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[SUCCESS] Application stopped successfully!" -ForegroundColor Green
    }
    else {
        Write-Host "[ERROR] Failed to stop application!" -ForegroundColor Red
        exit 1
    }
}

function Show-Logs {
    Write-Host "[INFO] Showing application logs (Ctrl+C to exit)..." -ForegroundColor Yellow
    Write-Host ""
    docker compose logs -f
}

function Rebuild-Application {
    Write-Host "[INFO] Rebuilding Disenyorita Portal..." -ForegroundColor Yellow
    docker compose down
    docker compose build --no-cache
    docker compose up -d

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[SUCCESS] Application rebuilt and started successfully!" -ForegroundColor Green
    }
    else {
        Write-Host "[ERROR] Failed to rebuild application!" -ForegroundColor Red
        exit 1
    }
}

function Show-Status {
    Write-Host "[INFO] Current container status:" -ForegroundColor Yellow
    Write-Host ""
    docker compose ps
    Write-Host ""
    Write-Host "[INFO] Docker resource usage:" -ForegroundColor Yellow
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

function Clean-Application {
    Write-Host "[WARNING] This will remove all containers, images, and volumes!" -ForegroundColor Red
    $confirm = Read-Host "Are you sure you want to continue? (yes/no)"

    if ($confirm -eq 'yes') {
        Write-Host "[INFO] Cleaning up Docker resources..." -ForegroundColor Yellow
        docker compose down -v --rmi all
        Write-Host "[SUCCESS] Cleanup completed!" -ForegroundColor Green
    }
    else {
        Write-Host "[INFO] Cleanup cancelled." -ForegroundColor Yellow
    }
}

function Show-Help {
    Write-Host "Usage: .\docker-launch.ps1 <command>" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  up       - Start the application in detached mode" -ForegroundColor White
    Write-Host "  down     - Stop and remove containers" -ForegroundColor White
    Write-Host "  logs     - Show and follow application logs" -ForegroundColor White
    Write-Host "  rebuild  - Rebuild containers from scratch and restart" -ForegroundColor White
    Write-Host "  status   - Show container status and resource usage" -ForegroundColor White
    Write-Host "  clean    - Remove all containers, images, and volumes" -ForegroundColor White
    Write-Host "  help     - Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\docker-launch.ps1 up" -ForegroundColor White
    Write-Host "  .\docker-launch.ps1 logs" -ForegroundColor White
    Write-Host "  .\docker-launch.ps1 down" -ForegroundColor White
    Write-Host ""
}

# Main execution
Write-Banner

# Check Docker Desktop availability (except for help command)
if ($Command -ne 'help') {
    if (-not (Test-DockerDesktop)) {
        exit 1
    }
    Write-Host ""
}

# Execute command
switch ($Command) {
    'up' {
        Start-Application
    }
    'down' {
        Stop-Application
    }
    'logs' {
        Show-Logs
    }
    'rebuild' {
        Rebuild-Application
    }
    'status' {
        Show-Status
    }
    'clean' {
        Clean-Application
    }
    'help' {
        Show-Help
    }
}
