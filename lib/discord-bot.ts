// Shared helpers for the Discord `/character` slash command (app/api/discord).
// Reuses the wiki's own data + label functions so the bot always matches the site
// and updates automatically with each deploy.
import {
  getAllWikiCharacters,
  getWikiCharacterById,
  getDisplayElementLabel,
  formatWikiLabel,
  stripColorTags,
  toPublicAssetPath,
  type WikiCharacter,
} from "@/lib/pc-wiki"

const SITE_URL = (process.env.DISCORD_SITE_URL || "https://slimewiki.vercel.app").replace(/\/+$/, "")
const FIELD_MAX = 1024
const PAGE_SIZE = 25 // Discord select-menu hard limit

type DiscordEmbed = {
  title: string
  url: string
  color: number
  description: string
  thumbnail?: { url: string }
  fields: { name: string; value: string }[]
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

// Match by character name OR variant (affiliation_name), ranked by relevance.
export function searchCharacters(query: string): WikiCharacter[] {
  const q = norm(query)
  if (!q) return []
  const matches = getAllWikiCharacters().filter(
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
export function autocompleteChoices(query: string) {
  const list = norm(query) ? searchCharacters(query) : getAllWikiCharacters().slice(0, PAGE_SIZE)
  return list.slice(0, 25).map((c) => ({
    name: trunc(
      `${c.name} — ${c.affiliation_name} · ${stars(c.rarity) || `${c.rarity}★`} ${getDisplayElementLabel(c.element)}`,
      100
    ),
    value: String(c.master_pc_id),
  }))
}

export function buildCharacterEmbed(c: WikiCharacter): DiscordEmbed {
  const stat = [
    stars(c.rarity),
    getDisplayElementLabel(c.element),
    c.weapon_type ? `🗡️ ${formatWikiLabel(c.weapon_type)}` : null,
    c.tactics_type ? `🎯 ${formatWikiLabel(c.tactics_type)}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
  const meta = [
    c.character_role ? `Role: **${formatWikiLabel(c.character_role)}**` : null,
    c.attack_type ? `Attack: **${formatWikiLabel(c.attack_type)}**` : null,
    c.ultimate_type ? `Ultimate: **${formatWikiLabel(c.ultimate_type)}**` : null,
    c.release_date ? `📅 **${c.release_date}**` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const fields: { name: string; value: string }[] = []
  if (c.skills?.length)
    fields.push({
      name: "⚔️ Skills",
      value: fieldFrom(
        c.skills.map(
          (s) => `**${s.name || s.label}**${s.cost != null ? ` · Cost ${s.cost}` : ""}\n${trunc(clean(s.description_max_level), 260)}`
        )
      ),
    })
  if (c.ex_abilities?.length)
    fields.push({
      name: "💠 EX Abilities",
      value: fieldFrom(c.ex_abilities.map((e) => `**${e.name}**\n${trunc(clean(e.description), 260)}`)),
    })
  if (c.traits?.length)
    fields.push({
      name: "✨ Traits",
      value: fieldFrom(
        c.traits.map(
          (t) => `**${t.name || t.label}**${t.unlock ? ` _(${t.unlock})_` : ""}\n${trunc(clean(t.description_max_level), 120)}`
        )
      ),
    })
  if (c.forces?.length) {
    const names = c.forces.map((f) => f.name || f.label).filter(Boolean)
    if (names.length) fields.push({ name: "🛡️ Forces", value: trunc(names.join(", "), FIELD_MAX) })
  }

  const icon = imageUrl(c.images?.icon)
  return {
    title: trunc(`${c.name}${c.affiliation_name ? ` — ${c.affiliation_name}` : ""}`, 256),
    url: `${SITE_URL}/characters/${c.master_pc_id}`,
    color: elementColor(c.element),
    description: trunc([stat, meta].filter(Boolean).join("\n"), 4096),
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
export function buildVariantComponents(query: string, matches: WikiCharacter[], page = 0) {
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
          custom_id: "char:select",
          placeholder: `Pick a variant${pages > 1 ? ` · page ${p + 1}/${pages}` : ""}`,
          options: slice.map((c) => ({
            label: cap(c.affiliation_name || c.name, 100),
            description: cap(`${c.name} · ${stars(c.rarity) || `${c.rarity}★`} · ${getDisplayElementLabel(c.element)}`, 100),
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
        { type: 2, style: 2, custom_id: `char:page:${q}:${p - 1}`, label: "◀ Prev", disabled: p === 0 },
        { type: 2, style: 2, custom_id: `char:page:${q}:${p + 1}`, label: "Next ▶", disabled: p >= pages - 1 },
      ],
    })
  }
  return rows
}

export function resolveCharacter(value: string): { char?: WikiCharacter; matches?: WikiCharacter[]; none?: boolean } {
  if (/^\d+$/.test(value)) {
    const c = getWikiCharacterById(Number(value))
    if (c) return { char: c }
  }
  const m = searchCharacters(value)
  if (m.length === 0) return { none: true }
  if (m.length === 1) return { char: m[0] }
  return { matches: m }
}
