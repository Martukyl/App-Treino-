# Gera os ícones PNG do PWA a partir das mesmas formas de icons/icon.svg
Add-Type -AssemblyName System.Drawing
$raiz = Split-Path $PSScriptRoot -Parent

function Gerar([int]$tam, [string]$arquivo) {
  $bmp = New-Object System.Drawing.Bitmap $tam, $tam
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(14, 14, 19))
  $coral = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 92, 122))
  $u = $tam / 20.0
  # barra e anilhas na grade 20x20 do SVG
  $g.FillRectangle($coral, [float](6 * $u), [float](9.25 * $u), [float](8 * $u), [float](1.5 * $u))
  $g.FillRectangle($coral, [float](4.5 * $u), [float](7 * $u), [float](1.5 * $u), [float](6 * $u))
  $g.FillRectangle($coral, [float](14 * $u), [float](7 * $u), [float](1.5 * $u), [float](6 * $u))
  $g.FillRectangle($coral, [float](3.5 * $u), [float](8 * $u), [float](1 * $u), [float](4 * $u))
  $g.FillRectangle($coral, [float](15.5 * $u), [float](8 * $u), [float](1 * $u), [float](4 * $u))
  $bmp.Save((Join-Path $raiz "icons\$arquivo"), [System.Drawing.Imaging.ImageFormat]::Png)
  $coral.Dispose(); $g.Dispose(); $bmp.Dispose()
}

Gerar 192 'icon-192.png'
Gerar 512 'icon-512.png'
Gerar 180 'apple-touch-icon.png'
