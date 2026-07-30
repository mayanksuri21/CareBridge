@echo off
REM HealthConnect Setup Script for Windows
REM This script helps team members set up the project quickly

echo 🏥 HealthConnect - Team Setup Script
echo ======================================

REM Check if .env.local exists
if exist ".env.local" (
    echo ✅ .env.local already exists
) else (
    echo 📝 Creating .env.local from template...
    copy .env.example .env.local > nul
    echo ⚠️  Please update .env.local with your Supabase credentials!
    echo    Go to: https://supabase.com/dashboard/project/_/settings/api
)

echo.
echo 📦 Installing dependencies...

REM Check for pnpm first, then npm
where pnpm >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    pnpm install
) else (
    where npm >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        npm install
    ) else (
        echo ❌ Neither pnpm nor npm found. Please install Node.js first.
        pause
        exit /b 1
    )
)

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Update .env.local with your Supabase credentials
echo 2. Run 'pnpm dev' to start the development server
echo 3. Open http://localhost:3000 in your browser
echo.
echo Need help? Check the README.md file or ask the team!
pause