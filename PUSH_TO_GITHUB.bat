@echo off
title MentorMinutes - Push to GitHub
color 0A
echo ======================================================================
echo           MentorMinutes - Push Code to GitHub
echo ======================================================================
echo Repository: https://github.com/patilprajwal14573-cloud/mentorminutes-project
echo.
echo Uploading project files... Please click "Sign in with your browser"
echo if the GitHub authorization window appears!
echo ======================================================================
echo.

"C:\Users\HP\AppData\Local\github-copilot-git-2.56.0-1\cmd\git.exe" push -u origin main

echo.
echo ======================================================================
echo SUCCESS! Your code is now live on GitHub:
echo https://github.com/patilprajwal14573-cloud/mentorminutes-project
echo.
echo Now open Render to activate your live .onrender.com link:
echo https://dashboard.render.com/
echo ======================================================================
pause
