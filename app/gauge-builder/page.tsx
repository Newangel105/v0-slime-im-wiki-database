import GaugeBuilderTable from "@/components/gauge-builder-table"
import { ClassicGaugeBuilderTable } from "@/components/classic/gauge-builder-table"
import { getDesign } from "@/lib/design"
import { NkBoard, NkHeaderPod } from "@/components/nightink/pod-kit"
import { extractGaugeEntries } from "@/lib/gauge-parser"

export default async function GaugeBuilderPage() {
  const design = await getDesign()
  const gaugeEntries = await extractGaugeEntries()

  if (design === "nightink") {
    return (
      <NkBoard>
        <NkHeaderPod
          kicker="Heart Gauge Tool"
          title="Gauge "
          accent="Builder"
          sub="Plan and compare heart-gauge generation across characters, skills and turns."
        />
        <div className="nk-toolskin" style={{ marginTop: 28 }}>
          <GaugeBuilderTable gaugeEntries={gaugeEntries} />
        </div>
      </NkBoard>
    )
  }

  return (
    <main className="site-page slime-page-gauge-builder px-2 py-6 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-8">
        <section className="w-full">
          {design === "classic" ? (
            <ClassicGaugeBuilderTable gaugeEntries={gaugeEntries} />
          ) : (
            <GaugeBuilderTable gaugeEntries={gaugeEntries} />
          )}
        </section>
      </div>
    </main>
  )
}
