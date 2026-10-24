# Gera os ícones PNG do PWA a partir das mesmas formas e cores de icons/icon.svg
Add-Type -AssemblyName System.Drawing
$raiz = Split-Path $PSScriptRoot -Parent

function Gerar([int]$tam, [string]$arquivo) {
  $bmp = New-Object System.Drawing.Bitmap $tam, $tam
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  # visual Blocos (v2.0): fundo claro #f3f2ee e quatro blocos na grade 20x20 do SVG
  $g.Clear([System.Drawing.Color]::FromArgb(243, 242, 238))
  $u = $tam / 20.0
  $cores = @(@(28, 31, 35, 5.5, 5.5), @(217, 227, 207, 10.25, 5.5), @(239, 227, 204, 5.5, 10.25), @(211, 226, 238, 10.25, 10.25))
  foreach ($c in $cores) {
    $pincel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($c[0], $c[1], $c[2]))
    $g.FillRectangle($pincel, [float]($c[3] * $u), [float]($c[4] * $u), [float](4.25 * $u), [float](4.25 * $u))
    $pincel.Dispose()
  }
  $bmp.Save((Join-Path $raiz "icons\$arquivo"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Gerar 192 'icon-192.png'
Gerar 512 'icon-512.png'
Gerar 180 'apple-touch-icon.png'
