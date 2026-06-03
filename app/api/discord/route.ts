// Discord Interactions endpoint for the `/character` slash command.
// Set the app's "Interactions Endpoint URL" to https://<site>/api/discord and
// add DISCORD_PUBLIC_KEY as an env var. Serverless / always-on with the site —
// no separate bot host needed.
import { verifyKey } from "discord-interactions"
import {
  autocompleteChoices,
  buildCharacterEmbed,
  buildImageEmbed,
  buildVariantComponents,
  characterImageUrl,
  filterCharacters,
  forceAutocomplete,
  resolveCharacter,
  searchCharacters,
} from "@/lib/discord-bot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || ""
const EPHEMERAL = 64

// Discord interaction types
const PING = 1
const APPLICATION_COMMAND = 2
const MESSAGE_COMPONENT = 3
const APPLICATION_COMMAND_AUTOCOMPLETE = 4
// Discord interaction-response types
const PONG = 1
const CHANNEL_MESSAGE = 4
const UPDATE_MESSAGE = 7
const AUTOCOMPLETE_RESULT = 8

export async function POST(req: Request) {
  const signature = req.headers.get("x-signature-ed25519")
  const timestamp = req.headers.get("x-signature-timestamp")
  const raw = await req.text()

  if (!signature || !timestamp || !PUBLIC_KEY || !(await verifyKey(raw, signature, timestamp, PUBLIC_KEY))) {
    return new Response("invalid request signature", { status: 401 })
  }

  const body = JSON.parse(raw)

  if (body.type === PING) {
    return Response.json({ type: PONG })
  }

  if (body.type === APPLICATION_COMMAND_AUTOCOMPLETE) {
    const focused = (body.data?.options ?? []).find((o: { focused?: boolean; name?: string }) => o.focused)
    const value = String(focused?.value ?? "")
    // `force` option suggests force names; `name` (default) suggests characters.
    const choices = focused?.name === "force" ? forceAutocomplete(value) : autocompleteChoices(value)
    return Response.json({ type: AUTOCOMPLETE_RESULT, data: { choices } })
  }

  if (body.type === APPLICATION_COMMAND) {
    const wantImage = body.data?.name === "characterimage"
    const options: Array<{ name: string; value?: unknown }> = body.data?.options ?? []
    const optVal = (n: string) => {
      const v = options.find((o) => o.name === n)?.value
      return v == null ? "" : String(v).trim()
    }
    const name = optVal("name")
    const element = optVal("element")
    const target = optVal("target")
    const force = optVal("force")

    // 1) Specific character (typed name or autocomplete pick).
    if (name) {
      const r = resolveCharacter(name)
      if (r.char) {
        if (wantImage) {
          const url = characterImageUrl(r.char)
          if (!url) return Response.json({ type: CHANNEL_MESSAGE, data: { content: "No image for that character.", flags: EPHEMERAL } })
          return Response.json({ type: CHANNEL_MESSAGE, data: { embeds: [buildImageEmbed(r.char, url)] } })
        }
        return Response.json({ type: CHANNEL_MESSAGE, data: { embeds: [buildCharacterEmbed(r.char)] } })
      }
      if (r.matches) {
        return Response.json({
          type: CHANNEL_MESSAGE,
          data: {
            content: `Found **${r.matches.length}** variants for **${name}** — pick one:`,
            components: buildVariantComponents(name, r.matches, 0, wantImage ? "image" : "info"),
          },
        })
      }
      return Response.json({ type: CHANNEL_MESSAGE, data: { content: `No character found for **${name}**.`, flags: EPHEMERAL } })
    }

    // 2) Filter mode (/character only): element / target / force.
    if (!wantImage && (element || target || force)) {
      const matches = filterCharacters({ element, target, force })
      if (matches.length === 0) {
        return Response.json({ type: CHANNEL_MESSAGE, data: { content: "No characters match those filters.", flags: EPHEMERAL } })
      }
      const desc = [
        element ? `element **${element}**` : null,
        target ? `**${target === "single" ? "Single" : "AoE"}**` : null,
        force ? `force **${force}**` : null,
      ]
        .filter(Boolean)
        .join(" · ")
      const shown = matches.slice(0, 25)
      const more = matches.length > 25 ? " (showing first 25 — add filters to narrow)" : ""
      return Response.json({
        type: CHANNEL_MESSAGE,
        data: {
          content: `**${matches.length}** characters match ${desc}${more} — pick one:`,
          components: buildVariantComponents("", shown, 0, "info"),
        },
      })
    }

    return Response.json({
      type: CHANNEL_MESSAGE,
      data: {
        content: wantImage
          ? "Pick a character with the **name** option."
          : "Use **name** to look up a character, or filter by **element** / **target** / **force**.",
        flags: EPHEMERAL,
      },
    })
  }

  if (body.type === MESSAGE_COMPONENT) {
    const customId: string = body.data?.custom_id ?? ""
    if (customId === "char:select" || customId === "img:select") {
      const id = (body.data?.values ?? [])[0]
      const r = resolveCharacter(String(id ?? ""))
      if (!r.char) {
        return Response.json({ type: UPDATE_MESSAGE, data: { content: "That character isn't available.", components: [] } })
      }
      if (customId === "img:select") {
        const url = characterImageUrl(r.char)
        return Response.json({
          type: UPDATE_MESSAGE,
          data: { content: "", embeds: [url ? buildImageEmbed(r.char, url) : buildCharacterEmbed(r.char)], components: [] },
        })
      }
      return Response.json({ type: UPDATE_MESSAGE, data: { content: "", embeds: [buildCharacterEmbed(r.char)], components: [] } })
    }
    if (customId.startsWith("char:page:") || customId.startsWith("img:page:")) {
      const isImg = customId.startsWith("img:page:")
      const parts = customId.split(":")
      const query = decodeURIComponent(parts[2] ?? "")
      const page = Number.parseInt(parts[3], 10) || 0
      return Response.json({
        type: UPDATE_MESSAGE,
        data: { components: buildVariantComponents(query, searchCharacters(query), page, isImg ? "image" : "info") },
      })
    }
  }

  return Response.json({ type: CHANNEL_MESSAGE, data: { content: "Unsupported interaction.", flags: EPHEMERAL } })
}
