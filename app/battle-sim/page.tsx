import { BattleSim } from "@/components/battle-sim"
import { getAllWikiCharacters } from "@/lib/pc-wiki"
import { getAllEnemies } from "@/lib/enemies"

export const metadata = { title: "Battle Sim WIP | Slime.Wiki" }

export default function BattleSimPage() {
  const characters = getAllWikiCharacters()
  const enemies = getAllEnemies()
  return <BattleSim characters={characters} enemies={enemies} />
}
