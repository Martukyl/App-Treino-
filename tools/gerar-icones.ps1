# Gera os ícones PNG do PWA a partir das mesmas formas e cores de icons/icon.svg
Add-Type -AssemblyName System.Drawing
$raiz = Split-Path $PSScriptRoot -Parent

function Gerar([int]$tam, [string]$arquivo) {
  $bmp = New-Object System.Drawing.Bitmap $tam, $tam
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  # fundo em degradê cinza aço (#8d939b → #5d636b → #2d3136)
  $ret = New-Object System.Drawing.Rectangle 0, 0, $tam, $tam
  $aco = New-Object System.Drawing.Drawing2D.LinearGradientBrush $ret, ([System.Drawing.Color]::FromArgb(141, 147, 155)), ([System.Drawing.Color]::FromArgb(45, 49, 54)), 65.0
  $mistura = New-Object System.Drawing.Drawing2D.ColorBlend 3
  $mistura.Colors = @([System.Drawing.Color]::FromArgb(141, 147, 155), [System.Drawing.Color]::FromArgb(93, 99, 107), [System.Drawing.Color]::FromArgb(45, 49, 54))
  $mistura.Positions = @([float]0, [float]0.42, [float]1)
  $aco.InterpolationColors = $mistura
  $g.FillRectangle($aco, $ret)
  # haltere em cobre metálico (brilho no meio, na horizontal)
  $coral = New-Object System.Drawing.Drawing2D.LinearGradientBrush $ret, ([System.Drawing.Color]::FromArgb(147, 73, 31)), ([System.Drawing.Color]::FromArgb(147, 73, 31)), 0.0
  $brilho = New-Object System.Drawing.Drawing2D.ColorBlend 5
  $brilho.Colors = @([System.Drawing.Color]::FromArgb(147, 73, 31), [System.Drawing.Color]::FromArgb(191, 106, 55), [System.Drawing.Color]::FromArgb(234, 162, 116), [System.Drawing.Color]::FromArgb(191, 106, 55), [System.Drawing.Color]::FromArgb(147, 73, 31))
  $brilho.Positions = @([float]0, [float]0.24, [float]0.5, [float]0.76, [float]1)
  $coral.InterpolationColors = $brilho
  $u = $tam / 20.0
  # barra e anilhas na grade 20x20 do SVG
  $g.FillRectangle($coral, [float](6 * $u), [float](9.25 * $u), [float](8 * $u), [float](1.5 * $u))
  $g.FillRectangle($coral, [float](4.5 * $u), [float](7 * $u), [float](1.5 * $u), [float](6 * $u))
  $g.FillRectangle($coral, [float](14 * $u), [float](7 * $u), [float](1.5 * $u), [float](6 * $u))
  $g.FillRectangle($coral, [float](3.5 * $u), [float](8 * $u), [float](1 * $u), [float](4 * $u))
  $g.FillRectangle($coral, [float](15.5 * $u), [float](8 * $u), [float](1 * $u), [float](4 * $u))
  $bmp.Save((Join-Path $raiz "icons\$arquivo"), [System.Drawing.Imaging.ImageFormat]::Png)
  $coral.Dispose(); $aco.Dispose(); $g.Dispose(); $bmp.Dispose()
}

Gerar 192 'icon-192.png'
Gerar 512 'icon-512.png'
Gerar 180 'apple-touch-icon.png'
