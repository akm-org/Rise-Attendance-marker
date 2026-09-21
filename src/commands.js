const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const { getConfig, saveConfig, getAttendance, saveAttendance, ensureMember } = require("./database");
const { getStats, resetMember, sendAttendanceMessage, sendAttendancePanel, sendDailySummary, updateLiveStatus } = require("./attendance");
const { formatDuration } = require("./utils");

const commands = [
    new SlashCommandBuilder().setName("attendance").setDescription("Manage staff attendance")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName("role").setDescription("Set the role that will be tracked")
            .addRoleOption(o => o.setName("role").setDescription("Attendance role").setRequired(true)))
        .addSubcommand(s => s.setName("mark-channel").setDescription("Set the channel for join/leave attendance logs")
            .addChannelOption(o => o.setName("channel").setDescription("Log text channel").setRequired(true)))
        .addSubcommand(s => s.setName("panel-channel").setDescription("Set the channel where the Mark Online panel is posted")
            .addChannelOption(o => o.setName("channel").setDescription("Attendance panel channel").setRequired(true)))
        .addSubcommand(s => s.setName("dashboard-channel").setDescription("Set the live online staff dashboard channel")
            .addChannelOption(o => o.setName("channel").setDescription("Dashboard text channel").setRequired(true)))
        .addSubcommand(s => s.setName("settings").setDescription("Show attendance settings"))
        .addSubcommand(s => s.setName("test").setDescription("Test the configured attendance channel"))
        .addSubcommand(s => s.setName("sync").setDescription("Synchronize currently online staff"))
        .addSubcommand(s => s.setName("daily").setDescription("Post today's staff active-time summary"))
        .addSubcommand(s => s.setName("dashboard").setDescription("Create or refresh the live staff status dashboard"))
        .addSubcommand(s => s.setName("panel").setDescription("Send the Mark Online attendance panel"))
        .addSubcommand(s => s.setName("status").setDescription("Show your attendance"))
        .addSubcommand(s => s.setName("member").setDescription("Show a member's attendance")
            .addUserOption(o => o.setName("user").setDescription("Staff member").setRequired(true)))
        .addSubcommand(s => s.setName("leaderboard").setDescription("Show attendance leaderboard"))
        .addSubcommand(s => s.setName("reset").setDescription("Reset a member's attendance")
            .addUserOption(o => o.setName("user").setDescription("Staff member").setRequired(true)))
];

function dashboardRows() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("attendance:status").setLabel("My Attendance").setEmoji("📊").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("attendance:leaderboard").setLabel("Leaderboard").setEmoji("🏆").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("attendance:refresh").setLabel("Refresh").setEmoji("🔄").setStyle(ButtonStyle.Success)
    )];
}

async function makeStatsMessage(member) {
    const s = getStats(member.id);
    const current = s.active && s.activeSince
        ? `\n⏱️ Current session: **${formatDuration((Date.now()-s.activeSince)/1000)}**`
        : "";
    return [
        `📊 **Attendance — ${member.user.username}**`, "",
        s.active ? "🟢 Status: **Online**" : "⚫ Status: **Offline**",
        `📅 Today: **${formatDuration(s.today)}**`,
        `📆 This week: **${formatDuration(s.week)}**`,
        `🗓️ This month: **${formatDuration(s.month)}**`,
        `🏆 Lifetime: **${formatDuration(s.lifetime)}**`, current
    ].join("\n");
}

async function makeLeaderboard(guild) {
    const data = getAttendance();
    const entries = Object.entries(data.members)
        .map(([id, record]) => ({ id, total: record.totalSeconds || 0 }))
        .sort((a,b) => b.total-a.total).slice(0,10);

    if (!entries.length) return "🏆 **Attendance Leaderboard**\n\nNo attendance data yet.";

    const lines = [];
    for (let i=0; i<entries.length; i++) {
        const member = await guild.members.fetch(entries[i].id).catch(() => null);
        lines.push(`**${i+1}.** ${member ? member.user.username : entries[i].id} — ${formatDuration(entries[i].total)}`);
    }
    return `🏆 **Attendance Leaderboard**\n\n${lines.join("\n")}`;
}

