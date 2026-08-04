import { SummonSimulatorShell } from "@/components/summon-simulator-shell"
import { getSummonData } from "@/lib/summon-data"
import { getDesign } from "@/lib/design"

export const metadata = { title: "Summon Simulator | SLIME.WIKI" }

// The summon payload is large, so we keep it cached for one hour rather than
// re-rendering this page on every request. That avoids repeated server work while
// still letting the data refresh periodically.
export const revalidate = 3600

export default async function SummonPage() {
  const data = await getSummonData()
  const design = await getDesign()

  // nightink: the immersive gacha panel keeps its intentional in-game art/colours
  // (rarity golds, banner plates); we only swap the beach backdrop for the dark
  // night-ink board canvas so the page sits consistently in the site design.
  if (design === "nightink") {
    return (
      <div className="board v2 summon-nightink">
        <SummonSimulatorShell data={data} />
      </div>
    )
  }

  return <SummonSimulatorShell data={data} />
}
