Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$outDir = Join-Path $projectRoot "public\ui\slime"
$sourceDir = Join-Path $outDir "source"
$previewDir = Join-Path $outDir "previews"
$generatedDir = "C:\Users\Angel105\.codex\generated_images\019e6379-e184-71d1-a390-6f5922e06eb3"

New-Item -ItemType Directory -Force -Path $outDir, $sourceDir, $previewDir | Out-Null

$aiSources = [ordered]@{
  nav = Join-Path $generatedDir "ig_0912f6f4d31b4c9c016a15626bd7d881918f7b808db6f73b95.png"
  hero = Join-Path $generatedDir "ig_0912f6f4d31b4c9c016a1562bb731881918f11f59866be8246.png"
  drawer = Join-Path $generatedDir "ig_0912f6f4d31b4c9c016a1562f94af08191949b59da04aade10.png"
  tileSheet = Join-Path $generatedDir "ig_0912f6f4d31b4c9c016a15634a226c8191970443898516ee81.png"
  trigger = Join-Path $generatedDir "ig_0912f6f4d31b4c9c016a156384fa188191a1374a07f2a58693.png"
}

function New-ArgbBitmap {
  param([int]$Width, [int]$Height)
  return [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function Test-ChromaGreen {
  param([System.Drawing.Color]$Pixel)
  return ($Pixel.G -ge 150 -and $Pixel.R -le 95 -and $Pixel.B -le 95)
}

function Get-NonGreenBounds {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$MinX = 0,
    [int]$MaxX = -1
  )

  if ($MaxX -lt 0) {
    $MaxX = $Bitmap.Width - 1
  }

  $minFoundX = $Bitmap.Width
  $minFoundY = $Bitmap.Height
  $maxFoundX = -1
  $maxFoundY = -1

  for ($y = 0; $y -lt $Bitmap.Height; $y++) {
    for ($x = $MinX; $x -le $MaxX; $x++) {
      $px = $Bitmap.GetPixel($x, $y)
      if (-not (Test-ChromaGreen $px)) {
        if ($x -lt $minFoundX) { $minFoundX = $x }
        if ($y -lt $minFoundY) { $minFoundY = $y }
        if ($x -gt $maxFoundX) { $maxFoundX = $x }
        if ($y -gt $maxFoundY) { $maxFoundY = $y }
      }
    }
  }

  if ($maxFoundX -lt 0) {
    throw "No non-green pixels found."
  }

  return [System.Drawing.Rectangle]::FromLTRB($minFoundX, $minFoundY, $maxFoundX + 1, $maxFoundY + 1)
}

function Expand-Rect {
  param(
    [System.Drawing.Rectangle]$Rect,
    [int]$Padding,
    [int]$MaxWidth,
    [int]$MaxHeight
  )

  $left = [Math]::Max(0, $Rect.Left - $Padding)
  $top = [Math]::Max(0, $Rect.Top - $Padding)
  $right = [Math]::Min($MaxWidth, $Rect.Right + $Padding)
  $bottom = [Math]::Min($MaxHeight, $Rect.Bottom + $Padding)
  return [System.Drawing.Rectangle]::FromLTRB($left, $top, $right, $bottom)
}

function Save-Crop {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [System.Drawing.Rectangle]$Rect,
    [string]$OutPath
  )

  $crop = $Bitmap.Clone($Rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $crop.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
}

function Save-Slice {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [string]$OutPath
  )

  Save-Crop $Bitmap ([System.Drawing.Rectangle]::new($X, $Y, $Width, $Height)) $OutPath
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
      if (Test-ChromaGreen $px) {
        $transparent.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
      } else {
        $transparent.SetPixel($x, $y, $px)
      }
    }
  }
  $transparent.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  return $transparent
}

