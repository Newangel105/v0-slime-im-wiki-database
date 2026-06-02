import { CharacterBrowser } from "@/components/character-browser"
import { ClassicCharacterBrowser } from "@/components/classic/character-browser"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"
import { getDesign } from "@/lib/design"

export default async function CharactersPage() {
  const characters = getAllCharacterBrowserData()
  const design = await getDesign()
  return (
    <>
      {/* Preload the top 3 portraits by default release_date sort (Guy, Velzard, Dodomeki) */}
      <link rel="preload" as="image" href="/Image/Character/PC/GuyBlackHero/7/GuyBlackHero_7_CharaPartyM.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/Image/Character/Bless/WerzardBlackHero/7/WerzardBlackHero_7_BlessPartyM.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/Image/Character/PC/ShionBeforeAnotherPC/7/ShionBeforeAnotherPC_7_CharaPartyM.webp" fetchPriority="high" />
      {design === "classic" ? (
        <ClassicCharacterBrowser initialCharacters={characters} />
      ) : (
        <CharacterBrowser initialCharacters={characters} />
      )}
    </>
  )
}
