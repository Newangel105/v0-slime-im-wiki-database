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

const nameRequired = {
  name: "name",
  description: "Character or variant name — start typing for suggestions",
  type: 3, // STRING
  required: true,
  autocomplete: true,
}
const nameOptional = { ...nameRequired, required: false }
// Display the in-game element names (Air -> Space, Holy -> Light); the values
// stay the internal data names so filtering still matches.
const elementChoices = [
  { name: "Fire", value: "Fire" },
  { name: "Water", value: "Water" },
  { name: "Wind", value: "Wind" },
  { name: "Earth", value: "Earth" },
  { name: "Light", value: "Holy" },
  { name: "Dark", value: "Dark" },
  { name: "Space", value: "Air" },
]

const commands = [
  {
    name: "character",
    description: "Look up a SLIME character, or filter by element / target / force",
    type: 1, // CHAT_INPUT
    options: [
      nameOptional,
      { name: "element", description: "Filter by element", type: 3, required: false, choices: elementChoices },
      {
        name: "target",
        description: "Filter by AoE or single target",
        type: 3,
        required: false,
        choices: [
          { name: "AoE", value: "aoe" },
          { name: "Single", value: "single" },
        ],
      },
      { name: "force", description: "Filter by force name", type: 3, required: false, autocomplete: true },
    ],
  },
  {
    name: "characterimage",
    description: "Send a SLIME character's full illustration",
    type: 1, // CHAT_INPUT
    options: [nameRequired],
  },
]

const url = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`

// PUT bulk-overwrites ALL of the app's commands with this set.
const res = await fetch(url, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(commands),
})
const text = await res.text()
console.log(`HTTP ${res.status}`)
console.log(text)
if (!res.ok) {
  console.error("✖ Registration failed (check the token / app id).")
  process.exit(1)
}
console.log(
  `\n✔ Registered ${commands.length} commands (/character, /characterimage) ` +
    `${guildId ? `to guild ${guildId} (instant)` : "globally (appears within ~1h)"}`
)
