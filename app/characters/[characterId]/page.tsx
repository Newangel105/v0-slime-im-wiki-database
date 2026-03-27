import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, Heart, Shield, Sparkles, Sword } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatWikiLabel,
  getCharacterRarityLabel,
  getDisplayElementLabel,
  getWikiCharacterById,
  stripColorTags,
  toPublicAssetPath,
} from "@/lib/pc-wiki"

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-[0_0_24px_rgba(255,255,255,0.08)]">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-gray-400">{title}</p>
      </div>
      {children}
    </section>
  )
}

export default function CharacterDetailPage({ params }: { params: { characterId: string } }) {
  const resolvedCharacter = getWikiCharacterById(Number(params.characterId))

  if (!resolvedCharacter) {
    notFound()
    return null
  }

  const character = resolvedCharacter
  const elementLabel = getDisplayElementLabel(character.element)
  const attackTypeLabel = formatWikiLabel(character.attack_type)
  const weaponLabel = formatWikiLabel(character.weapon_type)
  const rarityLabel = getCharacterRarityLabel(character)

  return (
    <main className="min-h-screen bg-[#111827] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/characters" className="inline-flex items-center gap-2 rounded-full border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700">
            <ArrowLeft className="h-4 w-4" />
            Back to characters
          </Link>
          <Badge className="bg-gray-700 text-white hover:bg-gray-700">#{character.master_pc_id}</Badge>
        </div>

        <section className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-[0_0_24px_rgba(255,255,255,0.08)]">
          <div className="grid gap-8 px-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
            <div className="space-y-5">
              <Badge className="bg-gray-700 text-white hover:bg-gray-700">{character.affiliation_name}</Badge>
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{character.name}</h1>
                <p className="mt-2 text-lg text-gray-300">{elementLabel} {attackTypeLabel} {weaponLabel} specialist</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-gray-700 text-white">{character.tactics_type}</Badge>
                <Badge variant="secondary" className="bg-gray-700 text-white">{rarityLabel}</Badge>
                <Badge variant="secondary" className="bg-gray-700 text-white">{character.release_date}</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <Card className="rounded-xl border-gray-700 bg-gray-900 shadow-none">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Heart className="h-5 w-5 text-white" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">HP</p>
                      <p className="text-xl font-semibold text-white">{character.stats.hp}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl border-gray-700 bg-gray-900 shadow-none">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Sword className="h-5 w-5 text-white" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">ATK</p>
                      <p className="text-xl font-semibold text-white">{character.stats.attack}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl border-gray-700 bg-gray-900 shadow-none">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Shield className="h-5 w-5 text-white" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">DEF</p>
                      <p className="text-xl font-semibold text-white">{character.stats.defense}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl border-gray-700 bg-gray-900 shadow-none">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Sparkles className="h-5 w-5 text-white" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Existence</p>
                      <p className="text-xl font-semibold text-white">{character.stats.existence}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap gap-2">
                {character.facilities.map((facility) => (
                  <Badge key={facility} variant="outline" className="border-gray-600 bg-gray-700 text-white">
                    {facility}
                  </Badge>
                ))}
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-gray-700 px-4 py-2 text-sm text-white">
                <CalendarDays className="h-4 w-4" />
                <span>Released {character.release_date}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-gray-900 p-4 shadow-inner">
              <img src={toPublicAssetPath(character.images.full)} alt={character.name} className="mx-auto h-full max-h-[480px] w-full object-contain" />
            </div>
          </div>
        </section>

        <DetailSection title="Forces">
          <div className="flex flex-wrap gap-3">
            {character.forces.map((force) => (
              <Badge key={force.label} variant="outline" className="gap-2 border-gray-600 bg-gray-700 px-3 py-2 text-white">
                <img src={toPublicAssetPath(force.icon_path)} alt={force.name} className="h-4 w-4 object-contain" />
                <span>{force.name}</span>
              </Badge>
            ))}
          </div>
        </DetailSection>

        <DetailSection title="Combat Data">
          <Tabs defaultValue="skills" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-900 text-white">
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="traits">Traits</TabsTrigger>
              <TabsTrigger value="ex">EX Abilities</TabsTrigger>
            </TabsList>
            <TabsContent value="skills" className="mt-6 space-y-4">
              {character.skills.map((skill) => (
                <Card key={skill.label} className="rounded-2xl border-gray-700 bg-gray-800 shadow-none">
                  <CardContent className="flex gap-4 p-5">
                    <img src={toPublicAssetPath(skill.icon_path)} alt={skill.name} className="h-16 w-16 rounded-2xl bg-gray-900 p-2 object-contain" />
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{skill.name}</h3>
                        <Badge variant="secondary" className="bg-gray-700 text-white">{skill.kind}</Badge>
                        <Badge variant="outline" className="border-gray-600 text-gray-300">{skill.slot}</Badge>
                      </div>
                      <p className="whitespace-pre-line text-sm leading-6 text-gray-300">{stripColorTags(skill.description_max_level)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="traits" className="mt-6 space-y-4">
              {character.traits.map((trait) => (
                <Card key={trait.label} className="rounded-2xl border-gray-700 bg-gray-800 shadow-none">
                  <CardContent className="flex gap-4 p-5">
                    <img src={toPublicAssetPath(trait.icon_path)} alt={trait.name} className="h-16 w-16 rounded-2xl bg-gray-900 p-2 object-contain" />
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{trait.name}</h3>
                        <Badge variant="secondary" className="bg-gray-700 text-white">{trait.unlock}</Badge>
                      </div>
                      <p className="whitespace-pre-line text-sm leading-6 text-gray-300">{stripColorTags(trait.description_max_level)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="ex" className="mt-6 space-y-4">
              {character.ex_abilities.map((ability) => (
                <Card key={ability.name} className="rounded-2xl border-gray-700 bg-gray-800 shadow-none">
                  <CardContent className="space-y-3 p-5">
                    <h3 className="text-lg font-semibold text-white">{ability.name}</h3>
                    <p className="text-sm leading-6 text-gray-300">{stripColorTags(ability.description)}</p>
                    <ul className="space-y-2 text-sm text-gray-300">
                      {ability.effects.map((effect) => (
                        <li key={effect} className="rounded-2xl bg-gray-900 px-4 py-3">
                          {stripColorTags(effect)}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </DetailSection>
      </div>
    </main>
  )
}