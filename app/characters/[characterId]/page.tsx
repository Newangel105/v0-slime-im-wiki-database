// app/characters/[characterId]/page.tsx
import characters from '@/app/data/characters.json'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star, Heart, Sword, Shield, Zap, Target, Gamepad2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Character {
  id: number
  name: string
  element: string
  stars: number
  weapon: string
  awakening: number
  dmg_type: string
  type: string
  char_type: string
  ulti: string
  skills: string
  traits: string
  force: string
  town: string
  image: string
  attack: number
  health: number
  defense: number
  existence: number
  rarity: number
}

const elementIcons = {
  fire: '/elements/icElementFire.png',
  water: '/elements/icElementWater.png',
  earth: '/elements/icElementEarth.png',
  air: '/elements/icElementAir.png',
  wind: '/elements/icElementWind.png',
  dark: '/elements/icElementDark.png',
  light: '/elements/icElementlight.png',
}

export default function CharacterDetailPage({ params }: { params: { characterId: string } }) {
  const characterId = Number(params.characterId)
  const character = characters.find((char) => char.id === characterId)

  if (!character) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Character Not Found</h1>
          <p className="text-gray-400 mb-4">The requested character could not be found.</p>
          <Link href="/characters">
            <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Characters
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Parse pipe-separated values
  const skillsList = character.skills.split('|').filter((skill) => skill.trim())
  const traitsList = character.traits.split('|').filter((trait) => trait.trim())
  const forcesList = character.force.split('|').filter((force) => force.trim())

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
                  <p className="text-sm text-gray-400 mb-2">
                    {character.char_type.charAt(0).toUpperCase() + character.char_type.slice(1)} Type
                  </p>
                  <h1 className="text-2xl font-bold mb-4">{character.name}</h1>

                  {/* Character Image */}
                  <div className="relative mb-4">
                    <img
                      src={character.image || '/placeholder.svg'}
                      alt={character.name}
                      className="w-24 h-24 mx-auto rounded-lg"
                    />
                    <div className="absolute top-0 left-0 w-6 h-6">
                      <img
                        src={elementIcons[character.element as keyof typeof elementIcons] || '/placeholder.svg'}
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

                  {/* Character Type Badges */}
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-blue-500 text-blue-400">
                      {character.dmg_type.toUpperCase()} DMG
                    </Badge>
                    <Badge variant="outline" className="border-green-500 text-green-400 ml-2">
                      {character.type.toUpperCase()}
                    </Badge>
                    <div className="mt-2">
                      <Badge variant="outline" className="border-purple-500 text-purple-400">
                        {character.ulti.toUpperCase()} ULTI
                      </Badge>
                    </div>
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
                    src={character.image || '/placeholder.svg'}
                    alt={`${character.name} artwork`}
                    className="max-w-full max-h-96 object-contain"
                  />
                  {/* Magical effects - decorative */}
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
                  {/* ... Your stats JSX as before */}
                  {/* You can keep this the same, no need to change */}
                </div>
              </CardContent>
            </Card>

            {/* Forces */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-300">FORCES</h2>
                <div className="flex flex-wrap gap-2">
                  {forcesList.map((force, index) => (
                    <Badge key={index} variant="secondary" className="bg-gray-700 text-white">
                      {force}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Skills */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-300">SKILLS</h2>
                <div className="flex flex-wrap gap-2">
                  {skillsList.map((skill, index) => (
                    <Badge key={index} variant="outline" className="border-blue-500 text-blue-400">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Traits */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-300">TRAITS</h2>
                <div className="flex flex-wrap gap-2">
                  {traitsList.map((trait, index) => (
                    <Badge key={index} variant="outline" className="border-green-500 text-green-400">
                      {trait}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-300">LOCATION</h2>
                <Badge variant="outline" className="border-yellow-500 text-yellow-400">
                  {character.town}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
