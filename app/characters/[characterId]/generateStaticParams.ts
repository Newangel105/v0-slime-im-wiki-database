import { getAllWikiCharacters } from "@/lib/pc-wiki"

export async function generateStaticParams() {
  const characters = await getAllWikiCharacters()
  return characters.map((character) => ({ characterId: String(character.master_pc_id) }))
}
