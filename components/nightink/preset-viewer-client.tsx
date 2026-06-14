"use client"

import { Fragment, useState, useMemo } from "react"
import { META_PRESETS, type MetaPreset } from "@/lib/meta-presets"
import { getCharacterVisualTier, toPublicAssetPath, type WikiCharacter, type WikiSkill } from "@/lib/pc-wiki"
import { NkBoard, NkHeaderPod, NkPod } from "./pod-kit"

// Night-ink port of the Preset Viewer: identical preset data + slot/skill logic,
// re-housed in the pod organism with the shared .nk-table / .nk-dropdown
// primitives. CharIcon/SkillIcon composite real game assets (palette-agnostic).

function getMiniFramePaths(tier: number, role: "member" | "bless") {
  const t = Math.min(Math.max(tier, 3), 8)
  const pfx = role === "bless" ? "Bless" : "Member"
  if (t === 8) return { base: `UI/Texture/CommonRarityAtlas/base${pfx}M7_Epic.webp`, frame: `UI/Texture/CommonRarityAtlas/frame${pfx}M7_Epic.webp` }
  if (t === 7) return { base: `UI/Texture/CommonRarityAtlas/base${pfx}M6_SpecialPlus.webp`, frame: `UI/Texture/CommonRarityAtlas/frame${pfx}M6_SpecialPlus.webp` }
  return { base: `UI/Texture/CommonRarityAtlas/base${pfx}M${t}.webp`, frame: `UI/Texture/CommonRarityAtlas/frame${pfx}M${t}.webp` }
}

const STAR_ASSETS: Record<number, string> = {
  3: "/UI/Texture/CommonRarityAtlas/starCharaL3.webp",
  4: "/UI/Texture/CommonRarityAtlas/starCharaL4.webp",
  5: "/UI/Texture/CommonRarityAtlas/starCharaL5.webp",
  6: "/UI/Texture/CommonRarityAtlas/starCharaL6.webp",
  7: "/UI/Texture/CommonRarityAtlas/starCharaL6_SpecialPlus.webp",
  8: "/UI/Texture/CommonRarityAtlas/starCharaL7_Epic.webp",
}

function RichSkillDesc({ text }: { text: string }) {
  if (!text) return null
  const lines = text.split("\n")
  return (
    <div className="nk-desc">
      {lines.map((line, li) => {
        const parts: { colored: boolean; text: string }[] = []
        const colorRe = /<color=[^>]+>(.*?)<\/color>/gi
        let last = 0
        let m: RegExpExecArray | null
        while ((m = colorRe.exec(line)) !== null) {
          if (m.index > last) parts.push({ colored: false, text: line.slice(last, m.index) })
          parts.push({ colored: true, text: m[1] })
          last = colorRe.lastIndex
        }
        if (last < line.length) parts.push({ colored: false, text: line.slice(last) })
        return (
          <p key={li}>
            {parts.map((p, i) =>
              p.colored ? <span key={i} className="nk-hl">{p.text}</span> : <span key={i}>{p.text}</span>,
            )}
          </p>
        )
      })}
    </div>
  )
}

function CharIcon({ char, size = 68 }: { char: WikiCharacter; size?: number }) {
  const tier = getCharacterVisualTier(char)
  const isProtector = char.skills.some((s) => s.slot === "bless_skill")
  const { base, frame } = getMiniFramePaths(tier, isProtector ? "bless" : "member")
  const starSrc = STAR_ASSETS[tier] ?? STAR_ASSETS[7]
  const iconSrc = toPublicAssetPath(char.images.icon)
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {tier >= 8 ? (
        <div className="absolute inset-[7%]"><img src={base} alt="" className="w-full h-full object-fill pointer-events-none" /></div>
      ) : (
        <img src={base} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none" />
      )}
      {iconSrc &&
        (tier >= 8 ? (
          <div className="absolute inset-[4%] rounded-[6%] overflow-hidden"><img src={iconSrc} alt={char.name} className="w-full h-full object-cover object-top" /></div>
        ) : (
          <img src={iconSrc} alt={char.name} className="absolute inset-0 w-full h-full object-contain" style={{ padding: "8%" }} />
        ))}
      <img src={frame} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none" />
      {starSrc && <img src={starSrc} alt="" className="absolute bottom-0 left-0 object-contain pointer-events-none" style={{ height: "38%", width: "38%" }} />}
    </div>
  )
}

