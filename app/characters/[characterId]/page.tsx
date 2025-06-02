import characters from "@/app/data/characters.json"
import { Badge } from "@/components/ui/badge"
import { Star, Heart, Sword, Shield, Zap, Target, Gamepad2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

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

  // Calculate max stats across all characters
  const maxFinalAttack = Math.max(...characters.map(c => c.final_attack))
  const maxFinalDefense = Math.max(...characters.map(c => c.final_defense))
  const maxFinalHealth = Math.max(...characters.map(c => c.final_health))
  const maxOutput = Math.max(...characters.map(c => c.output_final))

  // Calculate percentages for this character, fallback to 0 if max is 0
  const attackPercent = maxFinalAttack ? (character.final_attack / maxFinalAttack) * 100 : 0
  const defensePercent = maxFinalDefense ? (character.final_defense / maxFinalDefense) * 100 : 0
  const healthPercent = maxFinalHealth ? (character.final_health / maxFinalHealth) * 100 : 0
  const outputPercent = maxOutput ? (character.output_final / maxOutput) * 100 : 0

  const maxExistence = Math.max(
    ...characters.map(
      (c) =>
        c.final_health + c.final_attack * 5 + c.final_defense * 2.5
    )
  )

  // Calculate this character's existence
  const charExistence =
    character.final_health + character.final_attack * 5 + character.final_defense * 2.5

  // Calculate existence percentage relative to max
  const existencePercent = maxExistence ? (charExistence / maxExistence) * 100 : 0

  // Parse pipe-separated values
  const skillsList = character.skills.split("|").filter((skill) => skill.trim())
  const traitsList = character.traits.split("|").filter((trait) => trait.trim())
  const forcesList = character.force.split("|").filter((force) => force.trim())

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

        {/* Character Header */}
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800">
            <img
              src={`/char_image_full/${character.id}.png`}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{character.name}</h1>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                {Array.from({ length: character.stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Character Image */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="relative">
                <img
                  src={`/char_image_full/${character.id}.png`}
                  alt={`${character.name} artwork`}
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          </div>

          {/* Right Column - Stats and Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Section */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-gray-300 uppercase tracking-wider">STATS</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Heart className="w-4 h-4 text-red-400" />
                    <span className="text-gray-300 text-sm">Health</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{character.initial_health.toLocaleString()}</span>
                    <span className="text-gray-500 text-sm">{character.final_health.toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${healthPercent}%` }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sword className="w-4 h-4 text-orange-400" />
                    <span className="text-gray-300 text-sm">Attack</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{character.initial_attack.toLocaleString()}</span>
                    <span className="text-gray-500 text-sm">{character.final_attack.toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${attackPercent}%` }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-300 text-sm">Defense</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{character.initial_defense.toLocaleString()}</span>
                    <span className="text-gray-500 text-sm">{character.final_defense.toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${defensePercent}%` }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <span className="text-gray-300 text-sm">Existence</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{(
                      character.initial_health +
                      character.initial_attack * 5 +
                      character.initial_defense * 2.5
                    ).toLocaleString()}
                    </span>
                    <span className="text-gray-500 text-sm">{(
                      character.final_health +
                      character.final_attack * 5 +
                      character.final_defense * 2.5
                    ).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${existencePercent}%` }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-300 text-sm">Output</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{character.output_initial.toLocaleString()}</span>
                    <span className="text-gray-500 text-sm">{character.output_final.toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-gray-500 h-2 rounded-full" style={{ width: `${outputPercent}%` }}></div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Release</span>
                    <span className="text-gray-300 text-sm">5/19/2024</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Forces Section */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-lg font-semibold mb-4 text-gray-300 uppercase tracking-wider">FORCES</h2>
                <div className="flex flex-wrap gap-2">
                    {forcesList.map((force, index) => (
                    <Badge
                        key={index}
                        className="bg-gray-700 text-white border-gray-600 flex items-center space-x-2"
                    >
                        <img
                        src={`/forces/${force}.png`}
                        alt={force}
                        className="w-5 h-5 object-contain"
                        />
                        <span>{force}</span>
                    </Badge>
                    ))}
                </div>
            </div>

            {/* Tags Section */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-gray-300 uppercase tracking-wider">TAGS</h2>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-blue-500 text-blue-400">
                  Shieldclub Skill +30%
                </Badge>
                <Badge variant="outline" className="border-green-500 text-green-400">
                  Eligible for Defense Magicema +10%
                </Badge>
                <Badge variant="outline" className="border-red-500 text-red-400">
                  Battle Characters
                </Badge>
                <Badge variant="outline" className="border-gray-500 text-gray-400">
                  Single
                </Badge>
                <Badge variant="outline" className="border-blue-500 text-blue-400">
                  Water
                </Badge>
                <Badge variant="outline" className="border-purple-500 text-purple-400">
                  Physical
                </Badge>
                <Badge variant="outline" className="border-yellow-500 text-yellow-400">
                  ★★★★★ 5
                </Badge>
                <Badge variant="outline" className="border-gray-500 text-gray-400">
                  Skills
                </Badge>
                <Badge variant="outline" className="border-red-500 text-red-400">
                  Critical Damage
                </Badge>
                <Badge variant="outline" className="border-gray-500 text-gray-400">
                  Skills
                </Badge>
                <Badge variant="outline" className="border-blue-500 text-blue-400">
                  Water ATK
                </Badge>
                <Badge variant="outline" className="border-gray-500 text-gray-400">
                  Traits
                </Badge>
                <Badge variant="outline" className="border-blue-500 text-blue-400">
                  Soul Skill
                </Badge>
                <Badge variant="outline" className="border-gray-500 text-gray-400">
                  Soul of Secrets Damage
                </Badge>
                <Badge variant="outline" className="border-gray-500 text-gray-400">
                  Traits
                </Badge>
                <Badge variant="outline" className="border-gray-500 text-gray-400">
                  Gauge
                </Badge>
                <Badge variant="outline" className="border-gray-500 text-gray-400">
                  Protection Gauge
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Battle Skills Section */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">BATTLE SKILLS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {character.battle_skills.map((skill, index) => (
              <div key={index} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12  rounded-lg flex items-center justify-center overflow-hidden">
                    {skill.imageName ? (
                      <img
                        src={`/skills/${skill.imageName}`}
                        alt={skill.attackName}
                        className="w-10 h-10 object-contain"
                      />
                    ) : (
                      <span className="text-white text-xs">No Img</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{skill.attackName}</h3>
                    {skill.extraText && (
                      <p className="text-blue-400 text-sm">{skill.extraText}</p>
                    )}
                  </div>
                </div>
                <p className="text-gray-300 text-sm">{skill.description}</p>
              </div>
            ))}
          </div>
        </div>


        {/* Secret Skills Section */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">SECRET SKILLS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {character.secret_skills.map((skill, index) => (
              <div key={index} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12  rounded-lg flex items-center justify-center overflow-hidden">
                    {skill.imageName ? (
                      <img
                        src={`/skills/${skill.imageName}`}
                        alt={skill.attackName}
                        className="w-10 h-10 object-contain"
                      />
                    ) : (
                      <span className="text-white text-xs">No Img</span>
                    )}
                  </div>
                  {/* Skill Image (below) */}
                  {skill.imageName && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden">
                      <img
                        src={`/skills/${skill.imageName}`}
                        alt={skill.attackName}
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="text-white font-medium">{skill.attackName}</h3>
                    {skill.extraText && (
                      <p className="text-blue-400 text-sm">{skill.extraText}</p>
                    )}
                  </div>
                </div>
                <p className="text-gray-300 text-sm">{skill.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Traits Section */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">TRAITS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {character.skill_traits.map((skill, index) => (
              <div key={index} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12  rounded-lg flex items-center justify-center overflow-hidden">
                    {skill.imageName ? (
                      <img
                        src={`/skills/${skill.imageName}`}
                        alt={skill.attackName}
                        className="w-10 h-10 object-contain"
                      />
                    ) : (
                      <span className="text-white text-xs">No Img</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{skill.attackName}</h3>
                    {skill.extraText && (
                      <p className="text-blue-400 text-sm">{skill.extraText}</p>
                    )}
                  </div>
                </div>
                <p className="text-gray-300 text-sm">{skill.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* EX Abilities Section */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">EX ABILITIES</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {character.ex_abilities.map((skill, index) => (
              <div key={index} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  {skill.imageName && (
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                      <img
                        src={`/skills/${skill.imageName}`}
                        alt={skill.attackName}
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="text-white font-medium">{skill.attackName}</h3>
                    {skill.extraText && (
                      <p className="text-blue-400 text-sm">{skill.extraText}</p>
                    )}
                  </div>
                </div>
                <p className="text-gray-300 text-sm">{skill.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Character Gallery */}
        <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">SHION</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-3">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="relative">
                <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                  <img
                    src={`/placeholder.svg?height=80&width=80`}
                    alt={`Shion variant ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                  <div className="flex justify-center">
                    {Array.from({ length: Math.floor(Math.random() * 5) + 1 }).map((_, i) => (
                      <Star key={i} className="w-2 h-2 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}