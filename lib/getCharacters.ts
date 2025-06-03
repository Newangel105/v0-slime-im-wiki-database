import characters from '../app/data/characters.json'

export type Skill = {
  imageName: string
  attackName: string
  extraText?: string
  description: string
}

export type Trait = {
  imageName: string
  attackName: string
  description: string
}

export type Character = {
  id: string
  name: string
  sub_name: string
  element: string
  stars: number
  weapon: string
  dmg_type: string
  type: string
  char_type: string
  ulti: string
  force: string[]
  tag: string[]
  release: string
  town: string
  image: string
  initial_attack: number
  initial_health: number
  initial_defense: number
  final_attack: number
  final_health: number
  final_defense: number
  output_initial: number
  output_final: number
  rarity: number
  battle_skills: Skill[]
  secret_skills: Skill[]
  skill_traits: Trait[]
  ex_abilities: Trait[]
}

export function getAllCharacters(): Character[] {
  return characters.map((char: any) => {
    const initial_attack = Number(char.initial_attack)
    const initial_health = Number(char.initial_health)
    const initial_defense = Number(char.initial_defense)

    const existence = initial_health + initial_attack * 5 + initial_defense * 2.5

    return {
      ...char,
      id: Number(char.id),
      stars: Number(char.stars),
      rarity: Number(char.rarity),
      initial_attack,
      initial_health,
      initial_defense,
      final_attack: Number(char.final_attack),
      final_health: Number(char.final_health),
      final_defense: Number(char.final_defense),
      output_initial: Number(char.output_initial),
      output_final: Number(char.output_final),
      existence,

      // Parse string to array if needed
      force: typeof char.force === 'string' ? char.force.split('|') : char.force,
      tag: typeof char.force === 'string' ? char.tag.split('|') : char.tag,

      // Ensure skills arrays are present and valid
      battle_skills: char.battle_skills ?? [],
      secret_skills: char.secret_skills ?? [],
      skill_traits: char.skill_traits ?? [],
      ex_abilities: char.ex_abilities ?? [],
    }
  })
}