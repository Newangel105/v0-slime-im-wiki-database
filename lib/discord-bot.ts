// Shared helpers for the Discord `/character` slash command (app/api/discord).
// Reuses the wiki's own data + label functions so the bot always matches the site
// and updates automatically with each deploy.
import {
  getAllWikiCharacters,
  getWikiCharacterById,
  getCharacterForceNames,
  getCharacterForceEntries,
  getDisplayElementLabel,
  formatWikiLabel,
  stripColorTags,
  toPublicAssetPath,
  type WikiCharacter,
  type WikiTrait,
} from "@/lib/pc-wiki"
import { getHeaderIcons } from "@/lib/discord-card-icons"
import emojiMap from "@/lib/discord-emojis.json"

const SITE_URL = (process.env.DISCORD_SITE_URL || "https://slimewiki.vercel.app").replace(/\/+$/, "")
const FIELD_MAX = 1024
const PAGE_SIZE = 25 // Discord select-menu hard limit

// Custom game icons via Discord "application emojis". lib/discord-emojis.json maps
// an icon's basename -> "<:name:id>" and is filled by scripts/upload-discord-emojis.mjs.
// Until it's populated EMOJIS_READY is false and the bot renders text, so nothing
// breaks before the one-time upload.
const EMOJIS = emojiMap as Record<string, string>
const EMOJIS_READY = Object.keys(EMOJIS).length > 0
function emoji(path: string | null | undefined) {
  if (!path) return ""
  const key = path.split("/").pop()?.replace(/\.webp$/i, "") || ""
  return EMOJIS[key] || ""
}

// Tutorial / non-playable units (role "None", no skills, no release date) are
// hidden from the bot — they aren't surfaced on the wiki either.
function isVisible(c: WikiCharacter | null | undefined): c is WikiCharacter {
  return !!c && c.character_role !== "None"
}
let cachedVisible: WikiCharacter[] | null = null
function wikiChars(): WikiCharacter[] {
  if (!cachedVisible) cachedVisible = getAllWikiCharacters().filter(isVisible)
  return cachedVisible
}

type DiscordEmbed = {
  title: string
  url?: string
  color: number
  description?: string
  thumbnail?: { url: string }
  image?: { url: string }
  fields?: { name: string; value: string }[]
  footer: { text: string }
}

