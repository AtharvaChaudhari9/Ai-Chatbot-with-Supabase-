@echo off
setlocal enabledelayedexpansion

:: Change directory to repository root
cd /d "%~dp0.."

:: Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Git is not installed or not in your PATH.
    exit /b 1
)

:: Prompt for commit message
set /p commit_msg="Enter commit message (Press Enter for 'Auto-update', or type 'exit' to abort): "

:: Check if user wants to abort
if /i "%commit_msg%"=="exit" goto abort

:: If user inputs nothing, set default message
if "%commit_msg%"=="" (
    set "commit_msg=Auto-update"
)

echo.
echo Staging all changes (git add .)...
git add .

echo.
echo Committing changes (git commit -m "%commit_msg%")...
git commit -m "%commit_msg%"

echo.
echo Pushing to GitHub (git push origin main)...
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ==============================================================
    echo Success! Changes pushed to GitHub.
    echo GitHub Actions CI/CD has been triggered.
    echo You can check the progress under the 'Actions' tab of your repo.
    echo ==============================================================
) else (
    echo.
    echo Error: Push failed. Please check your git status or credentials.
)

goto end

:abort
echo.
echo Deployment aborted. No changes staged or pushed.

:end
endlocal

