import GaugeBuilderTable from "@/components/gauge-builder-table"
import { ClassicGaugeBuilderTable } from "@/components/classic/gauge-builder-table"
import { getDesign } from "@/lib/design"

export default async function GaugeBuilderPage() {
  const design = await getDesign()
  return (
    <main className="site-page slime-page-gauge-builder px-2 py-6 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-8">
        <section className="w-full">
          {design === "classic" ? <ClassicGaugeBuilderTable /> : <GaugeBuilderTable />}
        </section>
      </div>
    </main>
  )
}
