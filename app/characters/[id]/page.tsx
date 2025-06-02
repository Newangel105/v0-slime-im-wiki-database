"use client"

import { useState, useEffect } from "react"
import characters from "@/app/data/characters.json"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, Heart, Sword, Shield, Zap, Target, Gamepad2, ArrowLeft } from 'lucide-react'
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function CharacterDetailPage({ params }: { params: { characterId: string } }) {
  const [character, setCharacter] = useState<any>(null)

  useEffect(() => {
    // Find character by id in imported JSON data
    const foundCharacter = characters.find((c: any) => c.id === params.characterId)
    setCharacter(foundCharacter ?? null)
  }, [params.characterId])

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-gray-900">
        <p>Character not found.</p>
        <Link href="/characters" className="ml-4 underline text-blue-400">Back to Characters</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <span className="text-xl font-bold">SLIME.WIKI</span>
              </div>
              <nav className="hidden md:flex space-x-6">
                <Link href="/characters" className="text-white font-medium">
                  Characters
                </Link>
                <a href="#" className="text-gray-300 hover:text-white transition-colors">
                  Forces
                </a>
                <a href="#" className="text-gray-300 hover:text-white transition-colors">
                  Events
                </a>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link href="/characters">
          <Button variant="outline" className="mb-6 border-gray-600 text-gray-300 hover:bg-gray-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Characters
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Character Card */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm text-gray-400 mb-2">{character.title}</p>
                  <h1 className="text-2xl font-bold mb-4">{character.name}</h1>
                  
                  {/* Character Image */}
                  <div className="relative mb-4">
                    <img
                      src={character.image || "/placeholder.svg"}
                      alt={character.name}
                      className="w-24 h-24 mx-auto rounded-lg"
                    />
                    <div className="absolute top-0 left-0 w-6 h-6">
                      <img
                        src="/elements/icElementDark.png"
                        alt={character.element}
                        className="w-6 h-6 object-contain"
                      />
                    </div>
                  </div>

                  {/* Stars */}
                  <div className="flex justify-center mb-4">
                    {Array.from({ length: character.stars }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center Column - Character Artwork */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-800 border-gray-700 h-full">
              <CardContent className="p-6 flex items-center justify-center">
                <div className="relative">
                  <img
                    src={character.artwork || "/placeholder.svg"}
                    alt={`${character.name} artwork`}
                    className="max-w-full max-h-96 object-contain"
                  />
                  {/* Magical effects - represented as decorative elements */}
                  <div className="absolute top-4 left-4 text-purple-400 text-2xl">✦</div>
                  <div className="absolute top-12 right-8 text-purple-400 text-xl">✦</div>
                  <div className="absolute bottom-8 left-8 text-purple-400 text-xl">✦</div>
                  <div className="absolute bottom-4 right-4 text-purple-400 text-2xl">✦</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Stats and Details */}
          <div className="lg:col-span-1 space-y-6">
            {/* Stats */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-300">STATS</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      <span>Health</span>
                    </div>
                    <div className="flex space-x-4">
                      <span className="text-gray-400">{character.stats.health.base}</span>
                      <span className="text-white">{character.stats.health.max}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sword className="w-4 h-4 text-orange-500" />
                      <span>Attack</span>
                    </div>
                    <div className="flex space-x-4">
                      <span className="text-gray-400">{character.stats.attack.base}</span>
                      <span className="text-white">{character.stats.attack.max}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span>Defense</span>
                    </div>
                    <div className="flex space-x-4">
                      <span className="text-gray-400">{character.stats.defense.base}</span>
                      <span className="text-white">{character.stats.defense.max}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-4 h-4 text-purple-500" />
                      <span>Existence</span>
                    </div>
                    <div className="flex space-x-4">
                      <span className="text-gray-400">{character.stats.existence.base}</span>
                      <span className="text-white">{character.stats.existence.max}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Target className="w-4 h-4 text-green-500" />
                      <span>Output</span>
                    </div>
                    <div className="flex space-x-4">
                      <span className="text-gray-400">{character.stats.output.base}</span>
                      <span className="text-white">{character.stats.output.max}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                    <span>Release</span>
                    <span className="text-white">{character.releaseDate}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Forces */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-300">FORCES</h2>
                <div className="flex flex-wrap gap-2">
                  {character.forces.map((force, index) => (
                    <Badge key={index} variant="secondary" className="bg-gray-700 text-white">
                      {force}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-300">TAGS</h2>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {character.tags.equipment.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-blue-500 text-blue-400">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {character.tags.protectionCharacters.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-green-500 text-green-400">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {character.tags.abilities.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-yellow-500 text-yellow-400">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {character.tags.skills.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-gray-500 text-gray-400">
                        {tag}
                      </Badge>
                    ))}
                  </div>
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
              {/* Primary */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center">
                    <img src="/elements/icElementWater.png" alt="water" className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-medium">{character.divineProtections.primary.name}</h3>
                    <p className="text-xs text-gray-400">{character.divineProtections.primary.type}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-300">{character.divineProtections.primary.description}</p>
              </div>

              {/* Support */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center">
                    <img src="/elements/icElementWater.png" alt="water" className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-medium">{character.divineProtections.support.name}</h3>
                    <p className="text-xs text-gray-400">{character.divineProtections.support.type}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-300">{character.divineProtections.support.description}</p>
              </div>

              {/* Awaken */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center">
                    <Star className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium">{character.divineProtections.awaken.name}</h3>
                    <p className="text-xs text-gray-400">{character.divineProtections.awaken.type}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-300">{character.divineProtections.awaken.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}