function Copy-SingleSource {
  param(
    [string]$Name,
    [string]$InputPath,
    [int]$Padding = 12
  )

  $source = [System.Drawing.Bitmap]::new((Resolve-Path $InputPath).Path)
  try {
    $bounds = Expand-Rect (Get-NonGreenBounds $source) $Padding $source.Width $source.Height
    $outPath = Join-Path $sourceDir "$Name-source-green.png"
    Save-Crop $source $bounds $outPath
    return $outPath
  } finally {
    $source.Dispose()
  }
}

function Copy-TileSheetSources {
  param([string]$InputPath)

  $source = [System.Drawing.Bitmap]::new((Resolve-Path $InputPath).Path)
  try {
    $occupied = @()
    for ($x = 0; $x -lt $source.Width; $x++) {
      $hasPixels = $false
      for ($y = 0; $y -lt $source.Height; $y += 2) {
        if (-not (Test-ChromaGreen ($source.GetPixel($x, $y)))) {
          $hasPixels = $true
          break
        }
      }
      if ($hasPixels) {
        $occupied += $x
      }
    }

    $runs = @()
    if ($occupied.Count -eq 0) {
      throw "No tile-sheet assets found."
    }

    $start = $occupied[0]
    $prev = $occupied[0]
    foreach ($x in $occupied[1..($occupied.Count - 1)]) {
      if ($x -gt ($prev + 16)) {
        if (($prev - $start) -gt 80) {
          $runs += [pscustomobject]@{ Start = $start; End = $prev }
        }
        $start = $x
      }
      $prev = $x
    }
    if (($prev - $start) -gt 80) {
      $runs += [pscustomobject]@{ Start = $start; End = $prev }
    }

    if ($runs.Count -lt 2) {
      throw "Expected two separate tile-sheet assets, found $($runs.Count)."
    }

    $wide = $runs | Sort-Object { $_.End - $_.Start } -Descending | Select-Object -First 1
    $narrow = $runs | Sort-Object { $_.End - $_.Start } | Select-Object -First 1

    $tileBounds = Expand-Rect (Get-NonGreenBounds $source $wide.Start $wide.End) 12 $source.Width $source.Height
    $thumbBounds = Expand-Rect (Get-NonGreenBounds $source $narrow.Start $narrow.End) 12 $source.Width $source.Height

    $tilePath = Join-Path $sourceDir "tile-frame-source-green.png"
    $thumbPath = Join-Path $sourceDir "thumb-active-source-green.png"
    $sheetPath = Join-Path $sourceDir "quick-tile-thumb-sheet-source-green.png"
    Copy-Item -LiteralPath $InputPath -Destination $sheetPath -Force
    Save-Crop $source $tileBounds $tilePath
    Save-Crop $source $thumbBounds $thumbPath
    return @{ Tile = $tilePath; Thumb = $thumbPath; Sheet = $sheetPath }
  } finally {
    $source.Dispose()
  }
}

function New-HorizontalSlices {
  param(
    [string]$Name,
    [string]$SourcePath,
    [int]$LeftWidth,
    [int]$RightWidth,
    [int]$CenterSlice = 8,
    [int]$CssHeight,
    [int]$CssLeft,
    [int]$CssRight
  )

  $source = [System.Drawing.Bitmap]::new((Resolve-Path $SourcePath).Path)
  try {
    $previewPath = Join-Path $previewDir "$Name-full-transparent.png"
    $transparent = Convert-GreenToAlpha $source $previewPath
    try {
      $centerX = [Math]::Max($LeftWidth, [int]($transparent.Width * 0.52))
      $centerX = [Math]::Min($centerX, $transparent.Width - $RightWidth - $CenterSlice)
      Save-Slice $transparent 0 0 $LeftWidth $transparent.Height (Join-Path $outDir "$Name-left.png")
      Save-Slice $transparent $centerX 0 $CenterSlice $transparent.Height (Join-Path $outDir "$Name-center-8px.png")
      Save-Slice $transparent ($transparent.Width - $RightWidth) 0 $RightWidth $transparent.Height (Join-Path $outDir "$Name-right.png")
    } finally {
      $transparent.Dispose()
    }
  } finally {
    $source.Dispose()
  }

  return [ordered]@{
    component = $Name
    sliceType = "horizontal-3-slice"
    width = $source.Width
    height = $source.Height
    leftWidth = $LeftWidth
    centerSliceWidth = $CenterSlice
    rightWidth = $RightWidth
    cssHeight = $CssHeight
    cssLeftWidth = $CssLeft
    cssRightWidth = $CssRight
    contentInsetLeft = 24
    contentInsetRight = 24
    contentInsetTop = 14
    contentInsetBottom = 14
    source = "/ui/slime/source/$Name-source-green.png"
    preview = "/ui/slime/previews/$Name-full-transparent.png"
  }
}

