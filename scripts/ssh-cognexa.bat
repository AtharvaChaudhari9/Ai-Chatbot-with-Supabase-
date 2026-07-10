@echo off

echo Logging In ...
ssh -F "%~dp0ssh_config.txt" cognexa
