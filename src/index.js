require("../server");
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
        console.error(`Missing ${key} in environment variables`);
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

    const config = getConfig();

    if (!config.roleId) {
        console.log("⚠️ No attendance role configured. Use /attendance role.");
        return;
    }

    await updateLiveStatus(guild);

    console.log("✅ Attendance database synchronized.");
    console.log("✅ Live staff status synchronized.");
    console.log("ℹ️ Nicknames are completely disabled.");
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
                await interaction.reply({ ...response, flags: 64 });
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
        if (!config.roleId) return;
        if (!member.roles.cache.has(config.roleId)) return;

        const oldStatus = oldPresence?.status ?? "offline";
        const newStatus = newPresence?.status ?? "offline";

        const oldOnline = ["online", "idle", "dnd"].includes(oldStatus);
        const newOnline = ["online", "idle", "dnd"].includes(newStatus);

        if (oldOnline === newOnline || newOnline) return;

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

        if (!hadRole && hasRole) {
            console.log(`[ROLE] ${newMember.user.username} received attendance role; waiting for manual Mark Online.`);
            return;
        }

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
        }
    } catch (error) {
        console.error("[MEMBER UPDATE ERROR]", error);
    }
});

process.on("unhandledRejection", error => console.error("Unhandled rejection:", error));
process.on("uncaughtException", error => console.error("Uncaught exception:", error));

(async () => {
    await registerCommands();
    await client.login(process.env.DISCORD_TOKEN);
})();
