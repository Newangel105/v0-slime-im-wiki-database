import { SummonSimulator } from "@/components/summon-simulator"
import { getSummonData } from "@/lib/summon-data"

export const metadata = { title: "Summon Simulator | SLIME.WIKI" }

export default function SummonPage() {
  return <SummonSimulator data={getSummonData()} />
}
