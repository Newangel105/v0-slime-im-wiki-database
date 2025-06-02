import { use } from 'react'
import { notFound } from 'next/navigation'

type Params = { params: { id: string } }

export default async function CharacterPage({ params }: Params) {
  const { id } = params

  // Replace with your real data fetch logic
  const character = await getCharacterById(id)

  if (!character) return notFound()

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-4">{character.name}</h1>
      <img src={character.image || "/placeholder.svg"} alt={character.name} className="w-64 h-64 object-contain" />
      <p className="mt-4">Element: {character.element}</p>
      {/* Add more character details here */}
    </div>
  )
}

// Dummy example – replace with actual fetch logic (e.g., database or file)
async function getCharacterById(id: string) {
  const res = await fetch(`https://your-api/characters/${id}`)
  if (!res.ok) return null
  return res.json()
}
