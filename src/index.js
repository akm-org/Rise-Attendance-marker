require("../server");
const fs = require("node:fs");
const path = require("node:path");

// Lightweight .env loader so local PC testing does not depend on dotenv.
try {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 1) continue;
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch (e) {
  console.warn("⚠️ Could not read .env:", e.message);
}

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  ActivityType
} = require("discord.js");

const { commands, execute, handleButton } = require("./commands");
const { getConfig, getAttendance, saveAttendance, ensureMember } = require("./database");
const { handlePresence, updateLiveStatus } = require("./attendance");

const TOKEN = String(process.env.DISCORD_TOKEN || "").trim();
const GUILD_ID = String(process.env.GUILD_ID || "").trim();

console.log("🚀 Discord Attendance Bot v2.6");
console.log(`🟢 Node.js: ${process.version}`);
console.log("🟢 Discord library: discord.js 14.27.x");
console.log(`🟢 Token present: ${TOKEN ? "true" : "false"} (length=${TOKEN.length})`);
console.log(`🟢 Guild ID present: ${GUILD_ID ? "true" : "false"} (length=${GUILD_ID.length})`);
console.log(`🌐 PORT: ${process.env.PORT || "3000"}`);
console.log("🔌 Discord connection: same standard client.login() pattern as AFK-RISE + safe Gateway diagnostics");
console.log("🚫 No /gateway/bot preflight");
console.log("🚫 No /gateway preflight");
console.log("🚫 No custom WebSocket test");
console.log("🚫 No token debug output");

if (!TOKEN || !GUILD_ID) {
  console.error("❌ DISCORD_TOKEN and GUILD_ID are required.");
  process.exit(1);
}

// Keep the Discord client construction deliberately close to the known-working
// AFK-RISE mechanism. Attendance requires GuildMembers + GuildPresences.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Channel]
});

let ready = false;

client.once(Events.ClientReady, async () => {
  ready = true;
  console.log(`✅ Logged in as ${client.user.tag} (${client.user.id})`);

  try {
    client.user.setActivity("Staff Attendance", { type: ActivityType.Watching });
  } catch {}

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    console.log(`✅ Target guild found: ${guild.name} (${guild.id})`);
    await registerCommands();
    await updateLiveStatus(guild).catch(e => console.warn("⚠️ Initial dashboard update skipped:", e.message));
    console.log("🎉 ATTENDANCE BOT IS ONLINE AND READY");
    console.log("ℹ️ Staff start attendance with 🟢 Mark Online.");
    console.log("ℹ️ Discord offline automatically closes an active session.");
    console.log("ℹ️ Nicknames are never changed.");
  } catch (e) {
    console.error("❌ READY INITIALIZATION ERROR:", e?.stack || e);
  }
});

client.on(Events.Warn, message => console.warn(`[DISCORD WARN] ${message}`));
client.on(Events.Error, error => console.error("❌ DISCORD CLIENT ERROR:", error?.stack || error));
client.on(Events.Invalidated, () => {
  ready = false;
  console.error("❌ DISCORD SESSION INVALIDATED");
});
client.on(Events.ShardReady, (id, unavailable) => console.log(`✅ SHARD READY: ${id}; unavailable=${unavailable?.size ?? 0}`));
client.on(Events.ShardReconnecting, id => { ready = false; console.warn(`🔄 SHARD RECONNECTING: ${id}`); });
client.on(Events.ShardResume, (id, replayed) => { ready = true; console.log(`♻️ SHARD RESUMED: ${id}; replayed=${replayed}`); });
client.on(Events.ShardDisconnect, (event, id) => {
  ready = false;
  console.error(`🔌 SHARD DISCONNECTED: shard=${id}, code=${event?.code ?? "unknown"}, reason=${event?.reason || "none"}`);
});
client.on(Events.ShardError, (error, id) => console.error(`❌ SHARD ERROR: shard=${id}`, error?.stack || error));

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands.map(command => command.toJSON()) }
  );
  console.log(`✅ Registered ${commands.length} /attendance commands.`);
}

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }
    if (!interaction.isChatInputCommand() || interaction.commandName !== "attendance") return;
    await interaction.deferReply();
    await execute(interaction);
  } catch (error) {
    console.error("[INTERACTION ERROR]", error?.stack || error);
    try {
      const message = `❌ Interaction error: ${error.message || "Unknown error"}`;
      if (interaction.deferred) await interaction.editReply({ content: message });
      else if (interaction.replied) await interaction.followUp({ content: message, flags: 64 });
      else await interaction.reply({ content: message, flags: 64 });
    } catch {}
  }
});

client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
  try {
    const member = newPresence?.member || oldPresence?.member;
    if (!member) return;
    const config = getConfig();
    if (!config.roleId || !member.roles.cache.has(config.roleId)) return;

    const oldStatus = oldPresence?.status ?? "offline";
    const newStatus = newPresence?.status ?? "offline";
    const wasOnline = ["online", "idle", "dnd"].includes(oldStatus);
    const nowOnline = ["online", "idle", "dnd"].includes(newStatus);
    if (wasOnline === nowOnline || nowOnline) return;

    await handlePresence(member, "offline", true, "Discord presence changed to offline");
  } catch (e) {
    console.error("[PRESENCE ERROR]", e?.stack || e);
  }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    const config = getConfig();
    if (!config.roleId) return;
    const had = oldMember.roles.cache.has(config.roleId);
    const has = newMember.roles.cache.has(config.roleId);

    if (!had && has) {
      console.log(`[ROLE] ${newMember.user.username} received attendance role; waiting for Mark Online.`);
    }

    if (had && !has) {
      const data = getAttendance();
      const record = ensureMember(data, newMember.id);
      if (!record.activeSince) return;

      const start = record.activeSince;
      const end = Date.now();
      const seconds = Math.max(0, (end - start) / 1000);
      record.sessions.push({ start, end });
      record.totalSeconds += seconds;
      record.activeSince = null;
      saveAttendance(data);
      console.log(`[ROLE] ${newMember.user.username} lost attendance role; active session closed.`);
      await updateLiveStatus(newMember.guild).catch(() => {});
    }
  } catch (e) {
    console.error("[MEMBER UPDATE ERROR]", e?.stack || e);
  }
});

process.on("unhandledRejection", error => console.error("❌ UNHANDLED REJECTION:", error?.stack || error));
process.on("uncaughtException", error => console.error("❌ UNCAUGHT EXCEPTION:", error?.stack || error));

// Same login pattern as the working AFK-RISE application: no custom timeout,
// no REST Gateway discovery and no manual WebSocket connection.
async function startDiscord() {
  try {
    console.log("🔌 Connecting to Discord Gateway...");
    await client.login(TOKEN);
    console.log("✅ Discord login promise resolved.");
  } catch (error) {
    console.error("❌ Discord login failed:", error?.stack || error);
    process.exit(1);
  }
}

// Keep Render's web service alive and expose a useful health response.
setInterval(() => {
  console.log(`[HEALTH] Discord=${ready ? "READY" : "CONNECTING/DISCONNECTED"}; guild=${GUILD_ID}`);
}, 60000).unref();

startDiscord();
