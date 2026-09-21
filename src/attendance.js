const {
    getAttendance,
    saveAttendance,
    ensureMember,
    getConfig,
    saveConfig
} = require("./database");

const {
    formatDuration,
    startOfDay,
    startOfWeek,
    startOfMonth,
    rangeSeconds
} = require("./utils");

async function getChannelById(guild, channelId, label) {
    if (!channelId) {
        console.error(`[ATTENDANCE] No ${label} configured.`);
        return null;
    }

    const channel = guild.channels.cache.get(channelId) ||
        await guild.channels.fetch(channelId).catch(() => null);

    if (!channel || !channel.isTextBased()) {
        console.error(`[ATTENDANCE] Configured ${label} is not a text channel.`);
        return null;
    }

    const me = guild.members.me;
    if (me && !channel.permissionsFor(me)?.has(["ViewChannel", "SendMessages"])) {
        console.error(`[ATTENDANCE] Bot cannot View/Send in #${channel.name} (${label}).`);
        return null;
    }

    return channel;
}

async function getAttendanceChannel(guild) {
    return getChannelById(guild, getConfig().channelId, "attendance log channel");
}

async function getDashboardChannel(guild) {
    const config = getConfig();
    return getChannelById(guild, config.dashboardChannelId || config.channelId, "dashboard channel");
}

async function getPanelChannel(guild) {
    const config = getConfig();
    return getChannelById(guild, config.panelChannelId || config.channelId, "attendance panel channel");
}

function ts(ms, style = "t") {
    return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

function isOnline(member) {
    const status = member.presence?.status;
    return status === "online" || status === "idle" || status === "dnd";
}

function trackedMembers(guild, roleId) {
    if (!roleId) return [];

    return [...guild.members.cache.values()].filter(member =>
        member.roles.cache.has(roleId)
    );
}

function activeTrackedMembers(guild, roleId) {
    const data = getAttendance();
    return trackedMembers(guild, roleId).filter(member => Boolean(data.members?.[member.id]?.activeSince));
}

function buildLiveStatus(guild) {
    const config = getConfig();
    const members = trackedMembers(guild, config.roleId);
    const active = activeTrackedMembers(guild, config.roleId);

    const lines = active.length
        ? active.map(member => `🟢 <@${member.id}>`)
        : ["⚫ No staff currently marked online."];

    return [
        "╔══════════════════════════════╗",
        "      📊 **STAFF ATTENDANCE**",
        "╚══════════════════════════════╝",
        "",
        `🟢 **Marked online: ${active.length} / ${members.length}**`,
        "",
        "**Currently Online**",
        lines.join("\n"),
        "",
        `🔄 Last updated: ${ts(Date.now(), "T")}`
    ].join("\n");
}

async function updateLiveStatus(guild) {
    const config = getConfig();
    if (!config.channelId) return false;

    const channel = await getDashboardChannel(guild);
    if (!channel) return false;

    const content = buildLiveStatus(guild);
    // Store the dashboard message ID in config.
    let message = null;

    if (config.statusMessageId) {
        message = await channel.messages.fetch(config.statusMessageId).catch(() => null);
    }

    try {
        if (message) {
            await message.edit({ content });
        } else {
            message = await channel.send({ content });
            config.statusMessageId = message.id;
            saveConfig(config);
        }

        return true;
    } catch (error) {
        console.error(
            `[ATTENDANCE] Live status update failed: ${error.message} (code ${error.code || "unknown"})`
        );
        return false;
    }
}

function attendancePanelComponents() {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("attendance:mark-online")
            .setLabel("Mark Online")
            .setEmoji("🟢")
            .setStyle(ButtonStyle.Success)
    )];
}

async function sendAttendancePanel(guild) {
    const channel = await getPanelChannel(guild);
    if (!channel) return false;

    const { EmbedBuilder } = require("discord.js");
    const embed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("🛡️  STAFF ATTENDANCE")
        .setDescription(
            "### Welcome, Staff 👋\n" +
            "Use the button below to start your attendance session.\n\n" +
            "**🟢 Mark Online**  →  Start your shift timer\n" +
            "**🔴 Discord Offline**  →  Automatically end your session\n\n" +
            "> Your Discord status does **not** start attendance automatically. You must click the button when you begin working."
        )
        .addFields(
            { name: "🟢  START YOUR SHIFT", value: "Click **Mark Online** once when you begin working.", inline: true },
            { name: "🔴  END YOUR SHIFT", value: "When you go Discord offline, your active session closes automatically.", inline: true },
            { name: "⏱️  TRACKED TIME", value: "Daily • Weekly • Monthly • Lifetime\nUse `/attendance status` anytime.", inline: false }
        )
        .setFooter({ text: "Staff Attendance • Please mark yourself online when you start" })
        .setTimestamp();

    try {
        await channel.send({
            embeds: [embed],
            components: attendancePanelComponents()
        });
        return true;
    } catch (error) {
        console.error(`[ATTENDANCE] Panel send failed: ${error.message}`);
        return false;
    }
}

