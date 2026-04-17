import { Suspense } from "react"
import { CharacterBrowser } from "@/components/character-browser"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"

export default function CharactersPage() {
  const characters = getAllCharacterBrowserData()
  return (
    <Suspense>
      <CharacterBrowser initialCharacters={characters} />
    </Suspense>
  )
}
