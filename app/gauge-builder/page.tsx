import GaugeBuilderTable from "@/components/gauge-builder-table"

export default function GaugeBuilderPage() {
  return (
    <main className="min-h-screen bg-[#111827] px-2 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Gauge Traits</h1>
        </div>
        <GaugeBuilderTable />
      </div>
    </main>
  )
}
