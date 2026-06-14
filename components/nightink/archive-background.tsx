"use client"

import { useEffect, useRef } from "react"

function randFrom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let next = Math.imul(value ^ (value >>> 15), value | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

const rgba = (r: number, g: number, b: number, a: number) => `rgba(${r}, ${g}, ${b}, ${a})`

function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: (alpha: number) => string,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, color(0.2))
  gradient.addColorStop(0.5, color(0.055))
  gradient.addColorStop(1, color(0))
  ctx.fillStyle = gradient
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, rand: () => number) {
  const grid = Math.max(72, Math.round(width / 34))
  const offsetX = Math.floor(rand() * grid)
  const offsetY = Math.floor(rand() * grid)

  ctx.save()
  ctx.lineWidth = 1
  ctx.strokeStyle = rgba(126, 168, 210, 0.026)
  for (let x = offsetX; x < width; x += grid) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  ctx.strokeStyle = rgba(236, 228, 212, 0.018)
  for (let y = offsetY; y < height; y += grid) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  ctx.restore()
}

function drawScratch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  angle: number,
  color: string,
  width: number,
  bend: number,
) {
  const endX = x + Math.cos(angle) * length
  const endY = y + Math.sin(angle) * length
  const midX = (x + endX) / 2 + Math.cos(angle + Math.PI / 2) * bend
  const midY = (y + endY) / 2 + Math.sin(angle + Math.PI / 2) * bend

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(midX, midY, endX, endY)
  ctx.stroke()
  ctx.restore()
}

function drawHalftone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: (alpha: number) => string,
  rand: () => number,
) {
  const step = Math.max(8, radius / 20)
  for (let x = cx - radius; x <= cx + radius; x += step) {
    for (let y = cy - radius; y <= cy + radius; y += step) {
      const dx = x - cx
      const dy = y - cy
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > radius || rand() < 0.36) continue

      const falloff = 1 - distance / radius
      const dot = Math.max(0.45, step * (0.12 + falloff * 0.18) * (0.7 + rand() * 0.8))
      ctx.fillStyle = color((0.025 + falloff * 0.07) * (0.65 + rand() * 0.7))
      ctx.beginPath()
      ctx.arc(x + (rand() - 0.5) * 2, y + (rand() - 0.5) * 2, dot, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawDiagram(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rand: () => number,
  side: "left" | "right",
  color: (alpha: number) => string,
) {
  const isLeft = side === "left"
  const cx = width * (isLeft ? 0.18 + rand() * 0.08 : 0.82 + rand() * 0.08)
  const cy = height * (0.2 + rand() * 0.64)
  const radius = Math.min(width, height) * (0.1 + rand() * 0.08)

  ctx.save()
  ctx.strokeStyle = color(0.055)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, radius, rand() * Math.PI, Math.PI * (1.15 + rand() * 0.65))
  ctx.stroke()

  ctx.strokeStyle = color(0.035)
  for (let i = 0; i < 5; i += 1) {
    const angle = rand() * Math.PI * 2
    const x = cx + Math.cos(angle) * radius * (0.35 + rand() * 0.8)
    const y = cy + Math.sin(angle) * radius * (0.35 + rand() * 0.8)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  ctx.restore()
}

function drawEdgeCluster(ctx: CanvasRenderingContext2D, width: number, height: number, rand: () => number, side: "left" | "right") {
  const isLeft = side === "left"
  const hue = isLeft ? (alpha: number) => rgba(67, 136, 206, alpha) : (alpha: number) => rgba(218, 65, 55, alpha)
  const pale = (alpha: number) => rgba(236, 228, 212, alpha)
  const xMin = isLeft ? -width * 0.04 : width * 0.74
  const xMax = isLeft ? width * 0.24 : width * 1.04
  const angleBase = isLeft ? -0.92 : -0.74

  ctx.save()
  ctx.globalCompositeOperation = "screen"

  for (let i = 0; i < 4; i += 1) {
    const x = xMin + rand() * (xMax - xMin)
    const y = height * (0.08 + rand() * 0.84)
    const radius = Math.min(width, height) * (0.18 + rand() * 0.12)
    drawGlow(ctx, x, y, radius, hue)
  }

  for (let i = 0; i < 3; i += 1) drawDiagram(ctx, width, height, rand, side, hue)

  for (let i = 0; i < 5; i += 1) {
    const x = xMin + rand() * (xMax - xMin)
    const y = height * (0.08 + rand() * 0.84)
    const radius = Math.min(width, height) * (0.08 + rand() * 0.11)
    drawHalftone(ctx, x, y, radius, hue, rand)
  }

  for (let i = 0; i < 54; i += 1) {
    const x = xMin + rand() * (xMax - xMin)
    const y = -height * 0.08 + rand() * height * 1.16
    const length = width * (0.045 + rand() * 0.13)
    const angle = angleBase + (rand() - 0.5) * 0.42
    const alpha = 0.055 + rand() * 0.105
    const color = rand() > 0.2 ? hue(alpha) : pale(alpha * 0.7)
    drawScratch(ctx, x, y, length, angle, color, 1.1 + rand() * 3.2, (rand() - 0.5) * 64)
  }

  for (let i = 0; i < 220; i += 1) {
    const x = xMin + rand() * (xMax - xMin)
    const y = rand() * height
    const radius = 0.45 + rand() * 2.2
    ctx.fillStyle = rand() > 0.18 ? hue(0.05 + rand() * 0.1) : pale(0.03 + rand() * 0.045)
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

export function ArchiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d", { alpha: true })
    if (!canvas || !ctx) return

    let resizeFrame = 0

    const render = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.ceil(rect.width)
      const height = Math.ceil(rect.height)
      const viewportArea = window.innerWidth * window.innerHeight
      const maxRatio = viewportArea > 3200000 ? 1 : 1.25
      const ratio = Math.min(window.devicePixelRatio || 1, maxRatio)

      canvas.width = Math.max(1, Math.ceil(width * ratio))
      canvas.height = Math.max(1, Math.ceil(height * ratio))

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const rand = randFrom(160672 + width * 3 + height * 5)
      drawGrid(ctx, width, height, rand)
      drawEdgeCluster(ctx, width, height, rand, "left")
      drawEdgeCluster(ctx, width, height, rand, "right")
    }

    const requestRender = () => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(render)
    }

    requestRender()
    window.addEventListener("resize", requestRender, { passive: true })

    return () => {
      cancelAnimationFrame(resizeFrame)
      window.removeEventListener("resize", requestRender)
    }
  }, [])

  return <canvas ref={canvasRef} className="archive-bg-canvas" aria-hidden="true" />
}
