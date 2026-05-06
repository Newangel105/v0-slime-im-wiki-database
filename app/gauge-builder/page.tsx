import GaugeBuilderTable from "@/components/gauge-builder-table"

export default function GaugeBuilderPage() {
  return (
    <main className="site-page px-2 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full flex flex-col gap-12">
        <div className="mx-auto w-full max-w-7xl px-2 sm:px-0">
          <p className="section-kicker">Trait Planning</p>
          <h1 className="section-title mt-2">Trait Chart</h1>
        </div>
        <div className="flex flex-col gap-8">

          <GaugeBuilderTable />
        </div>
      </div>
    </main>
  )
}
