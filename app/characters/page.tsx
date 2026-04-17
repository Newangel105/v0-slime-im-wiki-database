import { Suspense } from "react"
import { CharacterBrowser } from "@/components/character-browser"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"

export default function CharactersPage() {
  const characters = getAllCharacterBrowserData()
  return (
    <>
      {/* Preload the top 6 portraits by default release_date sort so the browser fetches them before JS runs */}
      <link rel="preload" as="image" href="/Image/Character/Bless/WerzardBlackHero/7/WerzardBlackHero_7_BlessPartyM.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/Image/Character/PC/GuyBlackHero/7/GuyBlackHero_7_CharaPartyM.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/Image/Character/PC/RimuruAnotherHA2026/7/RimuruAnotherHA2026_7_CharaPartyM.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/Image/Character/PC/ShionBeforeAnotherPC/7/ShionBeforeAnotherPC_7_CharaPartyM.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/Image/Character/Bless/RimuruSlimeBlackHero/4/RimuruSlimeBlackHero_4_BlessPartyM.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/Image/Character/Bless/ShizuBlackHero/5/ShizuBlackHero_5_BlessPartyM.webp" fetchPriority="high" />
      <Suspense>
        <CharacterBrowser initialCharacters={characters} />
      </Suspense>
    </>
  )
}