function New-NineSlices {
  param(
    [string]$Name,
    [string]$SourcePath,
    [int]$Inset,
    [int]$CssInset,
    [int]$ContentX,
    [int]$ContentY,
    [double]$TopSampleRatio = 0.35,
    [int]$CenterSlice = 8
  )

  $source = [System.Drawing.Bitmap]::new((Resolve-Path $SourcePath).Path)
  try {
    $previewPath = Join-Path $previewDir "$Name-full-transparent.png"
    $transparent = Convert-GreenToAlpha $source $previewPath
    try {
      $w = $transparent.Width
      $h = $transparent.Height
      $sampleX = [Math]::Max($Inset, [int]($w * $TopSampleRatio))
      $sampleX = [Math]::Min($sampleX, $w - $Inset - $CenterSlice)
      $sampleY = [Math]::Max($Inset, [int]($h * 0.52))
      $sampleY = [Math]::Min($sampleY, $h - $Inset - $CenterSlice)
      $centerX = [int](($w - $CenterSlice) / 2)
      $centerY = [int](($h - $CenterSlice) / 2)

      Save-Slice $transparent 0 0 $Inset $Inset (Join-Path $outDir "$Name-top-left.png")
      Save-Slice $transparent $sampleX 0 $CenterSlice $Inset (Join-Path $outDir "$Name-top.png")
      Save-Slice $transparent ($w - $Inset) 0 $Inset $Inset (Join-Path $outDir "$Name-top-right.png")
      Save-Slice $transparent 0 $sampleY $Inset $CenterSlice (Join-Path $outDir "$Name-left.png")
      Save-Slice $transparent $centerX $centerY $CenterSlice $CenterSlice (Join-Path $outDir "$Name-center.png")
      Save-Slice $transparent ($w - $Inset) $sampleY $Inset $CenterSlice (Join-Path $outDir "$Name-right.png")
      Save-Slice $transparent 0 ($h - $Inset) $Inset $Inset (Join-Path $outDir "$Name-bottom-left.png")
      Save-Slice $transparent $sampleX ($h - $Inset) $CenterSlice $Inset (Join-Path $outDir "$Name-bottom.png")
      Save-Slice $transparent ($w - $Inset) ($h - $Inset) $Inset $Inset (Join-Path $outDir "$Name-bottom-right.png")
    } finally {
      $transparent.Dispose()
    }
  } finally {
    $source.Dispose()
  }

  return [ordered]@{
    component = $Name
    sliceType = "9-slice"
    width = $source.Width
    height = $source.Height
    topInset = $Inset
    rightInset = $Inset
    bottomInset = $Inset
    leftInset = $Inset
    centerSliceWidth = $CenterSlice
    centerSliceHeight = $CenterSlice
    cssInset = $CssInset
    contentInsetLeft = $ContentX
    contentInsetRight = $ContentX
    contentInsetTop = $ContentY
    contentInsetBottom = $ContentY
    source = "/ui/slime/source/$Name-source-green.png"
    preview = "/ui/slime/previews/$Name-full-transparent.png"
  }
}

