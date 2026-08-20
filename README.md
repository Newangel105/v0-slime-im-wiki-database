# Slime Isekai Memories — Community Wiki

A fan-made database and toolkit for the mobile game **Slime Isekai Memories** (Tensura).
Browse every character, simulate summons, build teams, view 3D models and skill
cutscenes, make tier lists, and more — all in one Next.js app.

> Fan project for community/educational use. Not affiliated with the game's
> developers or publisher; all game names, characters, and assets belong to their
> respective owners.

## Features

- **Character database** — searchable, filterable roster with stats, skills, traits,
  and force shorthands in the search box (`WoF` → World of Fantasy, `OP1` → Ogre's Pride, …).
- **Summon simulator** — banner pulls with real rates and art.
- **Team builder** and **tier maker** — plan comps and rank units.
- **3D model viewer** and **skill viewer** — character models (react-three-fiber) and battle-skill movies.
- **Battle sim**, **gauge builder**, **orb converter**, **heartprints**, **forces**, **loup-loupe**, **guides**.
- **Discord `/character` bot** (optional) — the same data via a slash command.

## Tech stack

- **Next.js** (App Router) · **React** · **TypeScript**
- **Tailwind CSS**
- **react-three-fiber** / **drei** for 3D models
- **Supabase** for guides / dynamic content (optional)
- Media and bulk game data served from an object-storage CDN (any S3-compatible /
  Cloudflare R2 bucket)

## Getting started

```bash
git clone https://github.com/Newangel105/v0-slime-im-wiki-database
cd v0-slime-im-wiki-database
npm install
cp .env.example .env      # fill in what you use (see Environment variables)
npm run dev               # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

It's a standard Next.js app — deploy it anywhere that runs Next.js (a Node server,
or any serverless/edge adapter you prefer).

## Environment variables

Only `NEXT_PUBLIC_MEDIA_CDN` is required to see media/data; everything else enables
an optional feature. Copy `.env.example` → `.env` and set what you need. Real values
live in `.env`, which is gitignored — never commit them.

| Variable | For | Notes |
|---|---|---|
| `NEXT_PUBLIC_MEDIA_CDN` | media + bulk data | Public base URL of the bucket/CDN that hosts `/Movie/*`, `/Video/*`, and the large game-data JSON. No trailing slash. Leave blank in dev to serve from `public/`. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Guides | Your Supabase project (schema lives in `supabase/`). |
| `DISCORD_PUBLIC_KEY`, `DISCORD_APP_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_SITE_URL` | Discord bot | Powers the `/character` slash command (`app/api/discord`). |
| `GITHUB_TOKEN`, `GIST_ID` | Guide storage | Optional GitHub-backed content. |

## Where the data comes from

The game data (characters, skills, stats, summon banners) and media (3D models,
skill movies) are **not bundled in this repo** — they're large and belong to the
game. The app loads them at runtime from the CDN in `NEXT_PUBLIC_MEDIA_CDN`
(see `lib/pc-wiki.ts`, `lib/summon-data.ts`, `lib/enemies.ts`, `lib/media-cdn.ts`).

To run a working copy you point `NEXT_PUBLIC_MEDIA_CDN` at a bucket that holds that
extracted JSON + media. The code here is the site; the dataset is the piece you
bring your own of.

## Project structure

```
app/         Next.js routes — characters, summon, team-builder, tier-maker,
             model-viewer, skill-viewer, battle-sim, heartprints, forces,
             loup-loupe, guides, tools… plus app/api/* (data + Discord endpoints)
components/  React UI (the "nightink" folder is the live design)
lib/         data loaders + game logic (pc-wiki, summon-data, discord-bot, media-cdn…)
supabase/    Supabase schema for the guides section
public/      static assets
```

## License / attribution

Fan project, provided as-is for the community. Game name, characters, artwork, and
data © their respective owners — please don't present this as an official product.
