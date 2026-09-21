# Discord Attendance Bot v2.1

## Important fix

The previous build failed because it explicitly called Discord's authenticated `/gateway/bot` REST endpoint before connecting. Render then received HTTP 429 / Cloudflare error 1015.

This final build **does not make that preflight request**.

It connects directly with discord.js and includes retry/timeout diagnostics.

## Runtime

- Node.js 22.x
- discord.js 14.25.1
- dotenv 16.6.1

## Render

Build command:
`npm install`

Start command:
`npm start`

Environment:
- `DISCORD_TOKEN`
- `GUILD_ID`

## Attendance

- Manual `🟢 Mark Online` starts a session.
- Online/idle/dnd does not automatically start a session.
- Discord offline automatically ends an active session.
- Daily / weekly / monthly / lifetime time is tracked.
- Configurable attendance role.
- Separate log/panel/dashboard channels.
- Live dashboard edits one message instead of spamming.
- Nicknames are never changed.
