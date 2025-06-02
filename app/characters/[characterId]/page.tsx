import characters from "@/app/data/characters.json"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Star,
  Heart,
  Sword,
  Shield,
  Zap,
  Target,
  Gamepad2,
  ArrowLeft,
  Flame,
  Droplets,
  Mountain,
  Wind,
  Sun,
  Moon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

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
  fire: "/elements/icElementFire.png",
  water: "/elements/icElementWater.png",
  earth: "/elements/icElementEarth.png",
  air: "/elements/icElementAir.png",
  wind: "/elements/icElementWind.png",
  dark: "/elements/icElementDark.png",
  light: "/elements/icElementlight.png",
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
  const skillsList = character.skills.split("|").filter((skill) => skill.trim())
  const traitsList = character.traits.split("|").filter((trait) => trait.trim())
  const forcesList = character.force.split("|").filter((force) => force.trim())

  // Split skills into battle skills and secret skills (assuming first half are battle, second half are secret)
  const midPoint = Math.ceil(skillsList.length / 2)
  const battleSkills = skillsList.slice(0, midPoint)
  const secretSkills = skillsList.slice(midPoint)

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

        {/* Character Name */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{character.name}</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <img
                src={elementIcons[character.element]}
                alt={character.element}
                className="w-6 h-6 object-contain"
              />
              <span className="text-gray-300 capitalize">{character.element}</span>
            </div>
            <div className="flex items-center space-x-1">
              {Array.from({ length: character.stars }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <Badge variant="outline" className="border-purple-500 text-purple-400">
              {character.char_type}
            </Badge>
          </div>
        </div>

        {/* Main Content - Image and Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Character Image */}
          <div>
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6 flex items-center justify-center">
                <div className="relative">
                  <img
                    src={`/char_image_full/${character.id}.png`}
                    alt={`${character.name} artwork`}
                    className="max-w-full max-h-96 object-contain"
                  />
                  {/* Magical effects */}
                  <div className="absolute top-4 left-4 text-purple-400 text-2xl">✦</div>
                  <div className="absolute top-12 right-8 text-purple-400 text-xl">✦</div>
                  <div className="absolute bottom-8 left-8 text-purple-400 text-xl">✦</div>
                  <div className="absolute bottom-4 right-4 text-purple-400 text-2xl">✦</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats */}
          <div>
            <Card className="bg-gray-800 border-gray-700 h-full">
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold mb-6 text-white">Stats</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sword className="w-5 h-5 text-red-400" />
                      <span className="text-gray-300">Attack</span>
                    </div>
                    <span className="text-white font-semibold">{character.attack.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Heart className="w-5 h-5 text-green-400" />
                      <span className="text-gray-300">Health</span>
                    </div>
                    <span className="text-white font-semibold">{character.health.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-5 h-5 text-blue-400" />
                      <span className="text-gray-300">Defense</span>
                    </div>
                    <span className="text-white font-semibold">{character.defense.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      <span className="text-gray-300">Existence</span>
                    </div>
                    <span className="text-white font-semibold">{character.existence.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Target className="w-5 h-5 text-purple-400" />
                      <span className="text-gray-300">Weapon</span>
                    </div>
                    <span className="text-white font-semibold">{character.weapon}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Star className="w-5 h-5 text-orange-400" />
                      <span className="text-gray-300">Awakening</span>
                    </div>
                    <span className="text-white font-semibold">{character.awakening}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 text-center text-pink-400">🏠</span>
                      <span className="text-gray-300">Town</span>
                    </div>
                    <span className="text-white font-semibold">{character.town}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Battle Skills */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-6 text-white">Battle Skills</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {battleSkills.map((skill, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Sword className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-300">{skill}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Secret Skills */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-6 text-white">Secret Skills</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {secretSkills.map((skill, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-300">{skill}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Traits */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-6 text-white">Traits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {traitsList.map((trait, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Star className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-300">{trait}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* EX Abilities */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-6 text-white">EX Abilities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {forcesList.map((force, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-300">{force}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Related Images */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-6 text-white">Related Images</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* You can map through images that match the character name */}
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
                  <img
                    src={`/placeholder.svg?height=100&width=100`}
                    alt={`Related image ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}