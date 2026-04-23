Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("public\form.jpg")

# Mobile version
$factor = 600.0 / $img.Width
$newWidth = 600
$newHeight = [int]($img.Height * $factor)
$bmp = New-Object System.Drawing.Bitmap $newWidth, $newHeight
$graph = [System.Drawing.Graphics]::FromImage($bmp)
$graph.DrawImage($img, 0, 0, $newWidth, $newHeight)
$bmp.Save("public\form-mobile.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$graph.Dispose()
$bmp.Dispose()

# Desktop version (2000px max)
$factor = 2000.0 / $img.Width
if ($factor -ge 1) {
    $factor = 1
}
$newWidth = [int]($img.Width * $factor)
$newHeight = [int]($img.Height * $factor)
$bmp = New-Object System.Drawing.Bitmap $newWidth, $newHeight
$graph = [System.Drawing.Graphics]::FromImage($bmp)
$graph.DrawImage($img, 0, 0, $newWidth, $newHeight)
$eps = New-Object System.Drawing.Imaging.EncoderParameters(1)
$eps.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]75)
$ici = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

$bmp.Save("public\form-desktop.jpg", $ici, $eps)
$graph.Dispose()
$bmp.Dispose()
$img.Dispose()
