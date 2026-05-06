"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export function BackButton({ fallback = "/characters" }: { fallback?: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back()
        } else {
          router.push(fallback)
        }
      }}
      className="quiet-button rounded-full"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to characters
    </button>
  )
}
