import OrbConverterTable from "@/components/orb-converter-table"
import { ClassicOrbConverterTable } from "@/components/classic/orb-converter-table"
import { getDesign } from "@/lib/design"

export default async function OrbConverterPage() {
  const design = await getDesign()
  return (
    <main className="site-page slime-page-orb-converter px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        {design === "classic" ? <ClassicOrbConverterTable /> : <OrbConverterTable />}
      </div>
    </main>
  )
}
