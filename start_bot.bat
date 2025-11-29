@echo off
title Tidal Downloader Bot
cd /d "%~dp0"

echo Checking for updates and installing dependencies...
call yarn install

echo Starting Tidal Downloader Bot...
call yarn start

pause