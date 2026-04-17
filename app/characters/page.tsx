import { Suspense } from "react"
import { CharacterBrowser } from "@/components/character-browser"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"

export default function CharactersPage() {
  const characters = getAllCharacterBrowserData()
  return (
    <>
      {/* Preload the above-the-fold LCP portrait so the browser fetches it immediately */}
      <link rel="preload" as="image" href="/Image/Character/PC/GuyBlackHero/7/GuyBlackHero_7_CharaPartyM.webp" fetchPriority="high" />
      <Suspense>
        <CharacterBrowser initialCharacters={characters} />
      </Suspense>
    </>
  )
}
