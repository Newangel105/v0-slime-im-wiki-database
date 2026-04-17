import { CharacterBrowser } from "@/components/character-browser"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"

export default function CharactersPage() {
  const characters = getAllCharacterBrowserData()
  return (
    <>
      {/* Preload the top 3 portraits by default release_date sort (Guy, Velzard, Dodomeki) */}
      <link rel="preload" as="image" href="/Image/Character/PC/GuyBlackHero/7/GuyBlackHero_7_CharaPartyM.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/Image/Character/Bless/WerzardBlackHero/7/WerzardBlackHero_7_BlessPartyM.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/Image/Character/PC/ShionBeforeAnotherPC/7/ShionBeforeAnotherPC_7_CharaPartyM.webp" fetchPriority="high" />
      <CharacterBrowser initialCharacters={characters} />
    </>
  )
}
