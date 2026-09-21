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
const WebSocket = require("ws");
const { HttpsProxyAgent } = require("https-proxy-agent");

const { commands, execute, handleButton } = require("./commands");
const { getConfig, getAttendance, saveAttendance, ensureMember } = require("./database");
const { handlePresence, updateLiveStatus } = require("./attendance");

const TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const GUILD_ID = (process.env.GUILD_ID || "").trim();
const PROXY = (process.env.DISCORD_PROXY || "").trim();

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing.");
  process.exit(1);
}
if (!GUILD_ID) {
  console.error("❌ GUILD_ID is missing.");
  process.exit(1);
}

console.log(`🚀 Discord Attendance Bot v2.2`);
console.log(`🟢 Node.js: ${process.version}`);
console.log(`🟢 discord.js: 14.25.1`);
console.log(`🟢 Token present: true (length=${TOKEN.length})`);
console.log(`🟢 Guild ID present: true (length=${GUILD_ID.length})`);
console.log(`🌐 PORT: ${process.env.PORT || "3000"}`);
console.log(`🌐 Discord proxy: ${PROXY ? "configured" : "not configured"}`);
console.log("🛑 No /gateway/bot REST call. This avoids the previous 429/1015 trigger.");

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const https = require("node:https");
    const req = https.get(url, { headers, timeout: 15000 }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", d => body += d);
      res.on("end", () => resolve({
        status: res.statusCode || 0,
        headers: res.headers,
        body
      }));
    });
    req.on("timeout", () => req.destroy(new Error("HTTPS request timed out")));
    req.on("error", reject);
  });
}

async function getPublicGatewayUrl() {
  console.log("🌐 Testing Discord public /gateway endpoint...");
  const result = await httpsGet("https://discord.com/api/v10/gateway");
  console.log(`🌐 /gateway HTTP status: ${result.status}`);

  if (result.status !== 200) {
    throw new Error(`Discord public /gateway returned HTTP ${result.status}: ${result.body.slice(0, 300)}`);
  }

  const json = JSON.parse(result.body);
  if (!json.url) throw new Error("Discord /gateway response did not contain a Gateway URL.");

  console.log(`✅ Gateway URL received: ${json.url}`);
  return json.url;
}

function rawGatewayTest(gatewayUrl) {
  return new Promise((resolve, reject) => {
    const wsUrl = `${gatewayUrl}?v=10&encoding=json`;
    const options = {
      handshakeTimeout: 15000,
      perMessageDeflate: false
    };

    if (PROXY) {
      options.agent = new HttpsProxyAgent(PROXY);
      console.log("🔀 Raw WebSocket is using DISCORD_PROXY.");
    }

    console.log("🔌 Opening raw Discord Gateway WebSocket...");
    console.log("⏱️ Raw WebSocket timeout: 15 seconds");

    let finished = false;
    const finish = (fn, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      fn(value);
    };

    const socket = new WebSocket(wsUrl, options);

    const timer = setTimeout(() => {
      finish(reject, new Error(
        "RAW_GATEWAY_TIMEOUT: Render could not complete the Discord WebSocket handshake within 15 seconds."
      ));
    }, 16000);

    socket.on("open", () => {
      console.log("✅ RAW DISCORD WEBSOCKET OPEN");
    });

    socket.on("message", data => {
      try {
        const packet = JSON.parse(data.toString());

        if (packet.op === 10) {
          console.log(`✅ DISCORD HELLO RECEIVED. Heartbeat interval: ${packet.d?.heartbeat_interval}ms`);
          finish(resolve, true);
          return;
        }

        console.log(`[RAW GATEWAY] opcode=${packet.op} event=${packet.t || "none"}`);
      } catch (e) {
        console.warn("⚠️ Invalid Gateway packet:", e.message);
      }
    });

    socket.on("unexpected-response", (request, response) => {
      console.error(`❌ RAW GATEWAY HTTP RESPONSE: ${response.statusCode} ${response.statusMessage || ""}`);

      if (response.statusCode === 429) {
        console.error("🚨 Discord/Cloudflare rate-limited the Render outbound connection.");
      }

      finish(reject, new Error(
        `RAW_GATEWAY_HTTP_${response.statusCode}: ${response.statusMessage || "WebSocket upgrade rejected"}`
      ));
    });

    socket.on("error", error => {
      console.error(`❌ RAW GATEWAY SOCKET ERROR: ${error.message}`);
      finish(reject, error);
    });

    socket.on("close", (code, reason) => {
      console.log(`🔌 RAW GATEWAY CLOSED: code=${code}, reason=${reason?.toString() || "none"}`);
    });
  });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ],
  failIfNotExists: false,
  ws: {
    version: 10,
    ...(PROXY ? { agent: new HttpsProxyAgent(PROXY) } : {})
  }
});

