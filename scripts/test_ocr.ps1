Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]

$file = Get-Item "D:\ส่งงาน\น๊อคดาวน์ราคาเซลล์\น็อคดาวน์ราคาเซลล์(ข้อมูลราคา)\ข้อมูลราคา\143300_0.jpg"
Write-Host "File exists: " $file.Exists
Write-Host "Available OCR languages: " ([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Select-Object -ExpandProperty LanguageTag)
