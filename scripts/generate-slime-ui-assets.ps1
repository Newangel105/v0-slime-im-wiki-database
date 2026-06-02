Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$outDir = Join-Path $projectRoot "public\ui\slime"
$sourceDir = Join-Path $outDir "source"
$previewDir = Join-Path $outDir "previews"

New-Item -ItemType Directory -Force -Path $outDir, $sourceDir, $previewDir | Out-Null

function New-ArgbBitmap {
  param([int]$Width, [int]$Height)
  return [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function New-Color {
  param([string]$Hex, [int]$Alpha = 255)
  $hexValue = $Hex.TrimStart("#")
  $r = [Convert]::ToInt32($hexValue.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($hexValue.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($hexValue.Substring(4, 2), 16)
  return [System.Drawing.Color]::FromArgb($Alpha, $r, $g, $b)
}

function New-PointArray {
  param([object[]]$Pairs)
  $points = New-Object "System.Drawing.Point[]" $Pairs.Count
  for ($i = 0; $i -lt $Pairs.Count; $i++) {
    $points[$i] = [System.Drawing.Point]::new([int]$Pairs[$i][0], [int]$Pairs[$i][1])
  }
  return $points
}

function Add-ChamferPath {
  param(
    [System.Drawing.Drawing2D.GraphicsPath]$Path,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [int]$Chamfer
  )

  $points = New-PointArray @(
    @(($X + $Chamfer), $Y),
    @(($X + $Width - $Chamfer), $Y),
    @(($X + $Width), ($Y + $Chamfer)),
    @(($X + $Width), ($Y + $Height - $Chamfer)),
    @(($X + $Width - $Chamfer), ($Y + $Height)),
    @(($X + $Chamfer), ($Y + $Height)),
    @($X, ($Y + $Height - $Chamfer)),
    @($X, ($Y + $Chamfer))
  )
  $Path.AddPolygon($points)
}

function Convert-GreenToAlpha {
  param(
    [System.Drawing.Bitmap]$Source,
    [string]$OutPath
  )

  $transparent = New-ArgbBitmap $Source.Width $Source.Height
  for ($y = 0; $y -lt $Source.Height; $y++) {
    for ($x = 0; $x -lt $Source.Width; $x++) {
      $px = $Source.GetPixel($x, $y)
      $isKey = ($px.G -ge 236 -and $px.R -le 18 -and $px.B -le 18)
      if ($isKey) {
        $transparent.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
      } else {
        $transparent.SetPixel($x, $y, $px)
      }
    }
  }
  $transparent.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  return $transparent
}

function Save-Crop {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [string]$OutPath
  )

  $rect = [System.Drawing.Rectangle]::new($X, $Y, $Width, $Height)
  $crop = $Bitmap.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $crop.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
}

function Invoke-Graphics {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [scriptblock]$Draw
  )

  $g = [System.Drawing.Graphics]::FromImage($Bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  try {
    & $Draw $g
  } finally {
    $g.Dispose()
  }
}

function Draw-PanelShell {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$Inset,
    [string]$Accent = "#29f3ff",
    [string]$Secondary = "#28d8b8",
    [switch]$Compact
  )

  $green = New-Color "#00ff00"
  $body = New-Color "#081520"
  $bodySoft = New-Color "#0b1b28"
  $rail = New-Color "#123043"
  $accentColor = New-Color $Accent
  $secondaryColor = New-Color $Secondary
  $coral = New-Color "#ff6b7a"

  Invoke-Graphics $Bitmap {
    param($g)

    $g.Clear($green)
    $w = $Bitmap.Width
    $h = $Bitmap.Height
    $chamfer = [Math]::Min([Math]::Max([int]($Inset * 0.68), 16), 38)

    $outer = [System.Drawing.Drawing2D.GraphicsPath]::new()
    Add-ChamferPath $outer 2 2 ($w - 4) ($h - 4) $chamfer
    $g.FillPath([System.Drawing.SolidBrush]::new($body), $outer)

    $inner = [System.Drawing.Drawing2D.GraphicsPath]::new()
    Add-ChamferPath $inner 12 12 ($w - 24) ($h - 24) ([Math]::Max($chamfer - 10, 10))
    $g.DrawPath([System.Drawing.Pen]::new((New-Color "#2df7ff" 82), 5), $inner)
    $g.DrawPath([System.Drawing.Pen]::new((New-Color "#7cfbff" 150), 1), $inner)

    $g.DrawPath([System.Drawing.Pen]::new((New-Color "#39f6ff" 120), 3), $outer)
    $g.DrawPath([System.Drawing.Pen]::new((New-Color "#cfffff" 160), 1), $outer)

    $fillRect = [System.Drawing.Rectangle]::new($Inset, $Inset, $w - ($Inset * 2), $h - ($Inset * 2))
    $g.FillRectangle([System.Drawing.SolidBrush]::new($bodySoft), $fillRect)

    $railPen = [System.Drawing.Pen]::new($rail, 2)
    $railGlow = [System.Drawing.Pen]::new((New-Color "#28e7ff" 54), 5)
    $g.DrawLine($railGlow, $Inset - 14, $Inset + 2, $Inset - 14, $h - $Inset - 2)
    $g.DrawLine($railGlow, $w - $Inset + 14, $Inset + 2, $w - $Inset + 14, $h - $Inset - 2)
    $g.DrawLine($railPen, $Inset - 14, $Inset + 2, $Inset - 14, $h - $Inset - 2)
    $g.DrawLine($railPen, $w - $Inset + 14, $Inset + 2, $w - $Inset + 14, $h - $Inset - 2)

    $capBrush = [System.Drawing.SolidBrush]::new((New-Color "#10283a" 235))
    $dimBrush = [System.Drawing.SolidBrush]::new((New-Color "#07101b" 230))
    $accentPen = [System.Drawing.Pen]::new($accentColor, 2)
    $accentGlow = [System.Drawing.Pen]::new((New-Color $Accent 72), 7)
    $secondaryPen = [System.Drawing.Pen]::new($secondaryColor, 2)

    $corner = [Math]::Max($Inset - 8, 20)
    $g.FillPolygon($capBrush, (New-PointArray @(@(0, 0), @(($corner + 28), 0), @(($corner - 4), 24), @(0, ($corner + 6)))))
    $g.FillPolygon($capBrush, (New-PointArray @(@($w, 0), @(($w - $corner - 28), 0), @(($w - $corner + 4), 24), @($w, ($corner + 6)))))
    $g.FillPolygon($dimBrush, (New-PointArray @(@(0, $h), @(($corner + 28), $h), @(($corner - 4), ($h - 24)), @(0, ($h - $corner - 6)))))
    $g.FillPolygon($dimBrush, (New-PointArray @(@($w, $h), @(($w - $corner - 28), $h), @(($w - $corner + 4), ($h - 24)), @($w, ($h - $corner - 6)))))

    foreach ($mirror in 0, 1) {
      $sx = if ($mirror -eq 0) { 1 } else { -1 }
      $originX = if ($mirror -eq 0) { 18 } else { $w - 18 }
      $g.DrawLine($accentGlow, $originX, 15, $originX + ($sx * 54), 15)
      $g.DrawLine($accentPen, $originX, 15, $originX + ($sx * 54), 15)
      $g.DrawLine($accentPen, $originX + ($sx * 10), 27, $originX + ($sx * 36), 27)
      $g.DrawLine($secondaryPen, $originX, $h - 15, $originX + ($sx * 54), $h - 15)
      $g.DrawLine($secondaryPen, $originX + ($sx * 10), $h - 27, $originX + ($sx * 36), $h - 27)
    }

    if (-not $Compact) {
      $dotBrush = [System.Drawing.SolidBrush]::new($coral)
      $g.FillEllipse($dotBrush, $w - $Inset + 3, 21, 7, 7)
      $g.FillEllipse([System.Drawing.SolidBrush]::new((New-Color "#ff9aa4" 120)), $w - $Inset - 2, 16, 17, 17)
      $g.FillEllipse([System.Drawing.SolidBrush]::new($secondaryColor), $Inset - 10, $h - 29, 5, 5)
    }

    $outer.Dispose()
    $inner.Dispose()
  }
}

function Draw-HorizontalShell {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$LeftWidth,
    [int]$RightWidth,
    [string]$Accent = "#2ff5ff"
  )

  $green = New-Color "#00ff00"
  $body = New-Color "#08131e"
  $accentColor = New-Color $Accent
  $secondaryColor = New-Color "#2be0bb"
  $coral = New-Color "#ff6d7c"

  Invoke-Graphics $Bitmap {
    param($g)

    $g.Clear($green)
    $w = $Bitmap.Width
    $h = $Bitmap.Height
    $chamfer = 20
    $outer = [System.Drawing.Drawing2D.GraphicsPath]::new()
    Add-ChamferPath $outer 2 2 ($w - 4) ($h - 4) $chamfer
    $g.FillPath([System.Drawing.SolidBrush]::new($body), $outer)
    $g.DrawPath([System.Drawing.Pen]::new((New-Color "#38f6ff" 96), 5), $outer)
    $g.DrawPath([System.Drawing.Pen]::new((New-Color "#dfffff" 170), 1), $outer)

    $topPen = [System.Drawing.Pen]::new((New-Color $Accent 190), 2)
    $dimPen = [System.Drawing.Pen]::new((New-Color "#1a5368" 180), 1)
    $g.DrawLine($topPen, $LeftWidth - 2, 10, $w - $RightWidth + 2, 10)
    $g.DrawLine($dimPen, $LeftWidth - 2, $h - 11, $w - $RightWidth + 2, $h - 11)

    $capBrush = [System.Drawing.SolidBrush]::new((New-Color "#10283b" 240))
    $g.FillPolygon($capBrush, (New-PointArray @(@(0, 0), @(105, 0), @(72, 22), @(0, 34))))
    $g.FillPolygon($capBrush, (New-PointArray @(@($w, 0), @(($w - 105), 0), @(($w - 72), 22), @($w, 34))))
    $g.FillPolygon([System.Drawing.SolidBrush]::new((New-Color "#07111c" 235)), (New-PointArray @(@(0, $h), @(124, $h), @(84, ($h - 22)), @(0, ($h - 34)))))
    $g.FillPolygon([System.Drawing.SolidBrush]::new((New-Color "#07111c" 235)), (New-PointArray @(@($w, $h), @(($w - 124), $h), @(($w - 84), ($h - 22)), @($w, ($h - 34)))))

    $glowPen = [System.Drawing.Pen]::new((New-Color $Accent 76), 7)
    $linePen = [System.Drawing.Pen]::new($accentColor, 2)
    $secPen = [System.Drawing.Pen]::new($secondaryColor, 2)
    $g.DrawLine($glowPen, 24, 16, 88, 16)
    $g.DrawLine($linePen, 24, 16, 88, 16)
    $g.DrawLine($linePen, 34, 28, 66, 28)
    $g.DrawLine($secPen, $w - 24, $h - 16, $w - 88, $h - 16)
    $g.DrawLine($secPen, $w - 34, $h - 28, $w - 66, $h - 28)
    $g.FillEllipse([System.Drawing.SolidBrush]::new($coral), $w - 54, 18, 6, 6)

    $outer.Dispose()
  }
}

function Draw-VerticalShell {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$TopHeight,
    [int]$BottomHeight
  )

  $green = New-Color "#00ff00"
  $body = New-Color "#08131e"
  $accent = New-Color "#31efff"
  $secondary = New-Color "#2de0bc"
  $coral = New-Color "#ff6d7c"

  Invoke-Graphics $Bitmap {
    param($g)

    $g.Clear($green)
    $w = $Bitmap.Width
    $h = $Bitmap.Height
    $outer = [System.Drawing.Drawing2D.GraphicsPath]::new()
    Add-ChamferPath $outer 2 2 ($w - 4) ($h - 4) 14
    $g.FillPath([System.Drawing.SolidBrush]::new($body), $outer)
    $g.DrawPath([System.Drawing.Pen]::new((New-Color "#31efff" 86), 5), $outer)
    $g.DrawPath([System.Drawing.Pen]::new((New-Color "#dfffff" 160), 1), $outer)

    $railPen = [System.Drawing.Pen]::new((New-Color "#16475b" 210), 2)
    $g.DrawLine($railPen, 8, $TopHeight - 4, 8, $h - $BottomHeight + 4)
    $g.DrawLine($railPen, $w - 9, $TopHeight - 4, $w - 9, $h - $BottomHeight + 4)

    $g.DrawLine([System.Drawing.Pen]::new($accent, 2), 12, 22, $w - 12, 22)
    $g.DrawLine([System.Drawing.Pen]::new($secondary, 2), 12, $h - 22, $w - 12, $h - 22)
    $g.FillEllipse([System.Drawing.SolidBrush]::new($coral), ($w / 2) - 3, 38, 6, 6)
    $outer.Dispose()
  }
}

