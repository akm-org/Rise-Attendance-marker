require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    ActivityType
} = require("discord.js");

const { commands, execute, handleButton } = require("./commands");
const {
    getConfig,
    getAttendance,
    saveAttendance,
    ensureMember
} = require("./database");
const { handlePresence, updateLiveStatus } = require("./attendance");

for (const key of ["DISCORD_TOKEN", "CLIENT_ID", "GUILD_ID"]) {
    if (!process.env[key]) {
        console.error(`Missing ${key} in .env`);
        process.exit(1);
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(
        Routes.applicationGuildCommands(
            process.env.CLIENT_ID,
            process.env.GUILD_ID
        ),
        { body: commands.map(command => command.toJSON()) }
    );

    console.log("✅ Slash commands registered.");
}

function isOnline(member) {
    const status = member.presence?.status;
    return status === "online" || status === "idle" || status === "dnd";
}

client.once(Events.ClientReady, async ready => {
    console.log(`✅ Logged in as ${ready.user.tag}`);

    ready.user.setActivity("Staff Attendance", {
        type: ActivityType.Watching
    });

    const guild = await ready.guilds.fetch(process.env.GUILD_ID).catch(() => null);

    if (!guild) {
        console.error("❌ Guild not found. Check GUILD_ID.");
        return;
    }

    // IMPORTANT: do NOT call guild.members.fetch() without a user ID.
    // That requests the whole guild member list and can hit Discord opcode-8 rate limits.
    const config = getConfig();

    if (!config.roleId) {
        console.log("⚠️ No attendance role configured. Use /attendance role.");
        return;
    }

    await updateLiveStatus(guild);

    console.log("✅ Attendance database synchronized.");
    console.log("✅ Live staff status synchronized.");
    console.log("ℹ️ Nicknames are completely disabled for attendance.");
});

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isButton()) {
            await handleButton(interaction);
            return;
        }

        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== "attendance") return;

        await interaction.deferReply({ ephemeral: false });
        await execute(interaction);

    } catch (error) {
        console.error("[INTERACTION ERROR]", error);

        const response = {
            content: "❌ An error occurred while processing that interaction."
        };

        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(response);
            } else {
                await interaction.reply({
                    ...response,
                    flags: 64
                });
            }
        } catch (replyError) {
            console.error("[INTERACTION RESPONSE ERROR]", replyError);
        }
    }
});

client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
    try {
        const member = newPresence?.member || oldPresence?.member;
        if (!member) return;

        const config = getConfig();

        // Only the configured attendance role determines eligibility.
        // Other roles do not matter.
        if (!config.roleId) return;
        if (!member.roles.cache.has(config.roleId)) return;

        const oldStatus = oldPresence?.status ?? "offline";
        const newStatus = newPresence?.status ?? "offline";

        const oldOnline = ["online", "idle", "dnd"].includes(oldStatus);
        const newOnline = ["online", "idle", "dnd"].includes(newStatus);

        // Attendance is manually started with the Mark Online button.
        // Presence is only used to automatically close an active attendance
        // session when the staff member actually goes offline.
        if (oldOnline === newOnline || newOnline) return;

        console.log(
            `[PRESENCE] ${member.user.username}: ${oldStatus} -> ${newStatus} (auto offline check)`
        );

        await handlePresence(member, "offline", true);
        await updateLiveStatus(member.guild);

    } catch (error) {
        console.error("[PRESENCE ERROR]", error);
    }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
        const config = getConfig();
        if (!config.roleId) return;

        const hadRole = oldMember.roles.cache.has(config.roleId);
        const hasRole = newMember.roles.cache.has(config.roleId);

        // Assigning the attendance role NEVER starts attendance.
        // Staff must click Mark Online in the attendance panel.
        if (!hadRole && hasRole) {
            console.log(`[ROLE] ${newMember.user.username} received attendance role; waiting for manual Mark Online.`);
            return;
        }

        // If the attendance role is removed, close any active session safely.
        if (hadRole && !hasRole) {
            const data = getAttendance();
            const record = ensureMember(data, newMember.id);

            if (record.activeSince) {
                const start = record.activeSince;
                const end = Date.now();
                const seconds = Math.max(0, (end - start) / 1000);
                record.sessions.push({ start, end });
                record.totalSeconds += seconds;
                record.activeSince = null;
                saveAttendance(data);
            }

            console.log(`[ROLE] ${newMember.user.username} removed from attendance role; active session closed if one existed.`);
        }
    } catch (error) {
        console.error("[MEMBER UPDATE ERROR]", error);
    }
});

process.on("unhandledRejection", error =>
    console.error("Unhandled rejection:", error)
);

process.on("uncaughtException", error =>
    console.error("Uncaught exception:", error)
);

(async () => {
    await registerCommands();
    await client.login(process.env.DISCORD_TOKEN);
})();
