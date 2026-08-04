import OrbConverterTable from "@/components/orb-converter-table"
import { ClassicOrbConverterTable } from "@/components/classic/orb-converter-table"
import { getDesign } from "@/lib/design"
import { NkBoard, NkHeaderPod } from "@/components/nightink/pod-kit"
import { extractOrbConvertEntries } from "@/lib/orb-converter-parser"

export default async function OrbConverterPage() {
  const design = await getDesign()
  const entries = await extractOrbConvertEntries()

  // nightink: keep the original table (the gauge-builder style the user prefers),
  // re-themed via the toolskin and framed by the board + header pod.
  if (design === "nightink") {
    return (
      <NkBoard>
        <NkHeaderPod
          kicker="Conversion Index"
          title="Orb "
          accent="Converter"
          sub="Every character whose skills convert battle orbs — grouped by target orb, source type and SP cost."
        />
        <div className="nk-toolskin" style={{ marginTop: 28 }}>
          <OrbConverterTable entries={entries} />
        </div>
      </NkBoard>
    )
  }

  return (
    <main className="site-page slime-page-orb-converter px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        {design === "classic" ? <ClassicOrbConverterTable entries={entries} /> : <OrbConverterTable entries={entries} />}
      </div>
    </main>
  )
}
