import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, Heart, Shield, Sparkles, Sword } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getWikiCharacterById, stripColorTags, toPublicAssetPath } from "@/lib/pc-wiki"

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-[28px] border border-stone-200 bg-white/85 p-6 shadow-[0_16px_50px_rgba(73,54,24,0.12)] backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{title}</p>
      </div>
      {children}
    </section>
  )
}

export default function CharacterDetailPage({ params }: { params: { characterId: string } }) {
  const character = getWikiCharacterById(Number(params.characterId))

  if (!character) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7f2e8_0%,_#ebe0c7_45%,_#d7c39b_100%)] px-6 py-10 text-stone-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/characters" className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/85 px-4 py-2 text-sm font-medium text-stone-900 shadow-sm">
            <ArrowLeft className="h-4 w-4" />
            Back to characters
          </Link>
          <Badge className="bg-amber-600 text-white hover:bg-amber-600">#{character.master_pc_id}</Badge>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-stone-200 bg-white/75 shadow-[0_20px_80px_rgba(73,54,24,0.14)] backdrop-blur">
          <div className="grid gap-8 px-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
            <div className="space-y-5">
              <Badge className="bg-stone-900 text-stone-100 hover:bg-stone-900">{character.affiliation_name}</Badge>
              <div>
                <h1 className="font-serif text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">{character.name}</h1>
                <p className="mt-2 text-lg text-stone-700">{character.element} {character.attack_type} {character.weapon_type} specialist</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-stone-100 text-stone-900">{character.tactics_type}</Badge>
                <Badge variant="secondary" className="bg-stone-100 text-stone-900">Rarity {character.rarity}</Badge>
                <Badge variant="secondary" className="bg-stone-100 text-stone-900">{character.release_date}</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <Card className="rounded-[24px] border-stone-200 bg-stone-50 shadow-none">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Heart className="h-5 w-5 text-amber-700" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">HP</p>
                      <p className="text-xl font-semibold text-stone-950">{character.stats.hp}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-[24px] border-stone-200 bg-stone-50 shadow-none">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Sword className="h-5 w-5 text-amber-700" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">ATK</p>
                      <p className="text-xl font-semibold text-stone-950">{character.stats.attack}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-[24px] border-stone-200 bg-stone-50 shadow-none">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Shield className="h-5 w-5 text-amber-700" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">DEF</p>
                      <p className="text-xl font-semibold text-stone-950">{character.stats.defense}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-[24px] border-stone-200 bg-stone-50 shadow-none">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Sparkles className="h-5 w-5 text-amber-700" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Existence</p>
                      <p className="text-xl font-semibold text-stone-950">{character.stats.existence}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap gap-2">
                {character.facilities.map((facility) => (
                  <Badge key={facility} variant="outline" className="border-stone-200 bg-white text-stone-800">
                    {facility}
                  </Badge>
                ))}
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-100">
                <CalendarDays className="h-4 w-4" />
                <span>Released {character.release_date}</span>
              </div>
            </div>

            <div className="rounded-[28px] bg-[linear-gradient(135deg,_#2f241a,_#87653f)] p-4 shadow-inner">
              <img src={toPublicAssetPath(character.images.full)} alt={character.name} className="mx-auto h-full max-h-[480px] w-full object-contain" />
            </div>
          </div>
        </section>

        <DetailSection title="Forces">
          <div className="flex flex-wrap gap-3">
            {character.forces.map((force) => (
              <Badge key={force.label} variant="outline" className="gap-2 border-stone-200 bg-white px-3 py-2 text-stone-900">
                <img src={toPublicAssetPath(force.icon_path)} alt={force.name} className="h-4 w-4 object-contain" />
                <span>{force.name}</span>
              </Badge>
            ))}
          </div>
        </DetailSection>

        <DetailSection title="Combat Data">
          <Tabs defaultValue="skills" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-stone-100">
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="traits">Traits</TabsTrigger>
              <TabsTrigger value="ex">EX Abilities</TabsTrigger>
            </TabsList>
            <TabsContent value="skills" className="mt-6 space-y-4">
              {character.skills.map((skill) => (
                <Card key={skill.label} className="rounded-[24px] border-stone-200 shadow-none">
                  <CardContent className="flex gap-4 p-5">
                    <img src={toPublicAssetPath(skill.icon_path)} alt={skill.name} className="h-16 w-16 rounded-2xl bg-stone-100 p-2 object-contain" />
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-stone-950">{skill.name}</h3>
                        <Badge variant="secondary" className="bg-stone-100 text-stone-900">{skill.kind}</Badge>
                        <Badge variant="outline" className="border-stone-200 text-stone-700">{skill.slot}</Badge>
                      </div>
                      <p className="whitespace-pre-line text-sm leading-6 text-stone-700">{stripColorTags(skill.description_max_level)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="traits" className="mt-6 space-y-4">
              {character.traits.map((trait) => (
                <Card key={trait.label} className="rounded-[24px] border-stone-200 shadow-none">
                  <CardContent className="flex gap-4 p-5">
                    <img src={toPublicAssetPath(trait.icon_path)} alt={trait.name} className="h-16 w-16 rounded-2xl bg-stone-100 p-2 object-contain" />
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-stone-950">{trait.name}</h3>
                        <Badge variant="secondary" className="bg-stone-100 text-stone-900">{trait.unlock}</Badge>
                      </div>
                      <p className="whitespace-pre-line text-sm leading-6 text-stone-700">{stripColorTags(trait.description_max_level)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="ex" className="mt-6 space-y-4">
              {character.ex_abilities.map((ability) => (
                <Card key={ability.name} className="rounded-[24px] border-stone-200 shadow-none">
                  <CardContent className="space-y-3 p-5">
                    <h3 className="text-lg font-semibold text-stone-950">{ability.name}</h3>
                    <p className="text-sm leading-6 text-stone-700">{stripColorTags(ability.description)}</p>
                    <ul className="space-y-2 text-sm text-stone-700">
                      {ability.effects.map((effect) => (
                        <li key={effect} className="rounded-2xl bg-stone-50 px-4 py-3">
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