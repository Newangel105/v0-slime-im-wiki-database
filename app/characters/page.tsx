import { CharacterBrowser } from "@/components/character-browser"
import { ClassicCharacterBrowser } from "@/components/classic/character-browser"
import { NightInkCharactersBrowser } from "@/components/nightink/characters-browser"
import { getCharacterIndexData } from "@/components/nightink/characters-browser-data"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"
import { getDesign } from "@/lib/design"

export default async function CharactersPage() {
  const design = await getDesign()

  // nightink is THE design: a faithful port of the ecosystem-live prototype,
  // reading the SAME character dataset as the other branches (lib/pc-wiki) via
  // a thin server adapter. ocean/classic stay wired for the rollback cookie.
  if (design === "nightink") {
    return <NightInkCharactersBrowser characters={await getCharacterIndexData()} />
  }

  const { browserCharacters, wikiCharacters } = await getAllCharacterBrowserData()
  return (
    <>
      {/* Preload the top 3 portraits by default release_date sort (Guy, Velzard, Dodomeki) */}
      <link rel="preload" as="image" href="/Image/Character/PC/GuyBlackHero/7/GuyBlackHero_7_CharaPartyM.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/Image/Character/Bless/WerzardBlackHero/7/WerzardBlackHero_7_BlessPartyM.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/Image/Character/PC/ShionBeforeAnotherPC/7/ShionBeforeAnotherPC_7_CharaPartyM.webp" fetchPriority="high" />
      {design === "classic" ? (
        <ClassicCharacterBrowser initialCharacters={browserCharacters} wikiCharacters={wikiCharacters} />
      ) : (
        <CharacterBrowser initialCharacters={browserCharacters} wikiCharacters={wikiCharacters} />
      )}
    </>
  )
}
