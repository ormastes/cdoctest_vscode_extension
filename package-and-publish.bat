@echo off
setlocal enabledelayedexpansion

echo ========================================
echo VS Code Extension Package and Publish
echo ========================================
echo.

REM Check if vsce is installed
where vsce >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: vsce is not installed globally.
    echo Please install it using: npm install -g @vscode/vsce
    exit /b 1
)

REM Clean previous builds
echo [1/6] Cleaning previous builds...
call npm run clean
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to clean previous builds
    exit /b 1
)
echo Done.
echo.

REM Clean node_modules to fix ELSPROBLEMS
echo [2/6] Cleaning node_modules...
if exist node_modules (
    echo Removing node_modules directory...
    rmdir /s /q node_modules
)
if exist package-lock.json (
    echo Removing package-lock.json...
    del /q package-lock.json
)
echo Done.
echo.

REM Install dependencies fresh
echo [3/6] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)
echo Done.
echo.

REM Compile TypeScript
echo [4/6] Compiling TypeScript...
call npm run compile
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to compile TypeScript
    exit /b 1
)
echo Done.
echo.

REM Package the extension
echo [5/6] Packaging extension...
call npx @vscode/vsce package
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to package extension
    exit /b 1
)
echo Done.
echo.

REM Find the generated .vsix file
for %%f in (*.vsix) do set VSIX_FILE=%%f

if not defined VSIX_FILE (
    echo ERROR: Could not find .vsix file
    exit /b 1
)

echo Package created: %VSIX_FILE%
echo.

REM Ask if user wants to publish
set /p PUBLISH="Do you want to publish to the marketplace? (y/n): "
if /i "%PUBLISH%"=="y" (
    echo.
    echo [6/6] Publishing to VS Code Marketplace...
    call npx @vscode/vsce publish
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to publish extension
        echo Make sure you have a valid Personal Access Token set up.
        echo You can set it using: vsce login ^<publisher-name^>
        exit /b 1
    )
    echo.
    echo ========================================
    echo SUCCESS: Extension published!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Package created successfully!
    echo You can manually install it using:
    echo code --install-extension %VSIX_FILE%
    echo ========================================
)

endlocal
