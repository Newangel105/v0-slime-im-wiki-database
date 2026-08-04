import { SummonSimulatorShell } from "@/components/summon-simulator-shell"
import { getDesign } from "@/lib/design"

export const metadata = { title: "Summon Simulator | SLIME.WIKI" }

export default async function SummonPage() {
  const design = await getDesign()

  // The summon payload (~55 MB) is fetched client-side by SummonSimulatorShell
  // instead of here: passing it as a prop from this Server Component would
  // serialize the whole thing into the page's RSC payload even though the
  // simulator itself is ssr:false, which blew Vercel's 19 MB ISR snapshot limit.

  // nightink: the immersive gacha panel keeps its intentional in-game art/colours
  // (rarity golds, banner plates); we only swap the beach backdrop for the dark
  // night-ink board canvas so the page sits consistently in the site design.
  if (design === "nightink") {
    return (
      <div className="board v2 summon-nightink">
        <SummonSimulatorShell />
      </div>
    )
  }

  return <SummonSimulatorShell />
}
