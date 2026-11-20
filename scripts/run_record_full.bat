@echo off
set TTS_PROVIDER=command
set TTS_COMMAND=powershell -ExecutionPolicy Bypass -File C:\Divyesh\IFC\IFC_Prisma\scripts\tts_windows.ps1
set BASE=http://localhost
set WIDTH=2560
set HEIGHT=1440
bash scripts/record.sh scripts/flow.mjs output/ifc-demo.mp4