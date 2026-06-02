import { SummonSimulator } from "@/components/summon-simulator"
import { getSummonData } from "@/lib/summon-data"

export const metadata = { title: "Summon Simulator | SLIME.WIKI" }

// Render at request time, not build time. summon.generated.json is 55 MB;
// pre-rendering this page at build forced webpack/Next to parse the whole
// blob in a single build worker, which OOMs Vercel's 8 GB Hobby container.
// At request time the data is read via fs in the serverless function
// (Vercel functions get 1 GB which handles the parse comfortably), then
// cached in module scope for subsequent requests in the same instance.
export const dynamic = "force-dynamic"

export default async function SummonPage() {
  return <SummonSimulator data={await getSummonData()} />
}
