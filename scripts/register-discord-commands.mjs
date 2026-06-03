// Registers the /character slash command with Discord. Run once (and again only
// if you change the command definition below).
//
//   Windows PowerShell:
//     $env:DISCORD_APP_ID="1511724712873426985"; $env:DISCORD_BOT_TOKEN="<token>"; node scripts/register-discord-commands.mjs
//   (optional, for instant testing in one server:)  $env:DISCORD_GUILD_ID="<server id>"
//
// Global commands take up to ~1 hour to appear; a guild command is instant.
const appId = process.env.DISCORD_APP_ID
const token = process.env.DISCORD_BOT_TOKEN
const guildId = process.env.DISCORD_GUILD_ID

if (!appId || !token) {
  console.error("Set DISCORD_APP_ID and DISCORD_BOT_TOKEN environment variables first.")
  process.exit(1)
}

const command = {
  name: "character",
  description: "Look up a SLIME character: skills, traits, EX abilities, forces, element, weapon & more",
  type: 1, // CHAT_INPUT
  options: [
    {
      name: "name",
      description: "Character or variant name — start typing for suggestions",
      type: 3, // STRING
      required: true,
      autocomplete: true,
    },
  ],
}

const url = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`

const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(command),
})
const text = await res.text()
console.log(`HTTP ${res.status}`)
console.log(text)
if (!res.ok) {
  console.error("✖ Registration failed (check the token / app id).")
  process.exit(1)
}
console.log(
  `\n✔ Registered /character ${guildId ? `to guild ${guildId} (instant)` : "globally (appears within ~1h)"}`
)
