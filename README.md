# Discord Staff Attendance Bot v13

## Attendance flow

Attendance is **NOT automatically started when a staff member comes online on Discord**.

1. Configure the staff role with `/attendance role`.
2. Configure the attendance log/panel channel with `/attendance mark-channel #channel`.
3. Run `/attendance panel` once.
4. Staff click **🟢 Mark Online** in the panel when they start working.
5. The bot records the start time.
6. When that staff member actually goes **offline on Discord**, the bot automatically closes the attendance session and records the duration.
7. Going from online → idle → DND does not end the session. Only the transition to Discord `offline` ends it.

## Channels

- **Attendance log channel:** join/leave records and the Mark Online panel.
- **Dashboard channel:** optional live dashboard configured with `/attendance dashboard-channel`.

## Commands

- `/attendance role @Role` — choose who can use attendance.
- `/attendance mark-channel #channel` — set the attendance log/panel channel.
- `/attendance panel` — send the Mark Online panel.
- `/attendance dashboard-channel #channel` — set the live status channel.
- `/attendance dashboard` — create/refresh the dashboard.
- `/attendance status` — view your active time.
- `/attendance member @user` — view another member.
- `/attendance leaderboard` — show lifetime attendance ranking.
- `/attendance daily` — post today's active-time summary.
- `/attendance settings` — show configuration.
- `/attendance test` — test the log channel.
- `/attendance reset @user` — reset attendance data.

`/attendance sync` is intentionally disabled for automatic online marking. Staff must use the button.

## Recorded time

Each completed session is stored with start/end timestamps. The bot calculates:

- Current session
- Today
- This week
- This month
- Lifetime

Nicknames are never modified.

## Discord intents

Enable **Server Members Intent** and **Presence Intent** in the Discord Developer Portal. Presence intent is used only to detect when an already-marked staff member goes offline.