client.on(Events.Debug, m => console.log(`[DISCORD DEBUG] ${m}`));
client.on(Events.Warn, m => console.warn(`[DISCORD WARN] ${m}`));
client.on(Events.Error, e => console.error("❌ DISCORD CLIENT ERROR:", e?.stack || e));
client.on(Events.Invalidated, () => console.error("❌ DISCORD SESSION INVALIDATED"));
client.on(Events.ShardReady, (id, ug) => console.log(`✅ SHARD READY: ${id}; unavailable=${ug?.size ?? 0}`));
client.on(Events.ShardReconnecting, id => console.warn(`🔄 SHARD RECONNECTING: ${id}`));
client.on(Events.ShardResume, (id, r) => console.log(`♻️ SHARD RESUMED: ${id}; replayed=${r}`));
client.on(Events.ShardDisconnect, (event, id) => console.error(`🔌 SHARD DISCONNECTED: shard=${id}, code=${event?.code ?? "unknown"}, reason=${event?.reason || "none"}`));
client.on(Events.ShardError, (e, id) => console.error(`❌ SHARD ERROR: shard=${id}`, e?.stack || e));

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log(`✅ Registered ${commands.length} /attendance commands.`);
}

client.once(Events.ClientReady, async ready => {
  console.log(`✅ DISCORD READY: ${ready.user.tag} (${ready.user.id})`);
  ready.user.setActivity("Staff Attendance", { type: ActivityType.Watching });

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    console.log(`✅ TARGET GUILD FOUND: ${guild.name} (${guild.id})`);
    await registerCommands();
    await updateLiveStatus(guild).catch(e => console.warn("⚠️ Initial dashboard update skipped:", e.message));
    console.log("🎉 BOT IS ONLINE AND READY");
    console.log("ℹ️ Manual attendance: 🟢 Mark Online. Discord offline ends active sessions.");
    console.log("ℹ️ Nicknames are disabled.");
  } catch (e) {
    console.error("❌ READY INITIALIZATION ERROR:", e?.stack || e);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    console.log(`[INTERACTION] ${interaction.type} ${interaction.isButton() ? interaction.customId : interaction.isChatInputCommand() ? interaction.commandName : "other"} by ${interaction.user?.tag || interaction.user?.id || "unknown"}`);

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
      const msg = `❌ Interaction error: ${error.message || "Unknown error"}`;
      if (interaction.deferred) await interaction.editReply({ content: msg });
      else if (interaction.replied) await interaction.followUp({ content: msg, flags: 64 });
      else await interaction.reply({ content: msg, flags: 64 });
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
      console.log(`[ROLE] ${newMember.user.username} received attendance role; waiting for manual Mark Online.`);
    }

    if (had && !has) {
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

        console.log(`[ROLE] ${newMember.user.username} lost attendance role; active session closed.`);
        await updateLiveStatus(newMember.guild).catch(() => {});
      }
    }
  } catch (e) {
    console.error("[MEMBER UPDATE ERROR]", e?.stack || e);
  }
});

process.on("unhandledRejection", e => console.error("❌ UNHANDLED REJECTION:", e?.stack || e));
process.on("uncaughtException", e => console.error("❌ UNCAUGHT EXCEPTION:", e?.stack || e));

async function start() {
  try {
    const gatewayUrl = await getPublicGatewayUrl();

    try {
      await rawGatewayTest(gatewayUrl);
      console.log("🎉 RAW GATEWAY TEST PASSED.");
      console.log("➡️ Render can reach the Discord Gateway.");
    } catch (e) {
      console.error("❌ RAW GATEWAY TEST FAILED:", e.message);

      if (String(e.message).includes("1015") || String(e.message).includes("429")) {
        console.error("🚨 The Render outbound IP is being rate-limited by Discord/Cloudflare.");
        console.error("🚨 Do NOT keep restarting rapidly; that can prolong the rate limit.");
        console.error("🚨 Set DISCORD_PROXY to a stable outbound proxy or run the bot on a VPS.");
      }

      process.exit(1);
    }

    console.log("🔌 Starting discord.js Gateway...");
    await Promise.race([
      client.login(TOKEN),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("discord.js Gateway login timed out after 45 seconds")), 45000)
      )
    ]);

    console.log("✅ client.login() resolved.");
  } catch (e) {
    console.error("❌ STARTUP FAILED:", e?.stack || e);
    process.exit(1);
  }
}

start();