function New-NineSliceAsset {
  param(
    [string]$Name,
    [int]$Width,
    [int]$Height,
    [int]$Inset,
    [int]$CenterSlice = 8,
    [switch]$Compact
  )

  $source = New-ArgbBitmap $Width $Height
  Draw-PanelShell $source $Inset -Compact:$Compact
  $sourcePath = Join-Path $sourceDir "$Name-source-green.png"
  $previewPath = Join-Path $previewDir "$Name-full-transparent.png"
  $source.Save($sourcePath, [System.Drawing.Imaging.ImageFormat]::Png)
  $transparent = Convert-GreenToAlpha $source $previewPath

  Save-Crop $transparent 0 0 $Inset $Inset (Join-Path $outDir "$Name-top-left.png")
  Save-Crop $transparent $Inset 0 $CenterSlice $Inset (Join-Path $outDir "$Name-top.png")
  Save-Crop $transparent ($Width - $Inset) 0 $Inset $Inset (Join-Path $outDir "$Name-top-right.png")
  Save-Crop $transparent 0 $Inset $Inset $CenterSlice (Join-Path $outDir "$Name-left.png")
  Save-Crop $transparent $Inset $Inset $CenterSlice $CenterSlice (Join-Path $outDir "$Name-center.png")
  Save-Crop $transparent ($Width - $Inset) $Inset $Inset $CenterSlice (Join-Path $outDir "$Name-right.png")
  Save-Crop $transparent 0 ($Height - $Inset) $Inset $Inset (Join-Path $outDir "$Name-bottom-left.png")
  Save-Crop $transparent $Inset ($Height - $Inset) $CenterSlice $Inset (Join-Path $outDir "$Name-bottom.png")
  Save-Crop $transparent ($Width - $Inset) ($Height - $Inset) $Inset $Inset (Join-Path $outDir "$Name-bottom-right.png")

  $source.Dispose()
  $transparent.Dispose()

  $contentX = if ($Compact) { $Inset + 4 } else { $Inset + 16 }
  $contentY = if ($Compact) { $Inset + 4 } else { $Inset + 12 }

  return [ordered]@{
    component = $Name
    sliceType = "9-slice"
    width = $Width
    height = $Height
    topInset = $Inset
    rightInset = $Inset
    bottomInset = $Inset
    leftInset = $Inset
    centerSliceWidth = $CenterSlice
    centerSliceHeight = $CenterSlice
    contentInsetLeft = $contentX
    contentInsetRight = $contentX
    contentInsetTop = $contentY
    contentInsetBottom = $contentY
    source = "/ui/slime/source/$Name-source-green.png"
    preview = "/ui/slime/previews/$Name-full-transparent.png"
  }
}

