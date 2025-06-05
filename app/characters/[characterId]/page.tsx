import characters from "@/app/data/characters.json"
import { Badge } from "@/components/ui/badge"
import { Star, Heart, Sword, Shield, Zap, Target, Gamepad2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function CharacterDetailPage({ params }: { params: { characterId: string } }) {
  const characterId = Number(params.characterId)
  const character = characters.find((char) => char.id === characterId)

  const statIconMap: { [key: string]: string } = {
    HP: "/icons/HP.png",
    ATK: "/icons/ATK.png",
    DEF: "/icons/DEF.png",
    fire: "/elements/icElementFire.png",
    water: "/elements/icElementWater.png",
    earth: "/elements/icElementEarth.png",
    space: "/elements/icElementspace.png",
    wind: "/elements/icElementWind.png",
    dark: "/elements/icElementDark.png",
    light: "/elements/icElementlight.png",
    ProtectorofPeace: "/forces/ProtectorofPeace.png",
    prot_fire: "/protector_elements/fire.png",
    prot_water: "/protector_elements/water.png",
    prot_earth: "/protector_elements/earth.png",
    prot_space: "/protector_elements/space.png",
    prot_wind: "/protector_elements/wind.png",
    prot_dark: "/protector_elements/dark.png",
    prot_light: "/protector_elements/light.png"
  };

  function renderFilterTag(value: string) {
    const cleanValue = value.replace(/\s+/g, "")

    // Detect type by value (you can extend this easily)
    let type: string | null = null

    if (["prot_fire","prot_water","prot_earth","prot_wind","prot_space","prot_light","prot_dark","fire","water", "earth", "wind", "space", "light", "dark"].includes(value)) {
      type = "element"
    } else if (
      ["Protector of Peace", "Goblin Rider", "Ogre", "Tempest", "Saint", "Octagram"].includes(value)
    ) {
      type = "force"
    }

    if (!type) return value // fallback to plain text if unrecognized

    // Adjust icon size and font size here:
    const iconSize = "w-5 h-5" // slightly bigger icons
    const fontSize = "text-sm" // bigger font size
    const paddingX = "px-3"
    const paddingY = "py-1"

    return (
      <Link
        href={`/characters?${type}=${encodeURIComponent(value)}`}
        className={`inline-flex items-center ${paddingX} ${paddingY} rounded-full bg-[#111827] text-white ${fontSize} font-medium mx-1 hover:bg-[#909090]`}
      >
        {(type === "element" || type === "force") && statIconMap[cleanValue] && (
          <img
            src={statIconMap[cleanValue]}
            alt={value}
            className={`${iconSize} mr-2 object-contain`}
          />
        )}
        {value.replace(/^prot_/, '')}
      </Link>
    )
  }


  function replaceStatTextWithIcons(text: string) {
    return text.split('\n').map((line, lineIndex) => (
      <p key={lineIndex} className="text-gray-300 text-sm mb-1">
        {line.split(/(HP|ATK|DEF|fire|prot_water|water|earth|wind|space|dark|light|Protector of Peace|Goblin Rider|Ogre|Tempest|Saint|Octagram)/g).map((part, index) => {
          const cleanKey = part.replace(/\s+/g, "")

          // Show as filter tag (link) for known types
          if (["prot_fire","prot_water","prot_earth","prot_wind","prot_space","prot_light","prot_dark","fire","water", "earth", "wind", "space", "light", "dark", "Protector of Peace", "Goblin Rider", "Ogre", "Tempest", "Saint", "Octagram"].includes(part)) {
            return <span key={`${lineIndex}-${index}`}>{renderFilterTag(part)}</span>
          }

          // Show as icon-only tag (no link) for things like HP/ATK/DEF
          if (statIconMap[cleanKey]) {
            const iconSize = part === "ATK" ? "w-3 h-4" : "w-4 h-4"
            return (
              <span
                key={`${lineIndex}-${index}`}
                className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#909090] text-white text-xs font-medium mx-1"
              >
                <img
                  src={statIconMap[cleanKey]}
                  alt={part}
                  className={`${iconSize} mr-1 object-contain`}
                />
                {part}
              </span>
            )
          }

          // Fallback: plain text
          return <span key={`${lineIndex}-${index}`}>{part}</span>
        })}
      </p>
    ))
  }

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

  const variants = characters.filter(
    (c) => c.name === character.name && c.id !== characterId
  )

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
  const forcesList = character.force.split("|").filter((force) => force.trim())
  const tagsList = character.tag.split("|").filter((tag) => tag.trim())

  function SkillCard({
    skill,
    isEvolution = false,
    baseImage
  }: {
    skill: any;
    isEvolution?: boolean;
    baseImage?: string;
  }) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 h-full">
        <div className="flex items-center space-x-3 mb-3">
          <div className="relative w-12 h-12 flex items-center justify-center overflow-visible">
            {isEvolution && (
              <img
                src="/skills/evolution.png"
                alt="Evolution Circle"
                className="absolute -top-2 -left-2 w-16 h-16 z-0 object-contain"
              />
            )}
            <img
              src={`/chars/${character?.id}/${isEvolution && baseImage ? baseImage : skill.imageName}`}
              alt={skill.attackName}
              className="w-10 h-10 z-10 object-contain relative -left-2"
            />
          </div>
          <div>
            <h3 className="text-white font-medium">{skill.attackName}</h3>
            {skill.extraText && <p className="text-blue-400 text-sm">{skill.extraText}</p>}
          </div>
        </div>
        <p className="text-gray-300 text-sm">{replaceStatTextWithIcons(skill.description)}</p>
      </div>
    );
  }

  // ---- In your render section ----
  const base1 = character.battle_skills?.find(s => s.imageName === "b1.png");
  const base2 = character.battle_skills?.find(s => s.imageName === "b2.png");
  const evo1 = character.battle_skills?.find(s => s.imageName === "b3.png");
  const evo2 = character.battle_skills?.find(s => s.imageName === "b4.png");

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
            src={`/chars/${character.id}/image.png`}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h2 className="text-sm text-[#d9d9d9] font-medium">{character.sub_name}</h2>
          <h1 className="text-2xl font-bold text-white">{character.name}</h1>
        </div>
      </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Character Image */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="relative">
                <img
                  src={`/chars/${character.id}/image_full.png`}
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
                      <p className="text-gray-300 text-sm">{replaceStatTextWithIcons(force)}</p>
                    ))}
                </div>
            </div>

            {/* Tags Section */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-lg font-semibold mb-4 text-gray-300 uppercase tracking-wider">TAGS</h2>
                <div className="flex flex-wrap gap-2">
                    {tagsList.map((tag, index) => (
                      <p className="text-gray-300 text-sm">{replaceStatTextWithIcons(tag)}</p>
                    ))}
                </div>
            </div>
          </div>
        </div>

        {/* Battle Skills Section */}
        {character.type === 'attacker' && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">BATTLE SKILLS</h2>
            <div className="grid grid-cols-2 gap-6">
              {/* Column 1 */}
              <div className="flex flex-col space-y-6">
                {base1 && <SkillCard skill={base1} />}
                {evo1 ? <SkillCard skill={evo1} isEvolution baseImage="b1.png" /> : <div className="h-full" />}
              </div>

              {/* Column 2 */}
              <div className="flex flex-col space-y-6">
                {base2 && <SkillCard skill={base2} />}
                {evo2 ? <SkillCard skill={evo2} isEvolution baseImage="b2.png" /> : <div className="h-full" />}
              </div>
            </div>
          </div>
        )}

        {character.type === 'protector' && character.divine_skills && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">DIVINE PROTECTION</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {character.divine_skills.map((skill, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-start space-x-3 mb-3">
                    {skill.imageName ? (
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                        <img
                          src={skill.imageName}
                          alt={skill.attackName}
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                    ) : null}
                    
                    <div className={skill.imageName ? '' : 'ml-1'}>
                      <h3 className="text-white font-medium">{skill.attackName}</h3>
                      {skill.extraText && (
                        <p className="text-blue-400 text-sm">{skill.extraText}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm">{replaceStatTextWithIcons(skill.description)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Secret Skills Section */}
        {character.type === 'attacker' && character.secret_skills && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">SECRET SKILLS</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {character.secret_skills.map((skill, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="relative w-[48px] h-[48px]">
                      {/* Skill Frame (background) */}
                      <img
                        src={`/skills/${skill.imageName}.png`}
                        alt={skill.attackName}
                        className="absolute top-0 left-0 w-full h-full object-contain z-0"
                      />

                      {/* Character image clipped inside smaller circle */}
                      <div className="absolute top-1/2 left-1/2 w-[28px] h-[28px] rounded-full overflow-hidden -translate-x-1/2 -translate-y-1/2 z-10">
                        <img
                          src={`/chars/${character.id}/image.png`}
                          alt={character.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{skill.attackName}</h3>
                      {skill.extraText && (
                        <p className="text-blue-400 text-sm">{skill.extraText}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm">{replaceStatTextWithIcons(skill.description)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {character.element.includes('ex') && character.type === 'attacker' && character.unbound && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">True Attribute Unbound</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {character.unbound.map((skill, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                      <img
                        src={`/elements/Enhanced${character.element.replace(/^(ex_|prot_)+/, '')}.png`}
                        alt="unbound"
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm">{replaceStatTextWithIcons(skill.description)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {character.type === 'protector' && character.protection_skill && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">PROTECTION SKILL</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {character.protection_skill.map((skill, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12  rounded-lg flex items-center justify-center overflow-hidden">
                      <img
                        src={`/chars/${character.id}/prot.png`}
                        alt={skill.attackName}
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{skill.attackName}</h3>
                      {skill.extraText && (
                        <p className="text-blue-400 text-sm">{skill.extraText}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm">{replaceStatTextWithIcons(skill.description)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Traits Section */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">TRAITS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {character.skill_traits.map((skill, index) => (
              <div key={`trait-${index}`} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                    {skill.imageName ? (
                      <img
                        src={`/skills/${skill.imageName}.png`}
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
                <p className="text-gray-300 text-sm">{replaceStatTextWithIcons(skill.description)}</p>
              </div>
            ))}

            {character.type === 'protector' && character.guidance_trait?.map((skill, index) => (
              <div key={`guidance-${index}`} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div>
                    <h3 className="text-white font-medium">Enhance Guidance</h3>
                  </div>
                </div>
                <p className="text-gray-300 text-sm">{replaceStatTextWithIcons(skill.description)}</p>
              </div>
            ))}
          </div>

        </div> 
          {/* EX Abilities Section */}
        {character.type === 'attacker' && character.ex_abilities && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">EX ABILITIES</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {character.ex_abilities.map((skill, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    {skill.imageName && (
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                        <img
                          src={`/skills/${skill.imageName}.png`}
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
                  <p className="text-gray-300 text-sm">{replaceStatTextWithIcons(skill.description)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Character Gallery */}
        <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">
            {character.name} Variants
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-3">
            {variants.map((variant) => (
              <Link key={variant.id} href={`/characters/${variant.id}`}>
                <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:scale-105 transition-transform duration-200">
                  <img
                    src={`/chars/${variant.id}/image.png`}
                    alt={`${variant.name} variant`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}