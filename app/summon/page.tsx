import { SummonSimulator } from "@/components/summon-simulator"
import { getSummonData } from "@/lib/summon-data"
import { getDesign } from "@/lib/design"
import { ArchiveBackground } from "@/components/nightink/archive-background"

export const metadata = { title: "Summon Simulator | SLIME.WIKI" }

// Render at request time, not build time. summon.generated.json is 55 MB;
// pre-rendering this page at build forced webpack/Next to parse the whole
// blob in a single build worker, which OOMs Vercel's 8 GB Hobby container.
// At request time the data is read via fs in the serverless function
// (Vercel functions get 1 GB which handles the parse comfortably), then
// cached in module scope for subsequent requests in the same instance.
export const dynamic = "force-dynamic"

export default async function SummonPage() {
  const data = await getSummonData()
  const design = await getDesign()

  // nightink: the immersive gacha panel keeps its intentional in-game art/colours
  // (rarity golds, banner plates); we only swap the beach backdrop for the dark
  // night-ink board canvas so the page sits consistently in the site design.
  if (design === "nightink") {
    return (
      <div className="board v2 grain summon-nightink">
        <ArchiveBackground />
        <SummonSimulator data={data} />
      </div>
    )
  }

  return <SummonSimulator data={data} />
}
