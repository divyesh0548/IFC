@echo off
set TTS_PROVIDER=command
set TTS_COMMAND=powershell -ExecutionPolicy Bypass -File C:\Divyesh\IFC\IFC_Prisma\scripts\tts_windows.ps1
node scripts/recorder.mjs scripts/flow.mjs