"use client"
import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Gamepad2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"

interface ParsedAnnouncement {
  id: string
  title: string
  category: string
  isNew: boolean
  endDate: string
  href: string
  headerClass: string
  tabCategory: string
  articleType: string
}

interface EventDetail {
  id: number
  title: string
  content: string
}

interface ApiResponse {
  code: number
  message: string
  data: {
    list: ParsedAnnouncement[]
    tabs: { [key: string]: string }
  }
}

interface DetailResponse {
  code: number
  message: string
  data: EventDetail
}

const getCategoryConfig = (headerClass: string, articleType: string) => {
  let bgImage = ""

  if (headerClass.includes("is-yellow")) {
    bgImage = "/events/category-bg_yellow.png"
  } else if (headerClass.includes("is-red")) {
    bgImage = "/events/category-bg_red.png"
  } else if (headerClass.includes("is-green")) {
    bgImage = "/events/category-bg_green.png"
  } else if (headerClass.includes("is-pink") || headerClass.includes("is-magenta")) {
    bgImage = "/events/category-bg_magenta.png"
  } else if (headerClass.includes("is-purple")) {
    bgImage = "/events/category-bg_purple.png"
  } else if (headerClass.includes("is-gray")) {
    bgImage = "/events/category-bg_gray.png"
  } else if (headerClass.includes("is-blue")) {
    bgImage = "/events/category-bg_blue.png"
  }

  return { bgImage }
}

export default function Stub() {
  return null;
}
