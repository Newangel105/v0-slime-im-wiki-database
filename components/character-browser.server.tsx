import Link from "next/link"
import type { WikiCharacter } from "@/lib/pc-wiki"
import {
  toPublicAssetPath,
  getCharacterVisualTier,
  getCharacterRarityLabel,
  normalizeLabel,
} from "@/lib/pc-wiki"

const rarityFrameMap: Record<number, string> = {
  3: "/frame/frameMemberM3.png",
  4: "/frame/frameMemberM4.png",
  5: "/frame/frameMemberM5.png",
  6: "/frame/frameMemberM6.png",
  7: "/frame/frameMemberM7.png",
}

const blessFrameMap: Record<number, string> = {
  3: "/frame/frameBlessM3.png",
  4: "/frame/frameBlessM4.png",
  5: "/frame/frameBlessM5.png",
  6: "/frame/frameBlessM6.png",
  7: "/frame/frameBlessM7.png",
}

const baseRarityMap: Record<number, string> = {
  3: "/frame/baseMemberM3.png",
  4: "/frame/baseMemberM4.png",
  5: "/frame/baseMemberM5.png",
  6: "/frame/baseMemberM6.png",
  7: "/frame/baseMemberM7.png",
}

const baseBlessMap: Record<number, string> = {
  3: "/frame/baseBlessM3.png",
  4: "/frame/baseBlessM4.png",
  5: "/frame/baseBlessM5.png",
  6: "/frame/baseBlessM6.png",
  7: "/frame/baseBlessM7.png",
}

const starAssetMap: Record<number, string> = {
  3: "/stars/starCharaL3A.png",
  4: "/stars/starCharaL4A.png",
  5: "/stars/starCharaL5A.png",
  6: "/stars/starCharaL6A.png",
  7: "/stars/starCharaL7A.png",
}

function isProtectorCharacter(character: WikiCharacter): boolean {
  return (
    character.character_role === "Supporter" &&
    !character.skills.some((s) => s.slot === "special_skill" && s.kind === "special")
  )
}

function getCharacterFrame(character: WikiCharacter): string {
  const visualTier = getCharacterVisualTier(character)
  const frameMap = isProtectorCharacter(character) ? blessFrameMap : rarityFrameMap
  return frameMap[visualTier] ?? frameMap[5]
}

function getCharacterBase(character: WikiCharacter): string {
  const visualTier = getCharacterVisualTier(character)
  const baseMap = isProtectorCharacter(character) ? baseBlessMap : baseRarityMap
  return baseMap[visualTier] ?? baseMap[5]
}

export default function CharacterBrowserServer({ characters }: { characters: WikiCharacter[] }) {
  return (
    <main className="min-h-screen bg-[#111827] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5 shadow-[0_0_24px_rgba(255,255,255,0.08)]">
          <div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Characters</h1>
            <p className="mt-2 text-sm text-gray-400">Server-rendered character list (initial render)</p>
          </div>
        </section>

        <section className="grid gap-5 min-w-0 sm:grid-cols-2 xl:grid-cols-3">
          {characters.map((character) => {
            const visualTier = getCharacterVisualTier(character)
            const frameSrc = getCharacterFrame(character)
            const baseSrc = getCharacterBase(character)
            const starsSrc = starAssetMap[visualTier] ?? starAssetMap[5]
            const iconSrc = toPublicAssetPath(character.images.icon)

            return (
              <Link key={character.master_pc_id} href={`/characters/${character.master_pc_id}`} className="block w-full min-w-0">
                <div className="w-full min-w-0 group h-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#1d2d44] to-[#0f1924] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl">
                  <div>
                    <div className="flex gap-4 p-4 pb-3">
                      <div className="relative h-24 w-24 md:h-[148px] md:w-[148px] shrink-0">
                        <img src={baseSrc} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                        <div className="absolute inset-[10px] overflow-hidden rounded-[18px]">
                          <img src={iconSrc} alt={character.name} className="h-full w-full object-cover object-top" />
                        </div>
                        <img src={frameSrc} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col md:min-h-[148px]">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="line-clamp-2 text-[1rem] font-bold leading-snug text-white">{character.name}</h2>
                          <img src={starsSrc} alt={getCharacterRarityLabel(character)} className="mt-0.5 h-6 shrink-0 object-contain drop-shadow" />
                        </div>
                        <p className="mt-1 truncate text-[10px] uppercase tracking-[0.18em] text-gray-500">{character.affiliation_name}</p>

                        <div className="mt-auto flex flex-wrap gap-2 pt-1">
                          {/* Show force names as simple badges */}
                          {character.forces.slice(0, 4).map((force) => (
                            <span key={force.name} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-gray-400 ring-1 ring-white/10">
                              {force.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="px-4 grid grid-cols-4 divide-x divide-white/5 rounded-xl bg-white/10 py-2.5 w-full min-w-0">
                      <div className="px-2 text-center">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-white">HP</p>
                        <p className="mt-1 text-[1.1rem] font-bold leading-none text-emerald-300">{character.stats.hp}</p>
                      </div>
                      <div className="px-2 text-center">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-white">ATK</p>
                        <p className="mt-1 text-[1.1rem] font-bold leading-none text-rose-300">{character.stats.attack}</p>
                      </div>
                      <div className="px-2 text-center">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-white">DEF</p>
                        <p className="mt-1 text-[1.1rem] font-bold leading-none text-sky-300">{character.stats.defense}</p>
                      </div>
                      <div className="px-2 text-center">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-white">EXI</p>
                        <p className="mt-1 text-[1.1rem] font-bold leading-none text-amber-200">{character.stats.existence}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </section>
      </div>
    </main>
  )
}
