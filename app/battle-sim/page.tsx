import { BattleSim } from "@/components/battle-sim"
import { getAllWikiCharacters } from "@/lib/pc-wiki"
import { getAllEnemies } from "@/lib/enemies"

export const metadata = { title: "Battle Sim WIP | Slime.Wiki" }

export default function BattleSimPage() {
  return <BattleSim characters={getAllWikiCharacters()} enemies={getAllEnemies()} />
}
