# Rise Attendance Marker v2.4

Discord.js uses the same connection pattern as the working EnderShards/AFK-RISE project:
- direct `client.login(TOKEN)`
- Guilds + GuildMembers + GuildPresences
- no `/gateway/bot` preflight
- no `/gateway` HTTP preflight
- no custom raw Gateway test
- no startup login retry loop
- no token debug output

Attendance behavior:
- staff start attendance manually with **🟢 Mark Online**
- Discord offline automatically closes an active session
- online/idle/DND changes do not start/end attendance
- no nickname modifications are performed
- live dashboard edits one message in place
- Daily / Weekly / Monthly / Lifetime statistics are stored in `data/attendance.json`

Render:
Build: `npm install`
Start: `npm start`
