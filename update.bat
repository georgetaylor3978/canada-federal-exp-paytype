@echo off
echo =======================================================
echo    Canada Expenses Data Update Script
echo =======================================================
echo.

echo 1. Converting Excel data to JSON...
node update-data.js
if %errorlevel% neq 0 (
    echo.
    echo ❌ Data conversion failed! Please check the error carefully.
    pause
    exit /b %errorlevel%
)
echo.

echo 2. Checking for changes...
git status -s
echo.

echo 3. Staging changes...
git add data.json
git add "CanadaExpPay Raw Data.xlsx"
echo.

echo 4. Committing changes...
git commit -m "Auto-update: Refresh Canada expenses data"
if %errorlevel% neq 0 (
    echo.
    echo ℹ️ No changes needed to commit.
    pause
    exit /b 0
)
echo.

echo 5. Pushing to GitHub...
git push
if %errorlevel% neq 0 (
    echo.
    echo ❌ Push failed! Check your internet connection or git permissions.
    pause
    exit /b %errorlevel%
)

echo.
echo ✅ ALL DONE! Data has been updated and pushed.
echo ⏳ It may take 1-2 minutes for GitHub Pages to reflect the changes.
echo.
pause
