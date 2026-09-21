ENDER SHARDS V22

Discord DM slash-command fixes:
- /list is a real slash command and the bot option is OPTIONAL.
- If /list is used without a bot, the first online Minecraft bot is selected automatically.
- Discord commands are registered for Bot DMs and user-installed contexts.
- Added a DM text fallback: typing /list in the owner's DM also works even if Discord's slash-command picker has not refreshed yet.
- /panel and /bots also work as DM text fallbacks.
- /list sends the same generated player-list PNG used by the localhost panel to the owner's DM.
- All Discord controls remain owner-only and DM-only.

IMPORTANT: If Discord does not show /list immediately, restart the bot once. Discord global command lists can take time to refresh. The DM text fallback (/list) works immediately after the Discord bot is connected.
