# Membuat aset grafis installer LaundryKu (NSIS header/sidebar dan WiX
# banner/dialog). Jalankan dari PowerShell di Windows:
#   powershell -NoProfile -ExecutionPolicy Bypass -File src-tauri/installer/generate-assets.ps1
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outDir = $PSScriptRoot
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$icon = [System.Drawing.Image]::FromFile((Join-Path $root "icons\icon-source.png"))
$appVersion = (Get-Content (Join-Path $root "tauri.conf.json") -Raw | ConvertFrom-Json).version

$cyan500 = [System.Drawing.Color]::FromArgb(6, 182, 212)
$cyan600 = [System.Drawing.Color]::FromArgb(8, 145, 178)
$cyan700 = [System.Drawing.Color]::FromArgb(14, 116, 144)
$teal600 = [System.Drawing.Color]::FromArgb(13, 148, 136)
$deep = [System.Drawing.Color]::FromArgb(21, 94, 117)
$ink = [System.Drawing.Color]::FromArgb(15, 23, 42)
$slate = [System.Drawing.Color]::FromArgb(100, 116, 139)
$muted = [System.Drawing.Color]::FromArgb(148, 163, 184)
$white = [System.Drawing.Color]::White

function New-Canvas([int]$w, [int]$h, [System.Drawing.Color]$bg) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.Clear($bg)
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Preview($canvas, [string]$name) {
  $path = Join-Path $outDir $name
  $width = $canvas.Bitmap.Width
  $height = $canvas.Bitmap.Height
  $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $preview = Join-Path $env:TEMP ("laundryku-preview-" + [System.IO.Path]::GetFileNameWithoutExtension($name) + ".png")
  $canvas.Bitmap.Save($preview, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
  Write-Output ("{0} -> {1}x{2} ({3:N0} bytes)" -f $path, $width, $height, (Get-Item $path).Length)
}

function New-RoundedPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-Font([single]$size, [System.Drawing.FontStyle]$style) {
  return New-Object System.Drawing.Font("Segoe UI", $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-TextFormat([string]$align = "Near") {
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::$align
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Near
  return $fmt
}

function Fill-Gradient($g, [System.Drawing.Rectangle]$rect, $from, $to, [single]$angle) {
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $from, $to, $angle)
  $g.FillRectangle($brush, $rect)
  $brush.Dispose()
}

# ---------------------------------------------------------------------------
# NSIS header 150x57
# ---------------------------------------------------------------------------
$c = New-Canvas 150 57 $white
$g = $c.Graphics
Fill-Gradient $g ([System.Drawing.Rectangle]::new(0, 52, 150, 5)) $cyan600 $teal600 0
$g.DrawImage($icon, [System.Drawing.Rectangle]::new(7, 9, 34, 34))

$fTitle = New-Font 14 ([System.Drawing.FontStyle]::Bold)
$fSub = New-Font 8 ([System.Drawing.FontStyle]::Regular)
$bTitle = New-Object System.Drawing.SolidBrush($cyan700)
$bSub = New-Object System.Drawing.SolidBrush($slate)
$g.DrawString("LaundryKu", $fTitle, $bTitle, 46, 8)
$g.DrawString("Manajemen keuangan", $fSub, $bSub, 47, 27)
$bTitle.Dispose(); $bSub.Dispose(); $fTitle.Dispose(); $fSub.Dispose()
Save-Preview $c "nsis-header.bmp"
$c = $null

# ---------------------------------------------------------------------------
# NSIS sidebar 164x314
# ---------------------------------------------------------------------------
$c = New-Canvas 164 314 $cyan600
$g = $c.Graphics
Fill-Gradient $g ([System.Drawing.Rectangle]::new(0, 0, 164, 314)) $cyan500 $deep 60

$soft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26, 255, 255, 255))
$g.FillEllipse($soft, -55, -60, 180, 180)
$g.FillEllipse($soft, 96, 224, 130, 130)
$soft.Dispose()

$cardPath = New-RoundedPath 33 34 98 98 26
$cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(240, 255, 255, 255))
$g.FillPath($cardBrush, $cardPath)
$cardBrush.Dispose()
$cardPath.Dispose()
$g.DrawImage($icon, [System.Drawing.Rectangle]::new(43, 44, 78, 78))

$center = New-TextFormat "Center"
$fBrand = New-Font 20 ([System.Drawing.FontStyle]::Bold)
$fTag = New-Font 9 ([System.Drawing.FontStyle]::Regular)
$fSmall = New-Font 8 ([System.Drawing.FontStyle]::Regular)
$bWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255))
$bTag = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(225, 255, 255))
$bFaint = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(160, 255, 255))