function New-VerticalSlices {
  param(
    [string]$Name,
    [string]$SourcePath,
    [int]$TopHeight,
    [int]$BottomHeight,
    [int]$MiddleSlice = 8,
    [int]$CssTop = 74,
    [int]$CssBottom = 74
  )

  $source = [System.Drawing.Bitmap]::new((Resolve-Path $SourcePath).Path)
  try {
    $previewPath = Join-Path $previewDir "$Name-full-transparent.png"
    $transparent = Convert-GreenToAlpha $source $previewPath
    try {
      $midY = [Math]::Max($TopHeight, [int]($transparent.Height * 0.52))
      $midY = [Math]::Min($midY, $transparent.Height - $BottomHeight - $MiddleSlice)
      Save-Slice $transparent 0 0 $transparent.Width $TopHeight (Join-Path $outDir "$Name-top.png")
      Save-Slice $transparent 0 $midY $transparent.Width $MiddleSlice (Join-Path $outDir "$Name-middle-8px.png")
      Save-Slice $transparent 0 ($transparent.Height - $BottomHeight) $transparent.Width $BottomHeight (Join-Path $outDir "$Name-bottom.png")
    } finally {
      $transparent.Dispose()
    }
  } finally {
    $source.Dispose()
  }

  return [ordered]@{
    component = $Name
    sliceType = "vertical-3-slice"
    width = $source.Width
    height = $source.Height
    topHeight = $TopHeight
    middleSliceHeight = $MiddleSlice
    bottomHeight = $BottomHeight
    cssTopHeight = $CssTop
    cssBottomHeight = $CssBottom
    contentInsetLeft = 10
    contentInsetRight = 10
    contentPaddingTop = 8
    contentPaddingBottom = 8
    source = "/ui/slime/source/$Name-source-green.png"
    preview = "/ui/slime/previews/$Name-full-transparent.png"
  }
}

$navSource = Copy-SingleSource "nav" $aiSources.nav 8
$heroSource = Copy-SingleSource "hero-frame" $aiSources.hero 8
$drawerSource = Copy-SingleSource "drawer-frame" $aiSources.drawer 8
$tileSources = Copy-TileSheetSources $aiSources.tileSheet
$triggerSource = Copy-SingleSource "drawer-trigger" $aiSources.trigger 8

Copy-Item -LiteralPath $navSource -Destination (Join-Path $sourceDir "stats-source-green.png") -Force

$metadata = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  workflow = "AI-drawn source shells, chroma-keyed locally, exported as production slices"
  palette = [ordered]@{
    background = "#030812"
    panel = "#061426"
    accent = "#31efff"
    highlight = "#2de0bc"
    alert = "#ff6d7c"
    chromaKey = "#00ff00"
  }
  sourcePrompts = [ordered]@{
    nav = "AI-drawn horizontal nav shell on #00ff00 chroma background; no baked text/icons/buttons."
    heroFrame = "AI-drawn 9-slice featured/database panel shell on #00ff00 chroma background; clean content fill."
    drawerFrame = "AI-drawn tall drawer/menu panel shell on #00ff00 chroma background; clean iframe/timer content fill."
    tileFrame = "AI-drawn compact quick-access tile shell from source sheet on #00ff00 chroma background."
    thumbActive = "AI-drawn active carousel thumbnail shell from source sheet on #00ff00 chroma background."
    drawerTrigger = "AI-drawn slim vertical trigger shell on #00ff00 chroma background."
  }
  assets = @(
    (New-HorizontalSlices "nav" $navSource 310 310 8 76 150 150),
    (New-HorizontalSlices "stats" (Join-Path $sourceDir "stats-source-green.png") 170 170 8 82 76 76),
    (New-NineSlices "hero-frame" $heroSource 126 54 66 58 0.34),
    (New-NineSlices "tile-frame" $tileSources.Tile 102 30 42 36 0.42),
    (New-NineSlices "thumb-active" $tileSources.Thumb 86 18 18 18 0.42),
    (New-NineSlices "drawer-frame" $drawerSource 110 52 62 58 0.36),
    (New-VerticalSlices "drawer-trigger" $triggerSource 190 190 8 74 74)
  )
}

$metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outDir "slice-metadata.json") -Encoding UTF8

Write-Host "Processed AI-drawn SLIME.WIKI UI assets into $outDir"
