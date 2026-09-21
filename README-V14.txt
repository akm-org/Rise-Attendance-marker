ENDER SHARDS V14

Discord control is now sequential, matching the dropdown style in the reference:

1. Select a bot
2. Select a category
3. Select an action

Only the current dropdown is shown. The previous bot/category selectors are not left on screen.

All Minecraft bots share ONE Discord configuration stored in discord.csv:
- token
- ownerUserId
- enabled
- updateInterval
- statusMessageId

bots.csv contains Minecraft bot profiles only. Discord credentials are NOT duplicated per Minecraft bot.

Keep discord.csv private because it contains the Discord bot token.
