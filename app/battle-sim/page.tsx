import { BattleSim } from "@/components/battle-sim"
import { getAllWikiCharacters } from "@/lib/pc-wiki"
import { getAllEnemies } from "@/lib/enemies"
import { getDesign } from "@/lib/design"
import { NkBoard, NkHeaderPod } from "@/components/nightink/pod-kit"

export const metadata = { title: "Battle Sim WIP | Slime.Wiki" }

// Hidden from the nav (work in progress) but kept reachable by URL; still painted
// in the night-ink design so it survives the removal of the old designs.
export default async function BattleSimPage() {
  const characters = await getAllWikiCharacters()
  const enemies = await getAllEnemies()
  const design = await getDesign()

  if (design === "nightink") {
    return (
      <NkBoard>
        <NkHeaderPod kicker="Work in Progress" title="Battle " accent="Sim" sub="An experimental battle simulator — still a work in progress." />
        <div className="nk-toolskin" style={{ marginTop: 28 }}>
          <BattleSim characters={characters} enemies={enemies} />
        </div>
      </NkBoard>
    )
  }

  return <BattleSim characters={characters} enemies={enemies} />
}
