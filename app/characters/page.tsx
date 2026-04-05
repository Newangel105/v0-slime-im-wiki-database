import CharacterBrowserServer from "@/components/character-browser.server"
import { getAllWikiCharacters } from "@/lib/pc-wiki"

export default function CharactersPage() {
  const characters = getAllWikiCharacters()
  return <CharacterBrowserServer characters={characters} />
}