async function sendAttendanceMessage(
    guild,
    member,
    type,
    sessionSeconds = 0,
    reason = "",
    sessionStart = null,
    sessionEnd = null
) {
    const channel = await getAttendanceChannel(guild);
    if (!channel) return false;

    const data = getAttendance();
    const record = ensureMember(data, member.id);

    const today = rangeSeconds(record, startOfDay());
    const week = rangeSeconds(record, startOfWeek());
    const month = rangeSeconds(record, startOfMonth());

    let content;

    if (type === "online") {
        const started = sessionStart || record.activeSince || Date.now();

        content =
            `🟢 **STAFF ONLINE**\n` +
            `👤 <@${member.id}>\n` +
            `🕐 Came online: ${ts(started)}\n` +
            `⏱️ Current session: **0s**\n` +
            `📊 Today so far: **${formatDuration(today)}**` +
            (reason ? `\nℹ️ ${reason}` : "");
    } else {
        const ended = sessionEnd || Date.now();
        const started = sessionStart || ended - sessionSeconds * 1000;

        content =
            `🔴 **STAFF OFFLINE**\n` +
            `👤 <@${member.id}>\n` +
            `🟢 Came online: ${ts(started)}\n` +
            `🔴 Went offline: ${ts(ended)}\n` +
            `⏱️ Active this session: **${formatDuration(sessionSeconds)}**\n` +
            `📅 Today total: **${formatDuration(today)}**\n` +
            `📆 Week total: **${formatDuration(week)}**\n` +
            `🗓️ Month total: **${formatDuration(month)}**` +
            (reason ? `\nℹ️ ${reason}` : "");
    }

    try {
        await channel.send({ content });
        console.log(`[ATTENDANCE] Sent ${type} event for ${member.user.username} to #${channel.name}`);
        return true;
    } catch (error) {
        console.error(
            `[ATTENDANCE] Send failed: ${error.message} (code ${error.code || "unknown"})`
        );
        return false;
    }
}

async function sendDailySummary(guild) {
    const channel = await getAttendanceChannel(guild);
    if (!channel) return false;

    const data = getAttendance();
    const entries = [];

    for (const [userId, record] of Object.entries(data.members || {})) {
        const member = guild.members.cache.get(userId);
        if (!member) continue;

        const seconds = rangeSeconds(record, startOfDay());
        if (seconds > 0) {
            entries.push({
                member,
                seconds,
                online: isOnline(member)
            });
        }
    }

    entries.sort((a, b) => b.seconds - a.seconds);

    const online = entries.filter(x => x.online).length;

    let content =
        `📊 **DAILY STAFF ATTENDANCE**\n` +
        `📅 ${ts(Date.now(), "D")}\n` +
        `🟢 Currently online: **${online}**\n` +
        `👥 Staff with activity today: **${entries.length}**\n\n`;

    content += entries.length
        ? entries.map((entry, i) =>
            `${i + 1}. ${entry.online ? "🟢" : "⚫"} <@${entry.member.id}> — **${formatDuration(entry.seconds)}**`
        ).join("\n")
        : "No attendance recorded today.";

    try {
        await channel.send({ content });
        return true;
    } catch (error) {
        console.error(`[ATTENDANCE] Daily summary failed: ${error.message}`);
        return false;
    }
}

async function handlePresence(member, state, announceChanges = true, reason = "") {
    const data = getAttendance();
    const record = ensureMember(data, member.id);

    if (state === "online") {
        if (!record.activeSince) {
            record.activeSince = Date.now();
            const start = record.activeSince;

            saveAttendance(data);

            if (announceChanges) {
                await sendAttendanceMessage(
                    member.guild, member, "online", 0, reason, start, null
                );
            } else {
                await updateLiveStatus(member.guild);
            }
        }
        return;
    }

    if (state === "offline") {
        if (!record.activeSince) {
            saveAttendance(data);
            await updateLiveStatus(member.guild);
            return;
        }

        const start = record.activeSince;
        const end = Date.now();
        const seconds = Math.max(0, (end - start) / 1000);

        record.sessions.push({ start, end });
        record.totalSeconds += seconds;
        record.activeSince = null;

        saveAttendance(data);

        if (announceChanges) {
            await sendAttendanceMessage(
                member.guild, member, "offline", seconds, reason, start, end
            );
        } else {
            await updateLiveStatus(member.guild);
        }
    }
}

function getStats(userId) {
    const data = getAttendance();
    const record = ensureMember(data, userId);

    return {
        today: rangeSeconds(record, startOfDay()),
        week: rangeSeconds(record, startOfWeek()),
        month: rangeSeconds(record, startOfMonth()),
        lifetime: record.totalSeconds,
        active: Boolean(record.activeSince),
        activeSince: record.activeSince,
        currentSession: record.activeSince
            ? Math.max(0, (Date.now() - record.activeSince) / 1000)
            : 0
    };
}

function resetMember(userId) {
    const data = getAttendance();
    const old = data.members[userId];

    data.members[userId] = {
        baseName: old?.baseName || null,
        sessions: [],
        totalSeconds: 0,
        activeSince: null
    };

    saveAttendance(data);
}

module.exports = {
    handlePresence,
    sendAttendanceMessage,
    sendAttendancePanel,
    sendDailySummary,
    updateLiveStatus,
    getStats,
    resetMember
};
