import type React from "react"
import characters from "@/app/data/characters.json"
import { Heart, Sword, Shield, Zap, Target, Gamepad2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getAllCharacters } from "@/lib/getCharacters"

export default function CharacterDetailPage({ params }: { params: { characterId: string } }) {
  const characterId = Number(params.characterId)
  const character = characters.find((char) => char.id === characterId)

  const characters_total = getAllCharacters()

  const customMap = {
    "Shizu's Will": "Shizus_Will",
    "Lycanthrope's Pride": "Lycanthropes_Pride",
    "New Year's Blessing": "New_Years_Blessing",
    "Ogre's Pride": "Ogres_Pride",
    "Warrior's Mind": "Warriors_Mind",
    "Axiom of Haze": "Axiom_of_Haze",
    "Clan Chief": "Clan_Chief",
    "Demon Lord Invasion": "Demon_Lord_Invasion",
    "Determination to Prosper": "Determination_to_Prosper",
    "Dragon Haki": "Dragon_Haki",
    "Exalted Champions": "Exalted_Champions",
    "Festive Memories": "Festive_Memories",
    "Flashback Beatdown Emissary": "Flashback_Beatdown_Emissary",
    "Forest Fracas": "Forest_Fracas",
    "Fount of Wisdom": "Fount_of_Wisdom",
    "Frozen Continent": "Frozen_Continent",
    "Gaining Status": "Gaining_Status",
    "Goddess of Destiny": "Goddess_of_Destiny",
    "Heart of a Hero": "Heart_of_a_Hero",
    "Hyper Heart": "Hyper_Heart",
    "Monster and Human Mingling": "Monster_and_Human_Mingling",
    "Octagram Bazaar": "Octagram_Bazaar",
    "Octagram Demon Lord": "Octagram_Demon_Lord",
    "Otherworld Legend": "Otherworld_Legend",
    "Pretty Sparkle": "Pretty_Sparkle",
    "Primal Demon": "Primal_Demon",
    "Protector of Peace": "Protector_of_Peace",
    "Scarlet Bond": "Scarlet_Bond",
    "Spirit Master": "Spirit_Master",
    "Stern of Spirit": "Stern_of_Spirit",
    "Summer Memories": "Summer_Memories",
    "Tempest Elite": "Tempest_Elite",
    "Ten Great Demon Lords": "Ten_Great_Demon_Lords",
    "Visions of Coleus": "Visions_of_Coleus",
    "Wholehearted Devotion": "Wholehearted_Devotion",
    "Wielder of Magic": "Wielder_of_Magic",
    "World of Fantasy": "World_of_Fantasy",
    "Anti-Fire": "Anti_Fire",
    "Anti-Water": "Anti_Water",
    "Anti-Earth": "Anti_Earth",
    "Anti-Space": "Anti_Space",
    "Anti-Wind": "Anti_Wind",
    "Anti-Dark": "Anti_Dark",
    "Anti-Light": "Anti_Light",
    "Battle Characters": "Battle_Characters",
    "Protection Characters": "Protection_Characters",
    "EX 5": "EX_5",
    "EX Attack": "EX_Attack",
    "EX Balance": "EX_Balance",
    "EX Defense": "EX_Defense",
  }

  const customIcons: { [key: string]: string } = {
    Fire: "/elements/icElementFire.png",
    Water: "/elements/icElementWater.png",
    Earth: "/elements/icElementEarth.png",
    Space: "/elements/icElementspace.png",
    Wind: "/elements/icElementWind.png",
    Dark: "/elements/icElementDark.png",
    Light: "/elements/icElementlight.png",
    Adventurer: "/protector_elements/Adventurer.png",
    Antagonist: "/protector_elements/Antagonist.png",
    Axiom_of_Haze: "/protector_elements/Axiom_of_Haze.png",
    Clan_Chief: "/protector_elements/Clan_Chief.png",
    Commander: "/protector_elements/Commander.png",
    Demon_Lord_Invasion: "/protector_elements/Demon_Lord_Invasion.png",
    Determination_to_Prosper: "/protector_elements/Determination_to_Prosper.png",
    Dragon_Haki: "/protector_elements/Dragon_Haki.png",
    Exalted_Champions: "/protector_elements/Exalted_Champions.png",
    Festive_Memories: "/protector_elements/Festive_Memories.png",
    Flashback_Beatdown_Emissary: "/protector_elements/Flashback_Beatdown_Emissary.png",
    Forest_Fracas: "/protector_elements/Forest_Fracas.png",
    Fount_of_Wisdom: "/protector_elements/Fount_of_Wisdom.png",
    Frozen_Continent: "/protector_elements/Frozen_Continent.png",
    Gaining_Status: "/protector_elements/Gaining_Status.png",
    Goddess_of_Destiny: "/protector_elements/Goddess_of_Destiny.png",
    Heart_of_a_Hero: "/protector_elements/Heart_of_a_Hero.png",
    Hyper_Heart: "/protector_elements/Hyper_Heart.png",
    Lycanthropes_Pride: "/protector_elements/Lycanthrope's_Pride.png",
    Monster_and_Human_Mingling: "/protector_elements/Monster_and_Human_Mingling.png",
    New_Years_Blessing: "/protector_elements/New_Year's_Blessing.png",
    Octagram: "/protector_elements/Octagram.png",
    Octagram_Bazaar: "/protector_elements/Octagram_Bazaar.png",
    Octagram_Demon_Lord: "/protector_elements/Octagram_Demon_Lord.png",
    Ogres_Pride: "/protector_elements/Ogre's_Pride.png",
    Otherworlder: "/protector_elements/Otherworlder.png",
    Otherworld_Legend: "/protector_elements/Otherworld_Legend.png",
    Pariah: "/protector_elements/Pariah.png",
    Pretty_Sparkle: "/protector_elements/Pretty_Sparkle.png",
    Primal_Demon: "/protector_elements/Primal_Demon.png",
    Protector_of_Peace: "/protector_elements/Protector_of_Peace.png",
    Scarlet_Bond: "/protector_elements/Scarlet_Bond.png",
    Schemer: "/protector_elements/Schemer.png",
    Shizus_Will: "/protector_elements/Shizu's_Will.png",
    Spirit_Master: "/protector_elements/Spirit_Master.png",
    Stern_of_Spirit: "/protector_elements/Stern_of_Spirit.png",
    Summer_Memories: "/protector_elements/Summer_Memories.png",
    Tempest_Elite: "/protector_elements/Tempest_Elite.png",
    Ten_Great_Demon_Lords: "/protector_elements/Ten_Great_Demon_Lords.png",
    Valentine: "/protector_elements/Valentine.png",
    Visions_of_Coleus: "/protector_elements/Visions_of_Coleus.png",
    Warriors_Mind: "/protector_elements/Warrior's_Mind.png",
    Wholehearted_Devotion: "/protector_elements/Wholehearted_Devotion.png",
    Wielder_of_Magic: "/protector_elements/Wielder_of_Magic.png",
    World_of_Fantasy: "/protector_elements/World_of_Fantasy.png",
    All: "/ulti_type/aoe.png",
    Single: "/ulti_type/single.png",
    3: "/stars/starCharaL3A.png",
    4: "/stars/starCharaL4A.png",
    EX_5: "/stars/starCharaL6A.png",
    5: "/stars/starCharaL5A.png",
    Battle_Characters: "/type/attacker.png",
    Protection_Characters: "/type/protector.png",
    EX_Attack: "/char_type/attack.png",
    EX_Balance: "/char_type/balance.png",
    EX_Defense: "/char_type/defense.png",
    Anti_Fire: "/protector_elements/Anti-Fire.png",
    Anti_Water: "/protector_elements/Anti-Water.png",
    Anti_Earth: "/protector_elements/Anti-Earth.png",
    Anti_Space: "/protector_elements/Anti-Space.png",
    Anti_Wind: "/protector_elements/Anti-Wind.png",
    Anti_Dark: "/protector_elements/Anti-Dark.png",
    Anti_Light: "/protector_elements/Anti-Light.png",
    Sword: "/weapons/sword.png",
    Katana: "/weapons/katana.png",
    Hammer: "/weapons/hammer.png",
    Spear: "/weapons/spear.png",
    Greatsword: "/weapons/greatsword.png",
    Book: "/weapons/book.png",
    Fists: "/weapons/fists.png",
    Physical: "/type_dmg/icAttackTypePhysics.png",
    Magic: "/type_dmg/icAttackTypeMagic.png",
  }

  const statIconMap: { [key: string]: string } = {
    HP: "/icons/HP.png",
    ATK: "/icons/ATK.png",
    DEF: "/icons/DEF.png",
    Fire: "/elements/icElementFire.png",
    Water: "/elements/icElementWater.png",
    Earth: "/elements/icElementEarth.png",
    Space: "/elements/icElementspace.png",
    Wind: "/elements/icElementWind.png",
    Dark: "/elements/icElementDark.png",
    Light: "/elements/icElementlight.png",
    P_: "/type_dmg/icAttackTypePhysics.png",
    M_ATK: "/type_dmg/icAttackTypeMagic.png",
    Adventurer: "/protector_elements/Adventurer.png",
    Antagonist: "/protector_elements/Antagonist.png",
    Axiom_of_Haze: "/protector_elements/Axiom_of_Haze.png",
    Clan_Chief: "/protector_elements/Clan_Chief.png",
    Commander: "/protector_elements/Commander.png",
    Demon_Lord_Invasion: "/protector_elements/Demon_Lord_Invasion.png",
    Determination_to_Prosper: "/protector_elements/Determination_to_Prosper.png",
    Dragon_Haki: "/protector_elements/Dragon_Haki.png",
    Exalted_Champions: "/protector_elements/Exalted_Champions.png",
    Festive_Memories: "/protector_elements/Festive_Memories.png",
    Flashback_Beatdown_Emissary: "/protector_elements/Flashback_Beatdown_Emissary.png",
    Forest_Fracas: "/protector_elements/Forest_Fracas.png",
    Fount_of_Wisdom: "/protector_elements/Fount_of_Wisdom.png",
    Frozen_Continent: "/protector_elements/Frozen_Continent.png",
    Gaining_Status: "/protector_elements/Gaining_Status.png",
    Goddess_of_Destiny: "/protector_elements/Goddess_of_Destiny.png",
    Heart_of_a_Hero: "/protector_elements/Heart_of_a_Hero.png",
    Hyper_Heart: "/protector_elements/Hyper_Heart.png",
    Lycanthropes_Pride: "/protector_elements/Lycanthrope's_Pride.png",
    Monster_and_Human_Mingling: "/protector_elements/Monster_and_Human_Mingling.png",
    New_Years_Blessing: "/protector_elements/New_Year's_Blessing.png",
    Octagram: "/protector_elements/Octagram.png",
    Octagram_Bazaar: "/protector_elements/Octagram_Bazaar.png",
    Octagram_Demon_Lord: "/protector_elements/Octagram_Demon_Lord.png",
    Ogres_Pride: "/protector_elements/Ogre's_Pride.png",
    Otherworlder: "/protector_elements/Otherworlder.png",
    Otherworld_Legend: "/protector_elements/Otherworld_Legend.png",
    Pariah: "/protector_elements/Pariah.png",
    Pretty_Sparkle: "/protector_elements/Pretty_Sparkle.png",
    Primal_Demon: "/protector_elements/Primal_Demon.png",
    Protector_of_Peace: "/protector_elements/Protector_of_Peace.png",
    Scarlet_Bond: "/protector_elements/Scarlet_Bond.png",
    Schemer: "/protector_elements/Schemer.png",
    Shizus_Will: "/protector_elements/Shizu's_Will.png",
    Spirit_Master: "/protector_elements/Spirit_Master.png",
    Stern_of_Spirit: "/protector_elements/Stern_of_Spirit.png",
    Summer_Memories: "/protector_elements/Summer_Memories.png",
    Tempest_Elite: "/protector_elements/Tempest_Elite.png",
    Ten_Great_Demon_Lords: "/protector_elements/Ten_Great_Demon_Lords.png",
    Valentine: "/protector_elements/Valentine.png",
    Visions_of_Coleus: "/protector_elements/Visions_of_Coleus.png",
    Warriors_Mind: "/protector_elements/Warrior's_Mind.png",
    Wholehearted_Devotion: "/protector_elements/Wholehearted_Devotion.png",
    Wielder_of_Magic: "/protector_elements/Wielder_of_Magic.png",
    World_of_Fantasy: "/protector_elements/World_of_Fantasy.png",
  }

  const statIconMap2: { [key: string]: string } = {
    Fire: "/elements/icElementFire.png",
    Water: "/elements/icElementWater.png",
    Earth: "/elements/icElementEarth.png",
    Space: "/elements/icElementspace.png",
    Wind: "/elements/icElementWind.png",
    Dark: "/elements/icElementDark.png",
    Light: "/elements/icElementlight.png",
    Adventurer: "/protector_elements/Adventurer.png",
    Antagonist: "/protector_elements/Antagonist.png",
    Axiom_of_Haze: "/protector_elements/Axiom_of_Haze.png",
    Clan_Chief: "/protector_elements/Clan_Chief.png",
    Commander: "/protector_elements/Commander.png",
    Demon_Lord_Invasion: "/protector_elements/Demon_Lord_Invasion.png",
    Determination_to_Prosper: "/protector_elements/Determination_to_Prosper.png",
    Dragon_Haki: "/protector_elements/Dragon_Haki.png",
    Exalted_Champions: "/protector_elements/Exalted_Champions.png",
    Festive_Memories: "/protector_elements/Festive_Memories.png",
    Flashback_Beatdown_Emissary: "/protector_elements/Flashback_Beatdown_Emissary.png",
    Forest_Fracas: "/protector_elements/Forest_Fracas.png",
    Fount_of_Wisdom: "/protector_elements/Fount_of_Wisdom.png",
    Frozen_Continent: "/protector_elements/Frozen_Continent.png",
    Gaining_Status: "/protector_elements/Gaining_Status.png",
    Goddess_of_Destiny: "/protector_elements/Goddess_of_Destiny.png",
    Heart_of_a_Hero: "/protector_elements/Heart_of_a_Hero.png",
    Hyper_Heart: "/protector_elements/Hyper_Heart.png",
    Lycanthropes_Pride: "/protector_elements/Lycanthrope's_Pride.png",
    Monster_and_Human_Mingling: "/protector_elements/Monster_and_Human_Mingling.png",
    New_Years_Blessing: "/protector_elements/New_Year's_Blessing.png",
    Octagram: "/protector_elements/Octagram.png",
    Octagram_Bazaar: "/protector_elements/Octagram_Bazaar.png",
    Octagram_Demon_Lord: "/protector_elements/Octagram_Demon_Lord.png",
    Ogres_Pride: "/protector_elements/Ogre's_Pride.png",
    Otherworlder: "/protector_elements/Otherworlder.png",
    Otherworld_Legend: "/protector_elements/Otherworld_Legend.png",
    Pariah: "/protector_elements/Pariah.png",
    Pretty_Sparkle: "/protector_elements/Pretty_Sparkle.png",
    Primal_Demon: "/protector_elements/Primal_Demon.png",
    Protector_of_Peace: "/protector_elements/Protector_of_Peace.png",
    Scarlet_Bond: "/protector_elements/Scarlet_Bond.png",
    Schemer: "/protector_elements/Schemer.png",
    Shizus_Will: "/protector_elements/Shizu's_Will.png",
    Spirit_Master: "/protector_elements/Spirit_Master.png",
    Stern_of_Spirit: "/protector_elements/Stern_of_Spirit.png",
    Summer_Memories: "/protector_elements/Summer_Memories.png",
    Tempest_Elite: "/protector_elements/Tempest_Elite.png",
    Ten_Great_Demon_Lords: "/protector_elements/Ten_Great_Demon_Lords.png",
    Valentine: "/protector_elements/Valentine.png",
    Visions_of_Coleus: "/protector_elements/Visions_of_Coleus.png",
    Warriors_Mind: "/protector_elements/Warrior's_Mind.png",
    Wholehearted_Devotion: "/protector_elements/Wholehearted_Devotion.png",
    Wielder_of_Magic: "/protector_elements/Wielder_of_Magic.png",
    World_of_Fantasy: "/protector_elements/World_of_Fantasy.png",
    All: "/ulti_type/aoe.png",
    Single: "/ulti_type/single.png",
    3: "starCharaL3A",
    4: "starCharaL4A",
    5: "starCharaL5A",
    EX_5: "starCharaL6A",
    Battle_Characters: "/type/attacker.png",
    Protection_Characters: "/type/protector.png",
    EX_Attack: "/char_type/attack.png",
    EX_Balance: "/char_type/balance.png",
    EX_Defense: "/char_type/defense.png",
    Anti_Fire: "/protector_elements/Anti-Fire.png",
    Anti_Water: "/protector_elements/Anti-Water.png",
    Anti_Earth: "/protector_elements/Anti-Earth.png",
    Anti_Space: "/protector_elements/Anti-Space.png",
    Anti_Wind: "/protector_elements/Anti-Wind.png",
    Anti_Dark: "/protector_elements/Anti-Dark.png",
    Anti_Light: "/protector_elements/Anti-Light.png",
  }

  function replaceTextWithLinksAndOptionalIcons(
    text: string,
    customTextToKeyMap: { [key: string]: string },
  ): React.ReactNode[] {
    // Split input by pipe character
    const parts = text.split("|").map((part) => part.trim())

    return parts.map((part, index) => {
      // Map part text to a key for icons
      const mappedKey = customTextToKeyMap[part] || part.replace(/[\s-]+/g, "_")

      // Get the icon if exists
      const icon = customIcons[mappedKey]

      return (
        <span key={index}>
          <Link
            href={`/characters?tag=${encodeURIComponent(part)}`}
            className="inline-flex items-center px-3 py-1 rounded-full bg-[#111827] text-white text-sm font-medium mx-0.5 hover:bg-[#909090] shadow-[0_0_8px_rgba(255,255,255,0.3)]"
          >
            {icon && <img src={icon || "/placeholder.svg"} alt={part} className="w-5 h-5 mr-2 object-contain" />}
            {part}
          </Link>
        </span>
      )
    })
  }

  function renderFilterTag(value: string, key: string) {
    const icon = statIconMap[key] // direct use of mapped key
    const iconSize = "w-5 h-5"
    const fontSize = "text-sm"
    const paddingX = "px-3"
    const paddingY = "py-1"

    return (
      <Link
        href={`/characters?tag=${encodeURIComponent(value)}`}
        className={`inline-flex items-center ${paddingX} ${paddingY} rounded-full bg-[#111827] text-white ${fontSize} font-medium mx-0.5 hover:bg-[#909090] shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
      >
        {icon && <img src={icon || "/placeholder.svg"} alt={value} className={`${iconSize} mr-2 object-contain`} />}
        {value}
      </Link>
    )
  }

  const textToKeyMap: { [key: string]: string } = {
    "Shizu's Will": "Shizus_Will",
    "Lycanthrope's Pride": "Lycanthropes_Pride",
    "New Year's Blessing": "New_Years_Blessing",
    "Ogre's Pride": "Ogres_Pride",
    "Warrior's Mind": "Warriors_Mind",
    "Axiom of Haze": "Axiom_of_Haze",
    "Clan Chief": "Clan_Chief",
    "Demon Lord Invasion": "Demon_Lord_Invasion",
    "Determination to Prosper": "Determination_to_Prosper",
    "Dragon Haki": "Dragon_Haki",
    "Exalted Champions": "Exalted_Champions",
    "Festive Memories": "Festive_Memories",
    "Flashback Beatdown Emissary": "Flashback_Beatdown_Emissary",
    "Forest Fracas": "Forest_Fracas",
    "Fount of Wisdom": "Fount_of_Wisdom",
    "Frozen Continent": "Frozen_Continent",
    "Gaining Status": "Gaining_Status",
    "Goddess of Destiny": "Goddess_of_Destiny",
    "Heart of a Hero": "Heart_of_a_Hero",
    "Hyper Heart": "Hyper_Heart",
    "Monster and Human Mingling": "Monster_and_Human_Mingling",
    "Octagram Bazaar": "Octagram_Bazaar",
    "Octagram Demon Lord": "Octagram_Demon_Lord",
    "Otherworld Legend": "Otherworld_Legend",
    "Pretty Sparkle": "Pretty_Sparkle",
    "Primal Demon": "Primal_Demon",
    "Protector of Peace": "Protector_of_Peace",
    "Scarlet Bond": "Scarlet_Bond",
    "Spirit Master": "Spirit_Master",
    "Stern of Spirit": "Stern_of_Spirit",
    "Summer Memories": "Summer_Memories",
    "Tempest Elite": "Tempest_Elite",
    "Ten Great Demon Lords": "Ten_Great_Demon_Lords",
    "Visions of Coleus": "Visions_of_Coleus",
    "Wholehearted Devotion": "Wholehearted_Devotion",
    "Wielder of Magic": "Wielder_of_Magic",
    "World of Fantasy": "World_of_Fantasy",
    "Anti-Fire": "Anti_Fire",
    "Anti-Water": "Anti_Water",
    "Anti-Earth": "Anti_Earth",
    "Anti-Space": "Anti_Space",
    "Anti-Wind": "Anti_Wind",
    "Anti-Dark": "Anti_Dark",
    "Anti-Light": "Anti_Light",
    "Battle Characters": "Battle_Characters",
    "Protection Characters": "Protection_Characters",
    "P- ATK": "P_",
    "M-ATK": "M_ATK",
  }

  // 2. Merge direct keys for exact-match fallback
  const allKeys = [...Object.keys(textToKeyMap), ...Object.keys(statIconMap)]

  // 3. Sort by length (important for greedy match)
  const sortedKeys = allKeys.sort((a, b) => b.length - a.length)

  // 4. Escape for regex
  function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }

  // Helper function to check if text should get button treatment (no links)
  function shouldGetButtonTreatment(text: string): boolean {
    // Check for HP, ATK, DEF
    if (["ATK", "DEF", "HP"].includes(text)) return true

    // Check for "Turns X" pattern
    if (/^Turns\s+\d+$/i.test(text)) return true

    // Check for "Unlimited" keyword
    if (/^Unlimited$/i.test(text)) return true

    // Check for "Uses by this character per battle: X" pattern
    if (/^Uses\s+by\s+this\s+character\s+per\s+battle:\s*\d+$/i.test(text)) return true

    return false
  }

  // 5. The main function - improved to prevent overlapping matches and only replace where patterns naturally occur
  function replaceStatTextWithIcons(text: string): React.ReactNode[] {
    const result: React.ReactNode[] = []
    let remainingText = text
    let keyIndex = 0

    while (remainingText.length > 0) {
      let foundMatch = false

      // Try to find the longest match at the beginning of remaining text
      for (const key of sortedKeys) {
        const regex = new RegExp(`^(${escapeRegex(key)})`, "i")
        const match = remainingText.match(regex)

        if (match) {
          const matchedText = match[1]
          const mappedKey = textToKeyMap[matchedText] || matchedText.replace(/[\s-]+/g, "_")
          const icon = statIconMap[mappedKey]

          if (icon) {
            if (shouldGetButtonTreatment(matchedText)) {
              // Button treatment with no link - proper glow and baseline alignment
              result.push(
                <span
                  key={keyIndex++}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-600 text-white text-xs font-medium mx-0.5 shadow-[0_0_8px_rgba(255,255,255,0.4)] align-baseline"
                  style={{ verticalAlign: "baseline" }}
                >
                  <img src={icon || "/placeholder.svg"} alt={matchedText} className="w-3 h-3 mr-1 object-contain" />
                  {matchedText}
                </span>,
              )
            } else {
              result.push(<span key={keyIndex++}>{renderFilterTag(matchedText, mappedKey)}</span>)
            }
          } else if (statIconMap[matchedText]) {
            const iconSize = matchedText === "ATK" ? "w-3 h-3" : "w-3 h-3"
            result.push(
              <span
                key={keyIndex++}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-600 text-white text-xs font-medium mx-0.5 shadow-[0_0_8px_rgba(255,255,255,0.4)] align-baseline"
                style={{ verticalAlign: "baseline" }}
              >
                <img
                  src={statIconMap[matchedText] || "/placeholder.svg"}
                  alt={matchedText}
                  className={`${iconSize} mr-1 object-contain`}
                />
                {matchedText}
              </span>,
            )
          } else {
            result.push(<span key={keyIndex++}>{matchedText}</span>)
          }

          remainingText = remainingText.slice(matchedText.length)
          foundMatch = true
          break
        }
      }

      // Check for special patterns that should get button treatment
      if (!foundMatch) {
        // Check for "Turns X" pattern
        const turnsMatch = remainingText.match(/^(Turns\s+\d+)/i)
        if (turnsMatch) {
          const matchedText = turnsMatch[1]
          result.push(
            <span
              key={keyIndex++}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-600 text-white text-xs font-medium mx-0.5 shadow-[0_0_8px_rgba(255,255,255,0.4)] align-baseline"
              style={{ verticalAlign: "baseline" }}
            >
              {matchedText}
            </span>,
          )
          remainingText = remainingText.slice(matchedText.length)
          foundMatch = true
        }
      }

      if (!foundMatch) {
        // Check for "Unlimited" pattern
        const unlimitedMatch = remainingText.match(/^(Unlimited)/i)
        if (unlimitedMatch) {
          const matchedText = unlimitedMatch[1]
          result.push(
            <span
              key={keyIndex++}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-600 text-white text-xs font-medium mx-0.5 shadow-[0_0_8px_rgba(255,255,255,0.4)] align-baseline"
              style={{ verticalAlign: "baseline" }}
            >
              {matchedText}
            </span>,
          )
          remainingText = remainingText.slice(matchedText.length)
          foundMatch = true
        }
      }

      if (!foundMatch) {
        // Check for "Uses by this character per battle: X" pattern
        const usesMatch = remainingText.match(/^(Uses\s+by\s+this\s+character\s+per\s+battle:\s*\d+)/i)
        if (usesMatch) {
          const matchedText = usesMatch[1]
          result.push(
            <span
              key={keyIndex++}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-600 text-white text-xs font-medium mx-0.5 shadow-[0_0_8px_rgba(255,255,255,0.4)] align-baseline"
              style={{ verticalAlign: "baseline" }}
            >
              {matchedText}
            </span>,
          )
          remainingText = remainingText.slice(matchedText.length)
          foundMatch = true
        }
      }

      if (!foundMatch) {
        // No match found, add the first character and continue
        result.push(<span key={keyIndex++}>{remainingText[0]}</span>)
        remainingText = remainingText.slice(1)
      }
    }

    return result.filter(Boolean)
  }

  // Combined function that handles both line breaks AND icon replacement
  function renderTextWithLineBreaksAndIcons(text: string): React.ReactNode {
    // Handle both literal \n and escaped \\n
    const lines = text.split(/\\n|\n/)

    return (
      <div className="space-y-1">
        {lines.map((line, idx) => (
          <div key={idx} className="block">
            {replaceStatTextWithIcons(line.trim())}
          </div>
        ))}
      </div>
    )
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
  const maxFinalAttack = Math.max(...characters.map((c) => c.final_attack))
  const maxFinalDefense = Math.max(...characters.map((c) => c.final_defense))
  const maxFinalHealth = Math.max(...characters.map((c) => c.final_health))
  const maxOutput = Math.max(...characters.map((c) => c.output_final))

  const variants = characters.filter((c) => c.name === character.name && c.id !== characterId)

  // Calculate percentages for this character, fallback to 0 if max is 0
  const attackPercent = maxFinalAttack ? (character.final_attack / maxFinalAttack) * 100 : 0
  const defensePercent = maxFinalDefense ? (character.final_defense / maxFinalDefense) * 100 : 0
  const healthPercent = maxFinalHealth ? (character.final_health / maxFinalHealth) * 100 : 0
  const outputPercent = maxOutput ? (character.output_final / maxOutput) * 100 : 0

  const maxExistence = Math.max(...characters.map((c) => c.final_health + c.final_attack * 5 + c.final_defense * 2.5))

  // Calculate this character's existence
  const charExistence = character.final_health + character.final_attack * 5 + character.final_defense * 2.5

  // Calculate existence percentage relative to max
  const existencePercent = maxExistence ? (charExistence / maxExistence) * 100 : 0

  // Parse pipe-separated values
  const forcesList = character.force.split("|").filter((force) => force.trim())
  const tagsList = character.tag.split("|").filter((tag) => tag.trim())

  function SkillCard({
    skill,
    isEvolution = false,
    baseImage,
  }: {
    skill: any
    isEvolution?: boolean
    baseImage?: string
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
        <div className="text-gray-300 text-sm leading-relaxed">{replaceStatTextWithIcons(skill.description)}</div>
      </div>
    )
  }

  // ---- In your render section ----
  const base1 = character.battle_skills?.find((s) => s.imageName === "b1.png")
  const base2 = character.battle_skills?.find((s) => s.imageName === "b2.png")
  const evo1 = character.battle_skills?.find((s) => s.imageName === "b3.png")
  const evo2 = character.battle_skills?.find((s) => s.imageName === "b4.png")

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
            <img src={`/chars/${character.id}/image.png`} alt={character.name} className="w-full h-full object-cover" />
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
                    <span className="text-white font-medium">
                      {(
                        character.initial_health +
                        character.initial_attack * 5 +
                        character.initial_defense * 2.5
                      ).toLocaleString()}
                    </span>
                    <span className="text-gray-500 text-sm">
                      {(
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
              <div className="flex flex-wrap gap-1">
                {forcesList.map((force, index) => (
                  <div key={index} className="text-gray-300 text-sm leading-relaxed">
                    {replaceStatTextWithIcons(force)}
                  </div>
                ))}
              </div>
            </div>

            {/* Tags Section */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-gray-300 uppercase tracking-wider">TAGS</h2>
              <div className="flex flex-wrap gap-1">
                {tagsList.map((tag, index) => (
                  <div key={index} className="text-gray-300 text-sm leading-relaxed">
                    {replaceTextWithLinksAndOptionalIcons(tag, customMap)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Battle Skills Section */}
        {character.type === "attacker" && (
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

        {character.type === "protector" && character.divine_skills && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">DIVINE PROTECTION</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {character.divine_skills.map((skill, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-start space-x-3 mb-3">
                    {skill.imageName ? (
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                        <img
                          src={skill.imageName || "/placeholder.svg"}
                          alt={skill.attackName}
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                    ) : null}

                    <div className={skill.imageName ? "" : "ml-1"}>
                      <h3 className="text-white font-medium">{skill.attackName}</h3>
                      {skill.extraText && <p className="text-blue-400 text-sm">{skill.extraText}</p>}
                    </div>
                  </div>
                  <div className="text-gray-300 text-sm leading-relaxed">
                    {replaceStatTextWithIcons(skill.description)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Secret Skills Section */}
        {character.type === "attacker" && character.secret_skills && (
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
                      {skill.extraText && <p className="text-blue-400 text-sm">{skill.extraText}</p>}
                    </div>
                  </div>
                  <div className="text-gray-300 text-sm leading-relaxed">
                    {replaceStatTextWithIcons(skill.description)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* True Attribute Unbound Section */}
        {character.element.includes("ex") && character.type === "attacker" && character.unbound && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">
              True Attribute Unbound
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {character.unbound.map((skill, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                      <img
                        src={`/elements/Enhanced${character.element.replace(/^(ex_|prot_)+/, "")}.png`}
                        alt="unbound"
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                  </div>
                  <div className="text-gray-300 text-sm leading-relaxed">
                    {replaceStatTextWithIcons(skill.description)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Protection Skill Section */}
        {character.type === "protector" && character.protection_skill && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-6 text-gray-300 uppercase tracking-wider">PROTECTION SKILL</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {character.protection_skill.map((skill, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                      <img
                        src={`/chars/${character.id}/prot.png`}
                        alt={skill.attackName}
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{skill.attackName}</h3>
                      {skill.extraText && <p className="text-blue-400 text-sm">{skill.extraText}</p>}
                    </div>
                  </div>
                  <div className="text-gray-300 text-sm leading-relaxed">
                    {replaceStatTextWithIcons(skill.description)}
                  </div>
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
                    {skill.extraText && <p className="text-blue-400 text-sm">{skill.extraText}</p>}
                  </div>
                </div>
                <div className="text-gray-300 text-sm leading-relaxed">
                  {replaceStatTextWithIcons(skill.description)}
                </div>
              </div>
            ))}

            {character.type === "protector" &&
              character.guidance_trait?.map((skill, index) => (
                <div key={`guidance-${index}`} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div>
                      <h3 className="text-white font-medium">Enhance Guidance</h3>
                    </div>
                  </div>
                  <div className="text-gray-300 text-sm leading-relaxed">
                    {replaceStatTextWithIcons(skill.description)}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* EX Abilities Section */}
        {character.type === "attacker" && character.ex_abilities && (
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
                      {skill.extraText && <p className="text-blue-400 text-sm">{skill.extraText}</p>}
                    </div>
                  </div>
                  <div className="text-gray-300 text-sm leading-relaxed">
                    {renderTextWithLineBreaksAndIcons(skill.description)}
                  </div>
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