function norm(v: string | null | undefined) {
  return (v ?? "").toString().toLowerCase().trim()
}
function clean(t: string | null | undefined) {
  return stripColorTags(t ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
}
function trunc(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s
}
function stars(r: number | null | undefined) {
  const n = Math.max(0, Number(r) || 0)
  return n ? "★".repeat(n) : ""
}
function imageUrl(icon: string | null | undefined) {
  if (!icon) return null
  const p = toPublicAssetPath(icon)
  return p.startsWith("/") ? `${SITE_URL}${p}` : p
}
function elementColor(el: string | null | undefined) {
  const e = norm(el)
  if (e.includes("fire")) return 0xe8553a
  if (e.includes("water")) return 0x2e8fd6
  if (e.includes("wind")) return 0x4fb96a
  if (e.includes("earth")) return 0xb98b3a
  if (e.includes("holy")) return 0xf2c94c
  if (e.includes("dark")) return 0x8b5cf6
  if (e.includes("air")) return 0x67d0e0
  return 0x34d0dd
}

// In-game two elements are renamed vs the internal data: Air -> Space, Holy ->
// Light. Apply it to every element label the bot shows so players recognise it
// (covers "Air+", "Special Air", etc. too).
export function elementLabel(el: string | null | undefined) {
  return getDisplayElementLabel(el).replace(/Air/g, "Space").replace(/Holy/g, "Light")
}

// Match by character name OR variant (affiliation_name), ranked by relevance.
export function searchCharacters(query: string): WikiCharacter[] {
  const q = norm(query)
  if (!q) return []
  const matches = wikiChars().filter(
    (c) => norm(c.name).includes(q) || norm(c.affiliation_name).includes(q)
  )
  matches.sort((a, b) => {
    const an = norm(a.name)
    const bn = norm(b.name)
    const ax = an === q ? 0 : an.startsWith(q) ? 1 : 2
    const bx = bn === q ? 0 : bn.startsWith(q) ? 1 : 2
    if (ax !== bx) return ax - bx
    if (an !== bn) return an.localeCompare(bn)
    const ad = String(a.release_date || "")
    const bd = String(b.release_date || "")
    if (ad !== bd) return bd.localeCompare(ad)
    return (Number(b.rarity) || 0) - (Number(a.rarity) || 0)
  })
  return matches
}

// Up to 25 autocomplete choices (value = master_pc_id as a string).
export function nameAutocomplete(
  query: string,
  filters: { element?: string | null; attack?: string | null; target?: string | null; force?: string | null } = {}
) {
  const q = norm(query)
  let list = filterCharacters(filters) // narrow by element/attack/target/force first
  if (q) {
    list = list.filter((c) => norm(c.name).includes(q) || norm(c.affiliation_name).includes(q))
    list.sort((a, b) => {
      const an = norm(a.name)
      const bn = norm(b.name)
      const ax = an === q ? 0 : an.startsWith(q) ? 1 : 2
      const bx = bn === q ? 0 : bn.startsWith(q) ? 1 : 2
      if (ax !== bx) return ax - bx
      return an.localeCompare(bn)
    })
  }
  return list.slice(0, 25).map((c) => ({
    name: trunc(`${c.name} — ${c.affiliation_name} · ${stars(c.rarity) || `${c.rarity}★`} ${elementLabel(c.element)}`, 100),
    value: String(c.master_pc_id),
  }))
}

// ── Filtering (element / AoE-single / force) ──────────────────────────────────

// Strip the Enhanced / SpecialEffectElement prefix so "EnhancedFire" and
// "SpecialEffectElementFire" both match the base "fire".
function baseElement(el: string | null | undefined) {
  return norm(el).replace(/^specialeffectelement/, "").replace(/^enhanced/, "")
}

// Mirrors the site's getCharacterUltimateType: target_type 1 = AoE, 0 = single.
export function characterTargetType(c: WikiCharacter): "aoe" | "single" | null {
  const hasAoE = c.skills?.some((s) => s.battle_attack_effects?.some((e) => e.target_type === 1))
  const hasSingle = c.skills?.some((s) => s.battle_attack_effects?.some((e) => e.target_type === 0))
  if (hasAoE && !hasSingle) return "aoe"
  if (hasSingle && !hasAoE) return "single"
  return hasAoE ? "aoe" : hasSingle ? "single" : null
}

export function filterCharacters(opts: { element?: string | null; attack?: string | null; target?: string | null; force?: string | null }): WikiCharacter[] {
  const el = opts.element ? baseElement(opts.element) : null
  const at = opts.attack ? norm(opts.attack) : null
  const tg = opts.target ? norm(opts.target) : null
  const fc = opts.force ? norm(opts.force) : null
  let list = wikiChars()
  if (el) list = list.filter((c) => baseElement(c.element) === el)
  if (at) list = list.filter((c) => norm(c.attack_type) === at)
  if (tg) list = list.filter((c) => characterTargetType(c) === tg)
  if (fc) list = list.filter((c) => getCharacterForceNames(c).some((n) => norm(n).includes(fc)))
  return [...list].sort((a, b) => {
    const ad = String(a.release_date || "")
    const bd = String(b.release_date || "")
    if (ad !== bd) return bd.localeCompare(ad)
    return (Number(b.rarity) || 0) - (Number(a.rarity) || 0)
  })
}

let cachedForceNames: string[] | null = null
function forceNames() {
  if (!cachedForceNames) {
    const s = new Set<string>()
    for (const c of wikiChars()) for (const n of getCharacterForceNames(c)) if (n) s.add(n)
    cachedForceNames = [...s].sort()
  }
  return cachedForceNames
}

// Force suggestions. If other filters are set, only offer forces that the
// matching characters actually have (keeps the relevant ones within Discord's
// 25-suggestion cap); otherwise offer the full list, filtered by what's typed.
export function forceAutocomplete(query: string, filters?: { element?: string | null; attack?: string | null; target?: string | null }) {
  let names: string[]
  if (filters && (filters.element || filters.attack || filters.target)) {
    const s = new Set<string>()
    for (const c of filterCharacters({ element: filters.element, attack: filters.attack, target: filters.target })) {
      for (const n of getCharacterForceNames(c)) if (n) s.add(n)
    }
    names = [...s].sort()
  } else {
    names = forceNames()
  }
  const q = norm(query)
  const list = q ? names.filter((n) => norm(n).includes(q)) : names
  return list.slice(0, 25).map((n) => ({ name: n.slice(0, 100), value: n.slice(0, 100) }))
}

// "special_skill" -> "Secret Skill"; "active_skill_1" -> "Active Skill 1".
function slotLabel(slot: string) {
  if (slot === "special_skill") return "Secret Skill"
  return slot.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
}

// The skill's type tag: secret skills carry special_skill_type ("Support"/"Attack"),
// active skills carry skill_change_type ("Attack Changing"/"Magic Changing").
function skillTag(s: WikiCharacter["skills"][number]) {
  return s.slot === "special_skill" ? s.special_skill_type : s.skill_change_type
}

// Traits repeat across awaken levels (same trait, bigger numbers). Rank the unlock
// so only the strongest copy of each trait is kept. Initial < Awaken 1 < … < Awaken N.
function unlockRank(u: string | null | undefined) {
  if (!u) return -1
  const m = /awaken\s*(\d+)/i.exec(u)
  if (m) return Number(m[1])
  if (/initial/i.test(u)) return 0
  return 1
}

// Base trait name = the name with the unlock condition stripped off the end
// (e.g. "Switch - Skill Seal Initial Conditions" -> "Switch - Skill Seal").
function baseTraitName(t: WikiTrait) {
  let name = (t.name || t.label || "").trim()
  if (t.unlock && name.toLowerCase().endsWith(t.unlock.toLowerCase())) {
    name = name.slice(0, name.length - t.unlock.length).trim()
  }
  return name
}

// Keep only the highest-unlock copy of each trait, in first-seen order.
function dedupeTraits(traits: WikiTrait[]) {
  const byBase = new Map<string, WikiTrait>()
  for (const t of traits) {
    const base = baseTraitName(t)
    const cur = byBase.get(base)
    if (!cur || unlockRank(t.unlock) > unlockRank(cur.unlock)) byBase.set(base, t)
  }
  return [...byBase.values()]
}

export function buildCharacterEmbed(c: WikiCharacter): DiscordEmbed {
  // Text header (used as fallback before the icons are uploaded).
  const textStat = [
    stars(c.rarity),
    elementLabel(c.element),
    c.weapon_type ? `🗡️ ${formatWikiLabel(c.weapon_type)}` : null,
    c.tactics_type ? `🎯 ${formatWikiLabel(c.tactics_type)}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  // Icon header: stars · element/attack (1–2) · weapon · tactics — real game icons,
  // resolved with the exact characters-page card logic.
  let head = textStat
  if (EMOJIS_READY) {
    const h = getHeaderIcons(c)
    const icons = [emoji(h.star), ...h.elementAttack.map(emoji), emoji(h.weapon), emoji(h.tactics)]
      .filter(Boolean)
      .join(" ")
    if (icons) head = icons
  }
  const date = c.release_date ? `📅 **${c.release_date}**` : ""
  const description = trunc([head, date].filter(Boolean).join(EMOJIS_READY ? "  ·  " : "\n"), 4096)

  const fields: { name: string; value: string }[] = []

  // One field per skill so each gets the full 1024-char budget (no "…" cutoff).
  for (const s of c.skills || []) {
    const header = [slotLabel(s.slot), skillTag(s), s.cost != null ? `Cost ${s.cost}` : null].filter(Boolean).join(" · ")
    fields.push({
      name: trunc(`⚔️ ${s.name || s.label}${header ? ` · ${header}` : ""}`, 256),
      value: trunc(clean(s.description_max_level) || "—", FIELD_MAX),
    })
  }

  // Traits before EX. Keep only the highest awaken level of each trait, full text.
  if (c.traits?.length)
    fields.push({
      name: "✨ Traits",
      value: fieldFrom(
        dedupeTraits(c.traits).map((t) => `**${baseTraitName(t)}**\n${trunc(clean(t.description_max_level), 220)}`)
      ),
    })

  // EX abilities: condition line + the actual stat values from effects[].
  if (c.ex_abilities?.length)
    fields.push({
      name: "💠 EX Abilities",
      value: fieldFrom(
        c.ex_abilities.map((e) => {
          const effects = (e.effects || []).map((x) => clean(x)).filter(Boolean)
          const eff = effects.length ? `\n${effects.map((x) => `• ${x}`).join("\n")}` : ""
          return `**${e.name}**\n${trunc(clean(e.description), 200)}${eff}`
        })
      ),
    })

  const forceEntries = getCharacterForceEntries(c).filter((f) => f.name)
  if (forceEntries.length) {
    const value = EMOJIS_READY
      ? forceEntries.map((f) => `${emoji(f.icon) ? `${emoji(f.icon)} ` : ""}${f.name}`).join("  ·  ")
      : forceEntries.map((f) => f.name).join(", ")
    fields.push({ name: "🛡️ Forces", value: trunc(value, FIELD_MAX) })
  }

  const icon = imageUrl(c.images?.icon)
  return {
    title: trunc(`${c.name}${c.affiliation_name ? ` — ${c.affiliation_name}` : ""}`, 256),
    url: `${SITE_URL}/characters/${c.master_pc_id}`,
    color: elementColor(c.element),
    description,
    ...(icon ? { thumbnail: { url: icon } } : {}),
    fields,
    footer: { text: `ID ${c.master_pc_id} · slimewiki` },
  }
}

// Cap a multi-entry field at Discord's 1024 limit, dropping whole trailing entries.
function fieldFrom(parts: string[]) {
  let out = ""
  let shown = 0
  for (const p of parts) {
    const next = out ? `${out}\n\n${p}` : p
    if (next.length > FIELD_MAX - 18) break
    out = next
    shown++
  }
  if (!out) out = trunc(parts[0] || "—", FIELD_MAX)
  if (shown < parts.length) out += `\n\n…+${parts.length - shown} more (see wiki)`
  return out
}

// Raw Discord component rows (string select + optional pager) for a freeform
// multi-match. Used only when someone submits text without picking autocomplete.
export function buildVariantComponents(query: string, matches: WikiCharacter[], page = 0, kind: "info" | "image" = "info") {
  const selectId = kind === "image" ? "img:select" : "char:select"
  const pagePrefix = kind === "image" ? "img:page" : "char:page"
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const p = Math.min(Math.max(0, page), pages - 1)
  const slice = matches.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE)
  const cap = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s || "—")

  const rows: unknown[] = [
    {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: selectId,
          placeholder: `Pick a variant${pages > 1 ? ` · page ${p + 1}/${pages}` : ""}`,
          options: slice.map((c) => ({
            label: cap(c.affiliation_name || c.name, 100),
            description: cap(`${c.name} · ${stars(c.rarity) || `${c.rarity}★`} · ${elementLabel(c.element)}`, 100),
            value: String(c.master_pc_id),
          })),
        },
      ],
    },
  ]
  if (pages > 1) {
    const q = encodeURIComponent(query).slice(0, 80)
    rows.push({
      type: 1,
      components: [
        { type: 2, style: 2, custom_id: `${pagePrefix}:${q}:${p - 1}`, label: "◀ Prev", disabled: p === 0 },
        { type: 2, style: 2, custom_id: `${pagePrefix}:${q}:${p + 1}`, label: "Next ▶", disabled: p >= pages - 1 },
      ],
    })
  }
  return rows
}

export function resolveCharacter(value: string): { char?: WikiCharacter; matches?: WikiCharacter[]; none?: boolean } {
  if (/^\d+$/.test(value)) {
    const c = getWikiCharacterById(Number(value))
    if (isVisible(c)) return { char: c }
  }
  const m = searchCharacters(value)
  if (m.length === 0) return { none: true }
  if (m.length === 1) return { char: m[0] }
  return { matches: m }
}

// ── Character image (/characterimage) ─────────────────────────────────────────

// images.full is already the correct art for the character's OWN type — CharaInfo
// for a PC character, BlessInfo for a Bless character — so we just send it as-is.
export function characterImageUrl(c: WikiCharacter): string | null {
  const path = c.images?.full || c.images?.icon
  return path ? imageUrl(path) : null
}

// Just the picture: an embed with only the image (no title-link, no URL text),
// shown large and clickable to open at full resolution.
export function buildImageEmbed(c: WikiCharacter, url: string): DiscordEmbed {
  return {
    title: trunc(`${c.name} — ${c.affiliation_name}`, 256),
    color: elementColor(c.element),
    image: { url },
    footer: { text: `ID ${c.master_pc_id} · slimewiki` },
  }
}
