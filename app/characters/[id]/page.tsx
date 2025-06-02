import { notFound } from 'next/navigation'

type Props = {
  params: { id: string }
}

export default function CharacterDetailPage({ params }: Props) {
  const { id } = params

  // In production, you'd fetch real data here
  const mockCharacter = {
    id,
    name: "Test Character",
    image: "/placeholder.svg",
    element: "fire",
  }

  if (!mockCharacter) return notFound()

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-4">Character #{id}: {mockCharacter.name}</h1>
      <img
        src={mockCharacter.image}
        alt={mockCharacter.name}
        className="w-48 h-48 object-contain"
      />
      <p className="mt-4">Element: {mockCharacter.element}</p>
    </div>
  )
}
