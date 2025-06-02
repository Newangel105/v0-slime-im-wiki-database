"use client"

import { useMemo } from "react"
import characters from "@/app/data/characters.json"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, Heart, Sword, Shield, Zap, Target, Gamepad2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

type Character = {
  id: string
  name?: string
  title?: string
  element?: string
  stars?: number
  image?: string
  artwork?: string
  stats?: {
    health?: { base?: number; max?: number }
    attack?: { base?: number; max?: number }
    defense?: { base?: number; max?: number }
    existence?: { base?: number; max?: number }
    output?: { base?: number; max?: number }
  }
  releaseDate?: string
  forces?: string[]
  tags?: {
    equipment?: string[]
    protectionCharacters?: string[]
    abilities?: string[]
    skills?: string[]
  }
  divineProtections?: {
    primary?: { name?: string; type?: string; description?: string }
    support?: { name?: string; type?: string; description?: string }
    awaken?: { name?: string; type?: string; description?: string }
  }
}

export default function CharacterDetailPage({ params }: { params: { characterId: string } }) {
  // Find character by matching string id
  const character = useMemo(() => {
    return characters.find((c: any) => c.id === params.characterId) ?? null
  }, [params.characterId])

  // Provide default values to avoid undefined errors
  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-gray-900">
        <p>Character not found.</p>
        <Link href="/characters" className="ml-4 underline text-blue-400">
          Back to Characters
        </Link>
      </div>
    )
  }

  // Destructure with defaults
  const {
    title = "No Title",
    name = "Unknown Character",
    element = "Unknown Element",
    stars = 0,
    image = "/placeholder.svg",
    artwork = "/placeholder.svg",
    stats = {},
    releaseDate = "Unknown",
    forces = [],
    tags = {},
    divineProtections = {},
  } = character as Character

  // Safe access stats with fallback numbers
  const getStat = (statKey: keyof typeof stats) => {
    const stat = stats[statKey] || {}
    return {
      base: stat.base ?? 0,
      max: stat.max ?? 0,
    }
  }

  const equipmentTags = tags.equipment ?? []
  const protectionTags = tags.protectionCharacters ?? []
  const abilitiesTags = tags.abilities ?? []
  const skillsTags = tags.skills ?? []

  const dp = divineProtections
  const primaryDP = dp.primary ?? {}
  const supportDP = dp.support ?? {}
  const awakenDP = dp.awaken ?? {}

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header omitted for brevity; keep your existing header code */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/characters">
          <Button variant="outline" className="mb-6 border-gray-600 text-gray-300 hover:bg-gray-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Characters
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm text-gray-400 mb-2">{title}</p>
                  <h1 className="text-2xl font-bold mb-4">{name}</h1>
                  <div className="relative mb-4">
                    <img src={image} alt={name} className="w-24 h-24 mx-auto rounded-lg" />
                    <div className="absolute top-0 left-0 w-6 h-6">
                      <img src="/elements/icElementDark.png" alt={element} className="w-6 h-6 object-contain" />
                    </div>
                  </div>
                  <div className="flex justify-center mb-4">
                    {Array.from({ length: stars }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center Column */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-800 border-gray-700 h-full">
              <CardContent className="p-6 flex items-center justify-center">
                <img src={artwork} alt={`${name} artwork`} className="max-w-full max-h-96 object-contain" />
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-300">STATS</h2>
                {["health", "attack", "defense", "existence", "output"].map((statKey) => {
                  const stat = getStat(statKey as keyof typeof stats)
                  const iconsMap: any = {
                    health: <Heart className="w-4 h-4 text-red-500" />,
                    attack: <Sword className="w-4 h-4 text-orange-500" />,
                    defense: <Shield className="w-4 h-4 text-blue-500" />,
                    existence: <Zap className="w-4 h-4 text-purple-500" />,
                    output: <Target className="w-4 h-4 text-green-500" />,
                  }
                  return (
                    <div key={statKey} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {iconsMap[statKey]}
                        <span>{statKey.charAt(0).toUpperCase() + statKey.slice(1)}</span>
                      </div>
                      <div className="flex space-x-4">
                        <span className="text-gray-400">{stat.base}</span>
                        <span className="text-white">{stat.max}</span>
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                  <span>Release</span>
                  <span className="text-white">{releaseDate}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-300">FORCES</h2>
                <div className="flex flex-wrap gap-2">
                  {forces.length > 0 ? (
                    forces.map((force, i) => (
                      <Badge key={i} variant="secondary" className="bg-gray-700 text-white">
                        {force}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-gray-400">No forces available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-300">TAGS</h2>
                <div className="space-y-3">
                  {[equipmentTags, protectionTags, abilitiesTags, skillsTags].map((tagGroup, idx) => (
                    <div key={idx} className="flex flex-wrap gap-1">
                      {tagGroup.length > 0 ? (
                        tagGroup.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs border-blue-500 text-blue-400">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-gray-500 text-xs italic">No tags</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Divine Protection Section */}
        <Card className="bg-gray-800 border-gray-700 mt-8">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-6 text-gray-300">DIVINE PROTECTION</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[primaryDP, supportDP, awakenDP].map((dpItem, idx) => (
                <div key={idx} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center ${
                        idx === 2 ? "bg-purple-500" : "bg-cyan-500"
                      }`}
                    >
                      {idx === 2 ? (
                        <Star className="w-4 h-4 text-white" />
                      ) : (
                        <img src="/elements/icElementWater.png" alt="element" className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">{dpItem.name ?? "N/A"}</h3>
                      <p className="text-xs text-gray-400">{dpItem.type ?? "Unknown"}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300">{dpItem.description ?? "No description available."}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
