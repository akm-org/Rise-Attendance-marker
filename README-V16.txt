ENDER SHARDS V16 - 60 SECOND JOIN/RECONNECT PROTECTION

This version adds a connection gate designed for servers that rate-limit or
flag rapid reconnects.

Rules:
- At least 60 seconds between Minecraft connection attempts across ALL bots.
- A disconnected bot waits 60 seconds before its own reconnect attempt.
- Multiple bots are automatically staggered by the same global gate.
- Duplicate connection attempts for the same bot are suppressed.
- Autosell still waits for a successful login and a healthy protocol connection.
- Existing Discord owner-DM control, CSV profiles, autosell, auto-pay, logs and
  localhost panel are retained.

Example with three bots:
BOT-1 connection attempt -> wait at least 60s -> BOT-2 -> wait at least 60s -> BOT-3.

This does not disable or bypass UltimateAntiBot. It simply avoids rapid reconnect
behavior that can trigger server-side connection protections.