function New-HorizontalAsset {
  param(
    [string]$Name,
    [int]$Width,
    [int]$Height,
    [int]$LeftWidth,
    [int]$RightWidth,
    [int]$CenterSlice = 8
  )

  $source = New-ArgbBitmap $Width $Height
  Draw-HorizontalShell $source $LeftWidth $RightWidth
  $sourcePath = Join-Path $sourceDir "$Name-source-green.png"
  $previewPath = Join-Path $previewDir "$Name-full-transparent.png"
  $source.Save($sourcePath, [System.Drawing.Imaging.ImageFormat]::Png)
  $transparent = Convert-GreenToAlpha $source $previewPath

  Save-Crop $transparent 0 0 $LeftWidth $Height (Join-Path $outDir "$Name-left.png")
  Save-Crop $transparent $LeftWidth 0 $CenterSlice $Height (Join-Path $outDir "$Name-center-8px.png")
  Save-Crop $transparent ($Width - $RightWidth) 0 $RightWidth $Height (Join-Path $outDir "$Name-right.png")

  $source.Dispose()
  $transparent.Dispose()

  return [ordered]@{
    component = $Name
    sliceType = "horizontal-3-slice"
    width = $Width
    height = $Height
    leftWidth = $LeftWidth
    centerSliceWidth = $CenterSlice
    rightWidth = $RightWidth
    contentInsetLeft = 24
    contentInsetRight = 24
    contentInsetTop = 14
    contentInsetBottom = 14
    source = "/ui/slime/source/$Name-source-green.png"
    preview = "/ui/slime/previews/$Name-full-transparent.png"
  }
}

