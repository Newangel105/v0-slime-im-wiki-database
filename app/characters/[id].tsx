// pages/character/[id].tsx
import { useRouter } from "next/router"

export default function CharacterPage() {
  const router = useRouter()
  const { id } = router.query

  // You can fetch character data here or pass it as props
  return (
    <div className="p-4 text-white">
      <h1 className="text-2xl font-bold">Character ID: {id}</h1>
      {/* Show character details based on ID */}
    </div>
  )
}
