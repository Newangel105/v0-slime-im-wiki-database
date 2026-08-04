"use client"

import { Fragment, useState, useMemo } from "react"
import { META_PRESETS, type MetaPreset } from "@/lib/meta-presets"
import { getCharacterVisualTier, toPublicAssetPath, type WikiCharacter, type WikiSkill } from "@/lib/pc-wiki"

// ── Frame helpers (mirrors team-builder-client) ──────────────────────────────
function getMiniFramePaths(tier: number, role: "member" | "bless") {
  const t = Math.min(Math.max(tier, 3), 8)
  const pfx = role === "bless" ? "Bless" : "Member"
  if (t === 8) return { base: `/UI/Texture/CommonRarityAtlas/base${pfx}M7_Epic.webp`, frame: `/UI/Texture/CommonRarityAtlas/frame${pfx}M7_Epic.webp` }
  if (t === 7) return { base: `/UI/Texture/CommonRarityAtlas/base${pfx}M6_SpecialPlus.webp`, frame: `/UI/Texture/CommonRarityAtlas/frame${pfx}M6_SpecialPlus.webp` }
  return { base: `/UI/Texture/CommonRarityAtlas/base${pfx}M${t}.webp`, frame: `/UI/Texture/CommonRarityAtlas/frame${pfx}M${t}.webp` }
}

const STAR_ASSETS: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/starCharaL3.webp",
  4: "/UI/Texture/CommonRarityAtlas/starCharaL4.webp",
  5: "/UI/Texture/CommonRarityAtlas/starCharaL5.webp",
  6: "/UI/Texture/CommonRarityAtlas/starCharaL6.webp",
  7: "/UI/Texture/CommonRarityAtlas/starCharaL6_SpecialPlus.webp",
  8: "/UI/Texture/CommonRarityAtlas/starCharaL7_Epic.webp",
}

// ── Skill description rendering ───────────────────────────────────────────────
function RichSkillDesc({ text }: { text: string }) {
  if (!text) return null
  const lines = text.split("\n")
  return (
    <div className="space-y-1 text-xs leading-relaxed text-foreground/65 text-left">
      {lines.map((line, li) => {
        const parts: { colored: boolean; text: string }[] = []
        const colorRe = /<color=[^>]+>(.*?)<\/color>/gi
        let last = 0; let m: RegExpExecArray | null
        while ((m = colorRe.exec(line)) !== null) {
          if (m.index > last) parts.push({ colored: false, text: line.slice(last, m.index) })
          parts.push({ colored: true, text: m[1] })
          last = colorRe.lastIndex
        }
        if (last < line.length) parts.push({ colored: false, text: line.slice(last) })
        return (
          <p key={li}>
            {parts.map((p, i) =>
              p.colored
                ? <span key={i} className="font-semibold text-accent">{p.text}</span>
                : <span key={i}>{p.text}</span>
            )}
          </p>
        )
      })}
    </div>
  )
}

// ── Character icon with frame ─────────────────────────────────────────────────
function CharIcon({ char, size = 72 }: { char: WikiCharacter; size?: number }) {
  const tier = getCharacterVisualTier(char)
  const isProtector = char.skills.some(s => s.slot === "bless_skill")
  const { base, frame } = getMiniFramePaths(tier, isProtector ? "bless" : "member")
  const starSrc = STAR_ASSETS[tier] ?? STAR_ASSETS[7]
  const iconSrc = toPublicAssetPath(char.images.icon)

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {tier >= 8
        ? <div className="absolute inset-[7%]"><img src={base} alt="" className="w-full h-full object-fill pointer-events-none" /></div>
        : <img src={base} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none" />}
      {iconSrc && (tier >= 8
        ? <div className="absolute inset-[4%] rounded-[6%] overflow-hidden"><img src={iconSrc} alt={char.name} className="w-full h-full object-cover object-top" /></div>
        : <img src={iconSrc} alt={char.name} className="absolute inset-0 w-full h-full object-contain" style={{ padding: "8%" }} />)}
      <img src={frame} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none" />
      {starSrc && (
        <img src={starSrc} alt="" className="absolute bottom-0 left-0 object-contain pointer-events-none" style={{ height: "38%", width: "38%" }} />
      )}
    </div>
  )
}

