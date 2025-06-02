import characters from '../app/data/characters.json'

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
  return characters.map((char: any) => ({
    ...char,
    stars: Number(char.stars),
    awakening: Number(char.awakening),
    skills: typeof char.skills === 'string' ? char.skills.split('|') : char.skills,
    traits: typeof char.traits === 'string' ? char.traits.split('|') : char.traits,
    force: typeof char.force === 'string' ? char.force.split('|') : char.force,
    attack: Number(char.attack),
    health: Number(char.health),
    defense: Number(char.defense),
    existence: Number(char.existence),
    rarity: Number(char.rarity),
  }))
}