async function execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig();

    if (sub === "role") {
        const role = interaction.options.getRole("role");
        config.roleId = role.id;
        saveConfig(config);
        await updateLiveStatus(interaction.guild).catch(() => {});
        return interaction.editReply(`✅ Attendance role set to ${role}.`);
    }

    if (sub === "mark-channel") {
        const channel = interaction.options.getChannel("channel");
        if (!channel.isTextBased()) return interaction.editReply("❌ Please select a text channel.");
        config.channelId = channel.id;
        if (!config.dashboardChannelId) config.statusMessageId = null;
        saveConfig(config);
        return interaction.editReply(`✅ Attendance log channel set to ${channel}.`);
    }

    if (sub === "panel-channel") {
        const channel = interaction.options.getChannel("channel");
        if (!channel.isTextBased()) return interaction.editReply("❌ Please select a text channel.");
        config.panelChannelId = channel.id;
        saveConfig(config);
        return interaction.editReply(`✅ Attendance panel channel set to ${channel}. Use \`/attendance panel\` to post the panel there.`);
    }

    if (sub === "dashboard-channel") {
        const channel = interaction.options.getChannel("channel");
        if (!channel.isTextBased()) return interaction.editReply("❌ Please select a text channel.");
        config.dashboardChannelId = channel.id;
        config.statusMessageId = null;
        saveConfig(config);
        const ok = await updateLiveStatus(interaction.guild);
        return interaction.editReply(ok
            ? `✅ Live dashboard channel set to ${channel}.`
            : `⚠️ Dashboard channel set to ${channel}, but I could not create the dashboard. Check permissions.`);
    }

    if (sub === "settings") {
        const role = config.roleId ? interaction.guild.roles.cache.get(config.roleId) : null;
        const channel = config.channelId ? interaction.guild.channels.cache.get(config.channelId) : null;
        const panelChannel = config.panelChannelId ? interaction.guild.channels.cache.get(config.panelChannelId) : null;
        const dashboardChannel = config.dashboardChannelId ? interaction.guild.channels.cache.get(config.dashboardChannelId) : null;
        return interaction.editReply(`⚙️ **Attendance Settings**\n\nRole: ${role ?? "`Not configured`"}\nLog channel: ${channel ?? "`Not configured`"}\nPanel channel: ${panelChannel ?? "`Same as log channel`"}\nDashboard channel: ${dashboardChannel ?? "`Same as log channel`"}`);
    }

    if (sub === "test") {
        const channel = config.channelId ? await interaction.guild.channels.fetch(config.channelId).catch(() => null) : null;
        if (!channel || !channel.isTextBased()) return interaction.editReply("❌ Attendance channel is not configured or is not a text channel.");
        try {
            await channel.send(`🧪 **Attendance channel test** — sent by ${interaction.user}.`);
            return interaction.editReply(`✅ Test message sent to ${channel}.`);
        } catch (error) {
            return interaction.editReply(`❌ Could not send to ${channel}. Error: **${error.message}** (code ${error.code || "unknown"})`);
        }
    }

    if (sub === "sync") {
        return interaction.editReply("ℹ️ Automatic online synchronization is disabled. Staff must click **🟢 Mark Online** in the attendance panel. Going offline is still detected automatically.");
    }

    if (sub === "panel") {
        const ok = await sendAttendancePanel(interaction.guild);
        return interaction.editReply(ok ? "✅ Beautiful attendance panel sent to the configured panel channel." : "❌ Could not send the attendance panel.");
    }

    if (sub === "daily") {
        const ok = await sendDailySummary(interaction.guild);
        return interaction.editReply(ok ? "✅ Today's active-time summary was posted in the attendance channel." : "❌ Could not post the daily summary.");
    }

    if (sub === "dashboard") {
        const ok = await updateLiveStatus(interaction.guild);
        return interaction.editReply(ok ? "✅ Live staff dashboard created/refreshed." : "❌ Could not update the attendance dashboard.");
    }

    if (sub === "status") return interaction.editReply({content:await makeStatsMessage(interaction.member), components:dashboardRows()});

    if (sub === "member") {
        const user = interaction.options.getUser("user");
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.editReply({content:"❌ Member not found.", flags:MessageFlags.Ephemeral});
        return interaction.editReply({content:await makeStatsMessage(member), components:dashboardRows()});
    }

    if (sub === "leaderboard") {
        return interaction.editReply({content:await makeLeaderboard(interaction.guild), components:dashboardRows()});
    }

    if (sub === "reset") {
        const user = interaction.options.getUser("user");
        resetMember(user.id);
        return interaction.editReply(`♻️ Attendance reset for **${user.username}**.`);
    }
}

async function handleButton(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith("attendance:")) return false;

    const action = interaction.customId.split(":")[1];
    await interaction.deferUpdate();
    console.log(`[BUTTON] ${action} acknowledged for ${interaction.user?.tag || interaction.user?.id}`);

    if (action === "mark-online") {
        const config = getConfig();
        if (!config.roleId) {
            await interaction.followUp({content:"❌ Attendance role is not configured.", flags:MessageFlags.Ephemeral});
            return true;
        }

        const member = interaction.member;
        if (!member?.roles?.cache?.has(config.roleId)) {
            await interaction.followUp({content:"❌ You are not assigned the configured attendance role.", flags:MessageFlags.Ephemeral});
            return true;
        }

        const data = getAttendance();
        const record = ensureMember(data, member.id);

        if (record.activeSince) {
            await interaction.followUp({
                content:`ℹ️ You are already marked online. Your current session is **${formatDuration(Math.max(0,(Date.now()-record.activeSince)/1000))}**.`,
                flags:MessageFlags.Ephemeral
            });
            return true;
        }

        record.activeSince = Date.now();
        saveAttendance(data);

        await sendAttendanceMessage(interaction.guild, member, "online", 0,
            "Attendance started from the Mark Online button",
            record.activeSince, null);

        await updateLiveStatus(interaction.guild);

        await interaction.followUp({
            content:"✅ You are now marked **online**. Your attendance timer has started.",
            flags:MessageFlags.Ephemeral
        });
        return true;
    }

    if (action === "status" || action === "refresh") {
        await interaction.editReply({content:await makeStatsMessage(interaction.member),components:dashboardRows()});
        return true;
    }

    if (action === "leaderboard") {
        await interaction.editReply({content:await makeLeaderboard(interaction.guild),components:dashboardRows()});
        return true;
    }

    return true;
}

module.exports = { commands, execute, handleButton, dashboardRows, makeStatsMessage, makeLeaderboard };