function New-VerticalAsset {
  param(
    [string]$Name,
    [int]$Width,
    [int]$Height,
    [int]$TopHeight,
    [int]$BottomHeight,
    [int]$MiddleSlice = 8
  )

  $source = New-ArgbBitmap $Width $Height
  Draw-VerticalShell $source $TopHeight $BottomHeight
  $sourcePath = Join-Path $sourceDir "$Name-source-green.png"
  $previewPath = Join-Path $previewDir "$Name-full-transparent.png"
  $source.Save($sourcePath, [System.Drawing.Imaging.ImageFormat]::Png)
  $transparent = Convert-GreenToAlpha $source $previewPath

  Save-Crop $transparent 0 0 $Width $TopHeight (Join-Path $outDir "$Name-top.png")
  Save-Crop $transparent 0 $TopHeight $Width $MiddleSlice (Join-Path $outDir "$Name-middle-8px.png")
  Save-Crop $transparent 0 ($Height - $BottomHeight) $Width $BottomHeight (Join-Path $outDir "$Name-bottom.png")

  $source.Dispose()
  $transparent.Dispose()

  return [ordered]@{
    component = $Name
    sliceType = "vertical-3-slice"
    width = $Width
    height = $Height
    topHeight = $TopHeight
    middleSliceHeight = $MiddleSlice
    bottomHeight = $BottomHeight
    contentInsetLeft = 10
    contentInsetRight = 10
    contentPaddingTop = 8
    contentPaddingBottom = 8
    source = "/ui/slime/source/$Name-source-green.png"
    preview = "/ui/slime/previews/$Name-full-transparent.png"
  }
}

$metadata = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  palette = [ordered]@{
    background = "#030812"
    panel = "#081520"
    panelRaised = "#0b1b28"
    accent = "#29f3ff"
    highlight = "#28d8b8"
    alert = "#ff6b7a"
    chromaKey = "#00ff00"
  }
  assets = @(
    (New-HorizontalAsset "nav" 980 76 128 128),
    (New-HorizontalAsset "stats" 760 82 54 54),
    (New-NineSliceAsset "hero-frame" 960 540 48),
    (New-NineSliceAsset "tile-frame" 260 156 28 -Compact),
    (New-NineSliceAsset "thumb-active" 108 118 18 -Compact),
    (New-NineSliceAsset "drawer-frame" 760 900 46),
    (New-VerticalAsset "drawer-trigger" 46 320 74 74)
  )
}

$metadataPath = Join-Path $outDir "slice-metadata.json"
$metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $metadataPath -Encoding UTF8

Write-Host "Generated SLIME.WIKI sliced UI assets in $outDir"
