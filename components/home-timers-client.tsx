"use client"

import React, { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"

function getNextUtcTime(hour: number, minute = 0, second = 0) {
  const now = new Date()
  const next = new Date(now)
  next.setUTCHours(hour, minute, second, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

function formatLocalTime(date: Date) {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(() => targetDate.getTime() - new Date().getTime())
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(targetDate.getTime() - new Date().getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate])
  const totalSeconds = Math.max(0, Math.floor(timeLeft / 1000))
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
  const seconds = String(totalSeconds % 60).padStart(2, "0")
  return `${hours}:${minutes}:${seconds}`
}

const timerRegionOptions = [
  { key: "NA", label: "NA", reset: { hour: 11, minute: 0 }, update: { hour: 2, minute: 0 } },
  { key: "EU", label: "EU", reset: { hour: 4, minute: 0 }, update: { hour: 2, minute: 0 } },
  { key: "Asia", label: "Asia", reset: { hour: 19, minute: 0 }, update: { hour: 2, minute: 0 } },
]

export default function HomeTimersClient() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [timerRegion, setTimerRegion] = useState(timerRegionOptions[0])
  const [resetTarget, setResetTarget] = useState(() => getNextUtcTime(timerRegionOptions[0].reset.hour, timerRegionOptions[0].reset.minute, 0))
  const [updateTarget, setUpdateTarget] = useState(() => getNextUtcTime(timerRegionOptions[0].update.hour, timerRegionOptions[0].update.minute, 0))

  useEffect(() => {
    setResetTarget(getNextUtcTime(timerRegion.reset.hour, timerRegion.reset.minute, 0))
    setUpdateTarget(getNextUtcTime(timerRegion.update.hour, timerRegion.update.minute, 0))
  }, [timerRegion])

  const resetCountdown = useCountdown(resetTarget)
  const updateCountdown = useCountdown(updateTarget)
  const resetLocal = formatLocalTime(resetTarget)
  const updateLocal = formatLocalTime(updateTarget)

  return (
    <Card className="bg-[#181f2a]/80 border border-gray-700/50 backdrop-blur-sm h-full">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="h-1 w-6 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"></span>
            TIMERS
          </h2>
          <div className="flex gap-2">
            {timerRegionOptions.map((opt) => (
              <button
                key={opt.key}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  timerRegion.key === opt.key
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-[#232c3a] text-gray-400 hover:text-white hover:bg-[#2a3444]'
                }`}
                onClick={() => setTimerRegion(opt)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-[#232c3a] to-[#1a222d] rounded-xl p-5 border border-gray-700/30">
            <span className="text-gray-400 text-sm font-medium mb-1 block">Daily Reset</span>
            <span className="text-gray-500 text-xs mb-3 block">{mounted ? resetLocal : "--"}</span>
            <span className="text-4xl font-mono font-bold text-white tracking-wider">{mounted ? resetCountdown : "--:--:--"}</span>
          </div>
          <div className="bg-gradient-to-br from-[#232c3a] to-[#1a222d] rounded-xl p-5 border border-gray-700/30">
            <span className="text-gray-400 text-sm font-medium mb-1 block">Weekly Update</span>
            <span className="text-gray-500 text-xs mb-3 block">{mounted ? updateLocal : "--"}</span>
            <span className="text-4xl font-mono font-bold text-white tracking-wider">{mounted ? updateCountdown : "--:--:--"}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