$g.DrawString("LaundryKu", $fBrand, $bWhite, [System.Drawing.RectangleF]::new(0, 150, 164, 30), $center)
$g.DrawString("Kelola laundry, catat kas,", $fTag, $bTag, [System.Drawing.RectangleF]::new(6, 187, 152, 14), $center)
$g.DrawString("tanpa ribet.", $fTag, $bTag, [System.Drawing.RectangleF]::new(6, 200, 152, 14), $center)

$linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 255, 255, 255), 1)
$g.DrawLine($linePen, 30, 236, 134, 236)
$linePen.Dispose()

$g.DrawString("Versi $appVersion", $fSmall, $bFaint, [System.Drawing.RectangleF]::new(6, 250, 152, 14), $center)
$g.DrawString("Data tersimpan lokal", $fSmall, $bFaint, [System.Drawing.RectangleF]::new(6, 265, 152, 14), $center)

$bWhite.Dispose(); $bTag.Dispose(); $bFaint.Dispose()
$fBrand.Dispose(); $fTag.Dispose(); $fSmall.Dispose(); $center.Dispose()
Save-Preview $c "nsis-sidebar.bmp"
$c = $null

# ---------------------------------------------------------------------------
# WiX banner 493x58
# ---------------------------------------------------------------------------
$c = New-Canvas 493 58 $white
$g = $c.Graphics
Fill-Gradient $g ([System.Drawing.Rectangle]::new(0, 54, 493, 4)) $cyan600 $teal600 0
$g.DrawImage($icon, [System.Drawing.Rectangle]::new(12, 9, 40, 40))

$fTitle = New-Font 20 ([System.Drawing.FontStyle]::Bold)
$fSub = New-Font 9.5 ([System.Drawing.FontStyle]::Regular)
$fSmall = New-Font 8.5 ([System.Drawing.FontStyle]::Regular)
$bTitle = New-Object System.Drawing.SolidBrush($cyan700)
$bSub = New-Object System.Drawing.SolidBrush($slate)
$bMuted = New-Object System.Drawing.SolidBrush($muted)
$right = New-TextFormat "Far"

$g.DrawString("LaundryKu", $fTitle, $bTitle, 61, 7)
$g.DrawString("Manajemen keuangan usaha laundry - offline-first", $fSub, $bSub, 62, 34)
$g.DrawString("Versi $appVersion", $fSmall, $bMuted, [System.Drawing.RectangleF]::new(390, 21, 90, 14), $right)

$bTitle.Dispose(); $bSub.Dispose(); $bMuted.Dispose()
$fTitle.Dispose(); $fSub.Dispose(); $fSmall.Dispose(); $right.Dispose()
Save-Preview $c "wix-banner.bmp"
$c = $null

# ---------------------------------------------------------------------------
# WiX dialog 493x312
# ---------------------------------------------------------------------------
$c = New-Canvas 493 312 $cyan600
$g = $c.Graphics
Fill-Gradient $g ([System.Drawing.Rectangle]::new(0, 0, 493, 312)) $cyan500 $deep 35

$soft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(24, 255, 255, 255))
$g.FillEllipse($soft, -110, -120, 340, 340)
$g.FillEllipse($soft, 330, 190, 260, 260)
$soft.Dispose()

$cardPath = New-RoundedPath 46 38 150 150 36
$cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(242, 255, 255, 255))
$g.FillPath($cardBrush, $cardPath)
$cardBrush.Dispose()
$cardPath.Dispose()
$g.DrawImage($icon, [System.Drawing.Rectangle]::new(62, 54, 118, 118))

$fBrand = New-Font 32 ([System.Drawing.FontStyle]::Bold)
$fTag = New-Font 12.5 ([System.Drawing.FontStyle]::Regular)
$fSmall = New-Font 9.5 ([System.Drawing.FontStyle]::Regular)
$bWhite = New-Object System.Drawing.SolidBrush($white)
$bTag = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(225, 255, 255))
$bFaint = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(175, 255, 255))
$right = New-TextFormat "Far"

$g.DrawString("LaundryKu", $fBrand, $bWhite, 46, 204)
$g.DrawString("Kelola laundry, catat kas, tanpa ribet.", $fTag, $bTag, 48, 248)
$g.DrawString("Data tersimpan lokal di perangkat Anda", $fSmall, $bFaint, 48, 271)
$g.DrawString("Versi $appVersion", $fSmall, $bFaint, [System.Drawing.RectangleF]::new(340, 271, 105, 14), $right)

$bWhite.Dispose(); $bTag.Dispose(); $bFaint.Dispose()
$fBrand.Dispose(); $fTag.Dispose(); $fSmall.Dispose(); $right.Dispose()
Save-Preview $c "wix-dialog.bmp"

$icon.Dispose()
Write-Output "Selesai."
