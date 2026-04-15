import OrbConverterTable from "@/components/orb-converter-table"

export default function OrbConverterPage() {
  return (
    <main className="min-h-screen bg-[#111827] px-2 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full flex flex-col gap-8">
        <OrbConverterTable />
      </div>
    </main>
  )
}
