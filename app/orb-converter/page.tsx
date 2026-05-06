import OrbConverterTable from "@/components/orb-converter-table"

export default function OrbConverterPage() {
  return (
    <main className="site-page px-2 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full flex flex-col gap-8">
        <div className="mx-auto w-full max-w-7xl px-2 sm:px-0">
          <p className="section-kicker">Soul Routing</p>
          <h1 className="section-title mt-2">Orb Converters</h1>
        </div>
        <OrbConverterTable />
      </div>
    </main>
  )
}
