// lib/getCharacters.ts
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

export type Character = {
  id: string
  name: string
  element: string
  stars: number
  weapon: string
  awakening: number
  dmg_type: string
  type: string
  char_type: string
  ulti: string
  skills: string[]
  traits: string[]
  force: string[]
  town: string
  image: string
  attack: number
  health: number
  defense: number
  existence: number
  rarity: number
}

export function getAllCharacters(): Character[] {
  const filePath = path.join(process.cwd(), 'app/data/characters.csv')
  const file = fs.readFileSync(filePath, 'utf8')
  const parsed = Papa.parse(file, { header: true })

  const characters: Character[] = parsed.data.map((row: any) => ({
    id: row.id,
    name: row.name,
    element: row.element,
    stars: Number(row.stars),
    weapon: row.weapon,
    awakening: Number(row.awakening),
    dmg_type: row.dmg_type,
    type: row.type,
    char_type: row.char_type,
    ulti: row.ulti,
    skills: row.skills.split('|'),
    traits: row.traits.split('|'),
    force: row.force.split('|'),
    town: row.town,
    image: row.image,
    attack: Number(row.attack),
    health: Number(row.health),
    defense: Number(row.defense),
    existence: Number(row.existence),
    rarity: Number(row.rarity),
  }))

  return characters
}
