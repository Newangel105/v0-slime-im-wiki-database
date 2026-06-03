// Discord Interactions endpoint for the `/character` slash command.
// Set the app's "Interactions Endpoint URL" to https://<site>/api/discord and
// add DISCORD_PUBLIC_KEY as an env var. Serverless / always-on with the site —
// no separate bot host needed.
import { verifyKey } from "discord-interactions"
import {
  autocompleteChoices,
  buildCharacterEmbed,
  buildVariantComponents,
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
    const focused = (body.data?.options ?? []).find((o: { focused?: boolean }) => o.focused)
    return Response.json({ type: AUTOCOMPLETE_RESULT, data: { choices: autocompleteChoices(String(focused?.value ?? "")) } })
  }

  if (body.type === APPLICATION_COMMAND) {
    const opt = (body.data?.options ?? []).find((o: { name: string }) => o.name === "name")
    const value = String(opt?.value ?? "").trim()
    if (!value) {
      return Response.json({ type: CHANNEL_MESSAGE, data: { content: "Type a character name.", flags: EPHEMERAL } })
    }
    const r = resolveCharacter(value)
    if (r.char) {
      return Response.json({ type: CHANNEL_MESSAGE, data: { embeds: [buildCharacterEmbed(r.char)] } })
    }
    if (r.matches) {
      return Response.json({
        type: CHANNEL_MESSAGE,
        data: {
          content: `Found **${r.matches.length}** variants for **${value}** — pick one:`,
          components: buildVariantComponents(value, r.matches, 0),
        },
      })
    }
    return Response.json({ type: CHANNEL_MESSAGE, data: { content: `No character found for **${value}**.`, flags: EPHEMERAL } })
  }

  if (body.type === MESSAGE_COMPONENT) {
    const customId: string = body.data?.custom_id ?? ""
    if (customId === "char:select") {
      const id = (body.data?.values ?? [])[0]
      const r = resolveCharacter(String(id ?? ""))
      if (r.char) {
        return Response.json({ type: UPDATE_MESSAGE, data: { content: "", embeds: [buildCharacterEmbed(r.char)], components: [] } })
      }
      return Response.json({ type: UPDATE_MESSAGE, data: { content: "That character isn't available.", components: [] } })
    }
    if (customId.startsWith("char:page:")) {
      const parts = customId.split(":")
      const query = decodeURIComponent(parts[2] ?? "")
      const page = Number.parseInt(parts[3], 10) || 0
      return Response.json({ type: UPDATE_MESSAGE, data: { components: buildVariantComponents(query, searchCharacters(query), page) } })
    }
  }

  return Response.json({ type: CHANNEL_MESSAGE, data: { content: "Unsupported interaction.", flags: EPHEMERAL } })
}