function SkillIcon({ skill, size = 38 }: { skill: WikiSkill; size?: number }) {
  const src = toPublicAssetPath(skill.icon_path)
  if (!src) return <div className="rounded-full" style={{ width: size, height: size, background: "var(--night3)" }} />
  return <img src={src} alt={skill.name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
}

const SLOT_KEYS: (keyof MetaPreset)[] = [
  "protector", "battle1", "battle2", "battle3", "battle4", "battle5", "mini1", "mini2", "mini3", "mini4",
]
const SLOT_LABELS: Record<string, string> = {
  protector: "Protector", battle1: "Slot 2", battle2: "Slot 3", battle3: "Slot 4", battle4: "Slot 5",
  battle5: "Slot 6", mini1: "Mini 1", mini2: "Mini 2", mini3: "Mini 3", mini4: "Mini 4",
}

export default function NightInkPresetViewerClient({ characters }: { characters: WikiCharacter[] }) {
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
    return [...META_PRESETS].reverse().filter((p) => !q || p.name.toLowerCase().includes(q))
  }, [search])

  const teamChars = useMemo(() => {
    if (!selectedPreset) return []
    return SLOT_KEYS.map((slot) => {
      const title = selectedPreset[slot] as string | undefined
      if (!title) return null
      const char = charByAffiliation.get(title)
      return char ? { char, slotKey: slot as string, slotLabel: SLOT_LABELS[slot as string] } : null
    }).filter((x): x is { char: WikiCharacter; slotKey: string; slotLabel: string } => x !== null)
  }, [selectedPreset, charByAffiliation])

  const protectors = useMemo(() => teamChars.filter(({ char }) => char.skills.some((s) => s.slot === "bless_skill")), [teamChars])
  const regulars = useMemo(() => teamChars.filter(({ char }) => !char.skills.some((s) => s.slot === "bless_skill")), [teamChars])

  function getSkill(char: WikiCharacter, slot: string): WikiSkill | undefined {
    return char.skills.find((s) => s.slot === slot && !s.is_skill_change)
  }
  function getFusedSkill(char: WikiCharacter, baseSlot: string): WikiSkill | undefined {
    const base = getSkill(char, baseSlot)
    if (!base) return undefined
    return char.skills.find((s) => s.is_skill_change && (s.replaces_slot === baseSlot || s.replaces_label === base.label))
  }

  return (
    <NkBoard>
      <NkHeaderPod
        kicker="Meta Team Library"
        title="Preset "
        accent="Viewer"
        sub="Load a community meta team and read every member's skills, fusions and divine protections side by side."
      />

      <NkPod style={{ marginTop: 30 }} label="Preset viewer">
        <div className="nk-dropdown" style={{ maxWidth: 380 }}>
          <button className="nk-dropdown-toggle" onClick={() => setSelectorOpen((o) => !o)}>
            <span>{selectedPreset ? selectedPreset.name : "Load Meta Preset…"}</span>
            <span className="nk-dd-caret">{selectorOpen ? "▲" : "▼"}</span>
          </button>
          {selectorOpen && (
            <div className="nk-dropdown-panel">
              <div className="nk-dropdown-search">
                <input placeholder="Search metas…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
              </div>
              <div className="nk-dropdown-list">
                {filteredPresets.map((preset) => (
                  <button
                    key={preset.id}
                    className={`nk-dropdown-item${selectedPreset?.id === preset.id ? " is-active" : ""}`}
                    onClick={() => {
                      setSelectedPreset(preset)
                      setSelectorOpen(false)
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedPreset && teamChars.length > 0 && (
          <div className="nk-stack" style={{ marginTop: 28, gap: 28 }}>
            {protectors.length > 0 && (
              <section>
                <span className="nk-seclabel">Divine Protection</span>
                <div className="nk-table-shell" style={{ marginTop: 12 }}>
                  <table className="nk-table" style={{ minWidth: 920 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", width: 80 }}>Icon</th>
                        <th style={{ textAlign: "left", minWidth: 120 }}>Character</th>
                        <th style={{ textAlign: "left", width: 48 }}>Skill</th>
                        <th style={{ textAlign: "left", width: 96 }}>Which slot</th>
                        <th style={{ textAlign: "left" }}>Divine Protection / Support</th>
                        <th style={{ textAlign: "left", width: 48 }}>Prot.</th>
                        <th style={{ textAlign: "left" }}>Protection Skill</th>
                      </tr>
                    </thead>
                    <tbody>
                      {protectors.map(({ char, slotLabel }, ci) => {
                        const blessSkill = getSkill(char, "bless_skill")
                        const leaderSkill = getSkill(char, "leader_skill")
                        const assistSkill = getSkill(char, "assist_leader_skill")
                        const sep = ci < protectors.length - 1 ? " nk-section-top" : ""
                        return (
                          <Fragment key={char.master_pc_id}>
                            <tr className="align-top">
                              <td rowSpan={assistSkill ? 2 : 1}><CharIcon char={char} size={64} /></td>
                              <td rowSpan={assistSkill ? 2 : 1} style={{ fontWeight: 700 }}>
                                {char.name}
                                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 400, color: "var(--cream-faint)" }}>{slotLabel}</div>
                              </td>
                              <td>{blessSkill && <SkillIcon skill={blessSkill} />}</td>
                              <td style={{ color: "var(--red-bright)", fontWeight: 600, fontSize: 11 }}>Protector</td>
                              <td style={{ maxWidth: 320 }}>{blessSkill && <RichSkillDesc text={blessSkill.description_max_level} />}</td>
                              <td>{leaderSkill && <SkillIcon skill={leaderSkill} />}</td>
                              <td style={{ maxWidth: 320 }}>{leaderSkill && <RichSkillDesc text={leaderSkill.description_max_level} />}</td>
                            </tr>
                            {assistSkill && (
                              <tr className={`align-top is-alt${sep}`}>
                                <td><SkillIcon skill={assistSkill} /></td>
                                <td style={{ color: "#b39ae6", fontWeight: 600, fontSize: 11 }}>Support</td>
                                <td colSpan={3} style={{ maxWidth: 320 }}><RichSkillDesc text={assistSkill.description_max_level} /></td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {regulars.length > 0 && (
              <section>
                <span className="nk-seclabel gold">Skills</span>
                <div className="nk-table-shell" style={{ marginTop: 12 }}>
                  <table className="nk-table" style={{ minWidth: 1040 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", width: 80 }}>Icon</th>
                        <th style={{ textAlign: "left", minWidth: 120 }}>Character</th>
                        <th style={{ textAlign: "left", width: 48 }}>Skill</th>
                        <th style={{ textAlign: "left", width: 112 }}>Which skill</th>
                        <th style={{ textAlign: "left" }}>Skill details</th>
                        <th style={{ textAlign: "center", width: 80 }}>Cost</th>
                        <th style={{ textAlign: "left" }}>Fused skill details</th>
                        <th style={{ textAlign: "center", width: 88 }}>Fused</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regulars.map(({ char, slotLabel }, ci) => {
                        const skill1 = getSkill(char, "active_skill_1")
                        const skill2 = getSkill(char, "active_skill_2")
                        const fused1 = getFusedSkill(char, "active_skill_1")
                        const fused2 = getFusedSkill(char, "active_skill_2")
                        const sep = ci < regulars.length - 1 ? " nk-section-top" : ""
                        const rows: { skill: WikiSkill | undefined; fused: WikiSkill | undefined; label: string }[] = []
                        if (skill1 || skill2) {
                          rows.push({ skill: skill1, fused: fused1, label: "First Skill" })
                          rows.push({ skill: skill2, fused: fused2, label: "Second Skill" })
                        }
                        if (rows.length === 0) return null
                        return rows.map((row, ri) => (
                          <tr key={`${char.master_pc_id}-${ri}`} className={`align-top${ri % 2 ? " is-alt" : ""}${ri === rows.length - 1 ? sep : ""}`}>
                            {ri === 0 && (
                              <>
                                <td rowSpan={rows.length}><CharIcon char={char} size={64} /></td>
                                <td rowSpan={rows.length} style={{ fontWeight: 700 }}>
                                  {char.name}
                                  <div style={{ marginTop: 4, fontSize: 11, fontWeight: 400, color: "var(--cream-faint)" }}>{slotLabel}</div>
                                </td>
                              </>
                            )}
                            <td>{row.skill && <SkillIcon skill={row.skill} />}</td>
                            <td style={{ color: "#ffffff", fontWeight: 600, fontSize: 11 }}>{row.label}</td>
                            <td style={{ maxWidth: 320 }}>{row.skill && <RichSkillDesc text={row.skill.description_max_level} />}</td>
                            <td style={{ textAlign: "center", color: "var(--cream-dim)", fontSize: 12, fontFamily: "monospace" }}>
                              {row.skill?.cost != null ? row.skill.cost : "—"}
                            </td>
                            <td style={{ maxWidth: 320 }}>
                              {row.fused ? (
                                <div className="flex items-start gap-2">
                                  <SkillIcon skill={row.fused} size={34} />
                                  <RichSkillDesc text={row.fused.description_max_level} />
                                </div>
                              ) : (
                                <span style={{ color: "var(--cream-faint)", fontSize: 11, fontStyle: "italic" }}>No skill fusion</span>
                              )}
                            </td>
                            <td style={{ textAlign: "center", color: "var(--cream-dim)", fontSize: 12, fontFamily: "monospace" }}>
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
      </NkPod>
    </NkBoard>
  )
}
