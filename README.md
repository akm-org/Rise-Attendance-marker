# Discord Staff Attendance Bot v15

Render Web Service compatible Discord attendance bot.

## Render

- Service Type: **Web Service**
- Build Command: `npm install`
- Start Command: `npm start`
- No hardcoded Render port is required. The health server uses `process.env.PORT`.

The HTTP endpoint responds on `/` and `/health`.

## Environment variables

Configure these in Render Environment Variables:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`

Do not upload `.env`.

## Attendance

Attendance is manually started with **🟢 Mark Online**. Discord going offline automatically ends an active session.

Nicknames are never modified.

## Discord intents

Enable Server Members Intent and Presence Intent.

## Interaction troubleshooting

The bot logs every slash-command and button interaction with an `[INTERACTION]` or `[BUTTON]` line.
If Discord reports "The application did not respond", check Render logs for these lines.

Render:
- Service: Web Service
- Build: `npm install`
- Start: `npm start`

## v1.3 command registration fix

Slash commands are now registered **after Discord login** and use the application ID from the logged-in bot token (`client.user.id`). `CLIENT_ID` is no longer required.

This prevents a common failure where `CLIENT_ID` belongs to a different Discord application than `DISCORD_TOKEN`: the command can appear in Discord, but the running bot never receives the interaction.
