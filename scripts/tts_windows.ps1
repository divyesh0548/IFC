param()

$Text = $env:TTS_TEXT
$OutFile = $env:TTS_OUT

Write-Host "OutFile: $OutFile"
Write-Host "Text: $Text"

Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 1
$s.SetOutputToWaveFile($OutFile)
$s.Speak($Text)
$s.Dispose()