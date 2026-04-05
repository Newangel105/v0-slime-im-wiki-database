"use client"

import React, { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"

const languageOptions = [
  { key: "EN", language: 2, label: "English" },
  { key: "JP", language: 1, label: "Japanese" },
  { key: "CN", language: 3, label: "Chinese" },
  { key: "KR", language: 4, label: "Korean" },
]

export default function HomeNewsClient() {
  const [selectedLanguage, setSelectedLanguage] = useState(languageOptions[0])
  const [loadingNews, setLoadingNews] = useState(true)

  const getNewsUrl = () => `https://api-us.ten-sura-m.wfs.games/web/announcement?language=${selectedLanguage.language}`

  useEffect(() => {
    setLoadingNews(false)
  }, [selectedLanguage])

  return (
    <Card className="bg-[#181f2a]/80 border border-gray-700/50 backdrop-blur-sm">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="h-1 w-6 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"></span>
            LATEST NEWS
          </h2>
          <div className="flex gap-2 flex-wrap">
            {languageOptions.map((opt) => (
              <button
                key={opt.key}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedLanguage.key === opt.key 
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25' 
                    : 'bg-[#232c3a] text-gray-400 hover:text-white hover:bg-[#2a3444]'
                }`}
                onClick={() => setSelectedLanguage(opt)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl overflow-hidden border border-gray-700/30">
          {loadingNews ? (
            <div className="h-96 bg-[#232c3a] animate-pulse flex items-center justify-center">
              <span className="text-gray-500">Loading news...</span>
            </div>
          ) : (
            <iframe
              src={getNewsUrl()}
              title="Game News"
              className="w-full max-w-full h-[500px] border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>
      </div>
    </Card>
  )
}
