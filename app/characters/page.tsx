import { CharacterBrowser } from "@/components/character-browser"
import { getAllCharacterBrowserData } from "@/lib/character-browser-data"

export default function CharactersPage() {
  return <CharacterBrowser characters={getAllCharacterBrowserData()} />
}