// ── Skill icon ────────────────────────────────────────────────────────────────
function SkillIcon({ skill, size = 40 }: { skill: WikiSkill; size?: number }) {
  const src = toPublicAssetPath(skill.icon_path)
  if (!src) return <div className="rounded-full bg-muted" style={{ width: size, height: size }} />
  return <img src={src} alt={skill.name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
}

// ── Slot ordering ─────────────────────────────────────────────────────────────
const SLOT_KEYS: (keyof MetaPreset)[] = [
  "protector", "battle1", "battle2", "battle3", "battle4", "battle5", "mini1", "mini2", "mini3", "mini4",
]

const SLOT_LABELS: Record<string, string> = {
  protector: "Protector",
  battle1: "Slot 2",
  battle2: "Slot 3",
  battle3: "Slot 4",
  battle4: "Slot 5",
  battle5: "Slot 6",
  mini1: "Mini 1",
  mini2: "Mini 2",
  mini3: "Mini 3",
  mini4: "Mini 4",
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PresetViewerClient({ characters }: { characters: WikiCharacter[] }) {

  const [selectedPreset, setSelectedPreset] = useState<MetaPreset | null>(null)
  const [search, setSearch] = useState("")
  const [selectorOpen, setSelectorOpen] = useState(true)

  const charByAffiliation = useMemo(() => {
    const m = new Map<string, WikiCharacter>()
    for (const c of characters) m.set(c.affiliation_name, c)
    return m
  }, [characters])

  const filteredPresets = useMemo(() => {
    const q = search.toLowerCase()
    return [...META_PRESETS].reverse().filter(p => !q || p.name.toLowerCase().includes(q))
  }, [search])

  const teamChars = useMemo(() => {
    if (!selectedPreset) return []
    return SLOT_KEYS
      .map(slot => {
        const title = selectedPreset[slot] as string | undefined
        if (!title) return null
        const char = charByAffiliation.get(title)
        return char ? { char, slotKey: slot as string, slotLabel: SLOT_LABELS[slot as string] } : null
      })
      .filter((x): x is { char: WikiCharacter; slotKey: string; slotLabel: string } => x !== null)
  }, [selectedPreset, charByAffiliation])

  const protectors = useMemo(() => teamChars.filter(({ char }) => char.skills.some(s => s.slot === "bless_skill")), [teamChars])
  const regulars = useMemo(() => teamChars.filter(({ char }) => !char.skills.some(s => s.slot === "bless_skill")), [teamChars])

  function getSkill(char: WikiCharacter, slot: string): WikiSkill | undefined {
    return char.skills.find(s => s.slot === slot && !s.is_skill_change)
  }
  function getFusedSkill(char: WikiCharacter, baseSlot: string): WikiSkill | undefined {
    const base = getSkill(char, baseSlot)
    if (!base) return undefined
    return char.skills.find(s => s.is_skill_change && (s.replaces_slot === baseSlot || s.replaces_label === base.label))
  }

  return (
    <div className="space-y-6">
      {/* ── Preset selector (matches team-builder style) ── */}
      <div className="flex justify-start">
        <div className="relative w-full max-w-sm">
          <button
            onClick={() => setSelectorOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-foreground border border-border/[0.26] bg-card/85 backdrop-blur-md transition-colors hover:border-accent/55 hover:bg-[rgba(30,77,113,0.95)]"
          >
            <span>{selectedPreset ? selectedPreset.name : "Load Meta Preset..."}</span>
            <span>{selectorOpen ? "▲" : "▼"}</span>
          </button>
          {selectorOpen && (
            <div
              className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden border border-border/[0.26] bg-muted/[0.97] shadow-[0_18px_45px_rgba(8,30,52,0.4)] backdrop-blur-md"
            >
              <div className="p-2 border-b border-border/[0.22]">
                <input
                  className="w-full rounded-md bg-[rgba(40,82,120,0.6)] border border-border/[0.26] px-3 py-1.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                  placeholder="Search metas..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "16rem", scrollbarColor: "rgba(160,190,215,0.4) transparent" }}>
                {filteredPresets.map(preset => (
                  <button
                    key={preset.id}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      selectedPreset?.id === preset.id
                        ? "bg-accent/15 text-foreground ring-1 ring-accent/35"
                        : "text-foreground/75 hover:bg-[rgba(125,205,225,0.10)] hover:text-foreground"
                    }`}
                    onClick={() => { setSelectedPreset(preset); setSelectorOpen(false) }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Team tables ── */}
      {selectedPreset && teamChars.length > 0 && (
        <div className="space-y-8">
          {/* ── Protector table ── */}
          {protectors.length > 0 && (
            <section>
              <div className="mb-3 inline-flex items-center rounded-full border border-border/[0.28] bg-card/[0.88] px-4 py-1.5 shadow-[0_8px_20px_rgba(8,30,52,0.28)] backdrop-blur-md">
                <h2 className="text-xs font-bold uppercase tracking-widest text-accent">Divine Protection</h2>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-border/[0.26] bg-card/85 shadow-[0_14px_36px_rgba(8,30,52,0.3)] backdrop-blur-md">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-popover text-foreground/65 text-xs uppercase tracking-wider">
                      <th className="px-3 py-3 text-left w-20">Icon</th>
                      <th className="px-3 py-3 text-left min-w-[120px]">Character</th>
                      <th className="px-3 py-3 text-left w-12">Skill</th>
                      <th className="px-3 py-3 text-left w-24">Which slot</th>
                      <th className="px-3 py-3 text-left">Divine Protection / Support Skill</th>
                      <th className="px-3 py-3 text-left w-12">Prot. Skill</th>
                      <th className="px-3 py-3 text-left">Protection Skill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {protectors.map(({ char, slotLabel }, ci) => {
                      const blessSkill = getSkill(char, "bless_skill")
                      const leaderSkill = getSkill(char, "leader_skill")
                      const assistSkill = getSkill(char, "assist_leader_skill")
                      const border = ci < protectors.length - 1 ? "border-b-2 border-border/[0.22]" : ""
                      return (
                        <Fragment key={char.master_pc_id}>
                          {/* Row 1: bless_skill + leader_skill */}
                          <tr key={`${char.master_pc_id}-prot`} className="bg-transparent align-top">
                            <td className="px-3 py-3" rowSpan={assistSkill ? 2 : 1}>
                              <CharIcon char={char} size={68} />
                            </td>
                            <td className="px-3 py-3 font-semibold text-foreground" rowSpan={assistSkill ? 2 : 1}>
                              {char.name}
                              <div className="text-xs text-foreground/65 font-normal mt-1">{slotLabel}</div>
                            </td>
                            <td className="px-3 py-3">
                              {blessSkill && <SkillIcon skill={blessSkill} size={38} />}
                            </td>
                            <td className="px-3 py-3 text-accent font-medium text-xs">Protector</td>
                            <td className="px-3 py-3 max-w-xs">
                              {blessSkill && <RichSkillDesc text={blessSkill.description_max_level} />}
                            </td>
                            <td className="px-3 py-3">
                              {leaderSkill && <SkillIcon skill={leaderSkill} size={38} />}
                            </td>
                            <td className="px-3 py-3 max-w-xs">
                              {leaderSkill && <RichSkillDesc text={leaderSkill.description_max_level} />}
                            </td>
                          </tr>
                          {/* Row 2: assist_leader_skill */}
                          {assistSkill && (
                            <tr key={`${char.master_pc_id}-support`} className={`bg-[rgba(125,205,225,0.06)] align-top ${border}`}>
                              <td className="px-3 py-3">
                                <SkillIcon skill={assistSkill} size={38} />
                              </td>
                              <td className="px-3 py-3 text-[#c4b5fd] font-medium text-xs">Support</td>
                              <td className="px-3 py-3 max-w-xs" colSpan={3}>
                                <RichSkillDesc text={assistSkill.description_max_level} />
                              </td>
                            </tr>
                          )}
                          {!assistSkill && <tr key={`${char.master_pc_id}-sep`} className={border}><td colSpan={7} /></tr>}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Skills table ── */}
          {regulars.length > 0 && (
            <section>
              <div className="mb-3 inline-flex items-center rounded-full border border-border/[0.28] bg-card/[0.88] px-4 py-1.5 shadow-[0_8px_20px_rgba(8,30,52,0.28)] backdrop-blur-md">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#fbbf24]">Skills</h2>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-border/[0.26] bg-card/85 shadow-[0_14px_36px_rgba(8,30,52,0.3)] backdrop-blur-md">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-popover text-foreground/65 text-xs uppercase tracking-wider">
                      <th className="px-3 py-3 text-left w-20">Icon</th>
                      <th className="px-3 py-3 text-left min-w-[120px]">Character</th>
                      <th className="px-3 py-3 text-left w-12">Skill</th>
                      <th className="px-3 py-3 text-left w-28">Which skill</th>
                      <th className="px-3 py-3 text-left">Skill details</th>
                      <th className="px-3 py-3 text-center w-20">Skill Cost</th>
                      <th className="px-3 py-3 text-left">Fused skill details</th>
                      <th className="px-3 py-3 text-center w-24">Fused Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regulars.map(({ char, slotLabel }, ci) => {
                      const skill1 = getSkill(char, "active_skill_1")
                      const skill2 = getSkill(char, "active_skill_2")
                      const fused1 = getFusedSkill(char, "active_skill_1")
                      const fused2 = getFusedSkill(char, "active_skill_2")
                      const border = ci < regulars.length - 1 ? "border-b-2 border-border/[0.22]" : ""

                      const rows: { skill: WikiSkill | undefined; fused: WikiSkill | undefined; label: string }[] = []
                      if (skill1 || skill2) {
                        rows.push({ skill: skill1, fused: fused1, label: "First Skill" })
                        rows.push({ skill: skill2, fused: fused2, label: "Second Skill" })
                      }

                      if (rows.length === 0) return null

                      return rows.map((row, ri) => (
                        <tr
                          key={`${char.master_pc_id}-${ri}`}
                          className={`${ri % 2 === 0 ? "bg-transparent" : "bg-[rgba(125,205,225,0.06)]"} align-top ${ri === rows.length - 1 ? border : ""}`}
                        >
                          {ri === 0 && (
                            <>
                              <td className="px-3 py-3" rowSpan={rows.length}>
                                <CharIcon char={char} size={68} />
                              </td>
                              <td className="px-3 py-3 font-semibold text-foreground" rowSpan={rows.length}>
                                {char.name}
                                <div className="text-xs text-foreground/65 font-normal mt-1">{slotLabel}</div>
                              </td>
                            </>
                          )}
                          <td className="px-3 py-3">
                            {row.skill && <SkillIcon skill={row.skill} size={38} />}
                          </td>
                          <td className="px-3 py-3 text-[#fbbf24] font-medium text-xs">{row.label}</td>
                          <td className="px-3 py-3 max-w-xs">
                            {row.skill && <RichSkillDesc text={row.skill.description_max_level} />}
                          </td>
                          <td className="px-3 py-3 text-center text-foreground/65 text-xs font-mono">
                            {row.skill?.cost != null ? row.skill.cost : "—"}
                          </td>
                          <td className="px-3 py-3 max-w-xs">
                            {row.fused
                              ? <div className="flex items-start gap-2">
                                  <SkillIcon skill={row.fused} size={36} />
                                  <RichSkillDesc text={row.fused.description_max_level} />
                                </div>
                              : <span className="text-foreground/45 text-xs italic">No skill fusion for this skill</span>}
                          </td>
                          <td className="px-3 py-3 text-center text-foreground/65 text-xs font-mono">
                            {row.fused?.cost != null ? row.fused.cost : "—"}
                          </td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
