import { CharacterBrowser } from "@/components/character-browser"
import { getAllWikiCharacters } from "@/lib/pc-wiki"

export default function CharactersPage() {
  return <CharacterBrowser characters={getAllWikiCharacters()} />
}