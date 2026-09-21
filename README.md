# Discord Attendance Bot v2.2

This build specifically diagnoses the Render -> Discord Gateway connection.

## What changed

The previous v2.1 repeatedly hung at:

`Preparing to connect to the gateway...`

v2.2 first opens a raw WebSocket to Discord's public Gateway.

It does NOT call `/gateway/bot`, which previously returned 429 / error 1015.

If the raw WebSocket is rejected or times out, the bot exits instead of repeatedly hammering Discord.

If the raw Gateway works, it starts discord.js normally.

Optional proxy:
`DISCORD_PROXY=http://user:password@host:port`

## Render

Build:
`npm install`

Start:
`npm start`

Required:
`DISCORD_TOKEN`
`GUILD_ID`

Optional:
`DISCORD_PROXY`

## Attendance features

- Manual 🟢 Mark Online
- Discord offline automatically ends active session
- Daily / weekly / monthly / lifetime tracking
- Configurable attendance role
- Attendance log channel
- Attendance panel channel
- Live dashboard channel
- Live online count
- Buttons and slash commands
- No nickname changes

## Important

If the raw Gateway test reports HTTP 429 / 1015, this is an outbound IP rate-limit/network issue, not an attendance-code issue. Do not repeatedly redeploy/restart; use a stable outbound IP/proxy or move the Gateway bot to a VPS.
