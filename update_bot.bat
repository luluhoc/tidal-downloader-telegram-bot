@echo off
title Update Tidal Downloader Bot
cd /d "%~dp0"

echo Pulling latest changes from Git...
git fetch --all
git reset --hard origin/main

echo Installing dependencies...
call yarn install

echo Done!
pause