import characters from '../app/data/characters.json'

export type Skill = {
  imageName: string
  attackName: string
  extraText?: string
  description: string
}

export type Skillprot = {
  attackName: string
  extraText?: string
  description: string
}

export type Trait = {
  imageName: string
  attackName: string
  description: string
  extraText?: string
}

export type divine = {
  imageName?: string
  attackName: string
  extraText?: string
  description: string
}

export type unbound = {
  attackName?: string
  extraText?: string
  description: string
}

export type Character = {
  id: string
  name: string
  sub_name: string
  element: string
  stars: number
  weapon?: string
  dmg_type: string
  type: string
  char_type?: string
  ulti?: string
  force: string[]
  tag: string[]
  release: string
  image?: string
  initial_attack: number
  initial_health: number
  initial_defense: number
  final_attack: number
  final_health: number
  final_defense: number
  output_initial: number
  output_final: number
  battle_skills?: Skill[]
  protection_skill?: Skillprot[]
  secret_skills?: Skill[]
  skill_traits: Trait[]
  divine_skills?: divine[]
  unbound?: unbound[]
  ex_abilities?: Trait[]
  guidance_trait?: unbound[]
}

export function getAllCharacters(): Character[] {
  return characters.map((char: any) => {
    const final_attack = Number(char.final_attack)
    const final_health = Number(char.final_health)
    const final_defense = Number(char.final_defense)

    const existence = final_health + final_attack * 5 + final_defense * 2.5

    return {
      ...char,
      id: Number(char.id),
      stars: Number(char.stars),
      final_attack: Number(char.final_attack),
      final_health: Number(char.final_health),
      final_defense: Number(char.final_defense),
      output_initial: Number(char.output_initial),
      output_final: Number(char.output_final),
      existence,

      force: typeof char.force === 'string' ? char.force.split('|') : char.force,
      tag: typeof char.force === 'string' ? char.tag.split('|') : char.tag,

      // Only assign if present
      ...(char.battle_skills && { battle_skills: char.battle_skills }),
      ...(char.protection_skill && { protection_skill: char.protection_skill }),
      ...(char.secret_skills && { secret_skills: char.secret_skills }),
      ...(char.skill_traits && { skill_traits: char.skill_traits }),
      ...(char.unbound && { unbound: char.unbound }),
      ...(char.ex_abilities && { ex_abilities: char.ex_abilities }),
      ...(char.divine_skills && { divine_skills: char.divine_skills }),
      ...(char.guidance_trait && { guidance_trait: char.guidance_trait })
    }

  })
}