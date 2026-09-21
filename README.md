# Discord Attendance Bot v20 — Gateway Diagnostic

This build is specifically for diagnosing why the Discord bot remains offline on Render.

## Diagnostic changes

- Uses only `GatewayIntentBits.Guilds`
- Adds Discord.js Gateway debug logging
- Adds shard ready/reconnect/resume/disconnect/error logging
- Adds session invalidation logging
- Adds a hard 20-second timeout around `client.login()`
- Adds a 10-second timeout for READY after login resolves
- Never prints the Discord bot token
- Keeps the Render Web Service health endpoint

## Render

Build command:

```text
npm install
```

Start command:

```text
npm start
```

Required environment variables:

```text
DISCORD_TOKEN=your_bot_token
GUILD_ID=your_server_id
```

Open the Render logs after deployment.

Expected successful diagnostic:

```text
🔌 Calling client.login()...
[DISCORD DEBUG] ...
🔑 client.login() resolved.
[DISCORD DEBUG] ...
✅ DISCORD READY: ...
🏠 Cached guild count: ...
✅ TARGET GUILD FOUND: ...
🎉 GATEWAY TEST PASSED
```

If login hangs, the build will now explicitly report:

```text
❌ LOGIN FAILED / TIMED OUT
Discord client.login() did not resolve within 20 seconds.
```

Do not paste the actual DISCORD_TOKEN into chat or logs.
