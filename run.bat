@echo off
title MiMo TTS Platform
echo Starting MiMo TTS Platform...

:: Check for .env file
if not exist .env (
    echo [WARNING] .env file not found. 
    echo Please copy .env.example to .env and add your MIMO_API_KEY.
)

:: Run the server
node server.js

pause
