require("../server");
require("dotenv").config();

const https = require("node:https");
const WebSocket = require("ws");
const {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType
} = require("discord.js");

const TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const GUILD_ID = (process.env.GUILD_ID || "").trim();

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing.");
  process.exit(1);
}
if (!GUILD_ID) {
  console.error("❌ GUILD_ID is missing.");
  process.exit(1);
}

console.log("🚀 Attendance Bot v2.0 Gateway Fix");
console.log(`🟢 Node.js: ${process.version}`);
console.log(`🟢 DISCORD_TOKEN: present (length=${TOKEN.length})`);
console.log(`🟢 GUILD_ID: present (length=${GUILD_ID.length})`);
console.log(`🟢 PORT: ${process.env.PORT || "3000"}`);
console.log("🧪 Running REST + raw WebSocket diagnostics before discord.js.");

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: 12000
    }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body
        });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("HTTPS request timed out"));
    });
    req.on("error", reject);

    if (options.body) req.write(options.body);
    req.end();
  });
}

async function testDiscordRest() {
  console.log("🌐 [1/3] Testing Discord REST /gateway ...");
  const gateway = await request("https://discord.com/api/v10/gateway");
  console.log(`🌐 REST /gateway status: ${gateway.statusCode}`);

  if (gateway.statusCode !== 200) {
    throw new Error(`Discord /gateway returned HTTP ${gateway.statusCode}: ${gateway.body.slice(0, 500)}`);
  }

  const json = JSON.parse(gateway.body);
  console.log(`✅ Discord Gateway URL: ${json.url}`);
}

async function testDiscordGatewayBot() {
  console.log("🔐 [2/3] Testing Discord REST /gateway/bot ...");
  const result = await request("https://discord.com/api/v10/gateway/bot", {
    headers: {
      "Authorization": `Bot ${TOKEN}`
    }
  });

  console.log(`🔐 REST /gateway/bot status: ${result.statusCode}`);

  if (result.statusCode !== 200) {
    const safeBody = result.body.slice(0, 500);
    throw new Error(`Discord /gateway/bot returned HTTP ${result.statusCode}: ${safeBody}`);
  }

  const json = JSON.parse(result.body);
  console.log(`✅ Gateway URL from authenticated endpoint: ${json.url}`);
  console.log(`✅ Recommended shards: ${json.shards}`);
  console.log(`✅ Session starts remaining: ${json.session_start_limit?.remaining}`);
  console.log(`✅ Session reset after: ${json.session_start_limit?.reset_after} ms`);

  return json;
}

function testRawWebSocket(url) {
  return new Promise((resolve, reject) => {
    console.log("🔌 [3/3] Opening raw Discord WebSocket...");
    const wsUrl = `${url}?v=10&encoding=json`;

    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      fn(value);
    };

    const socket = new WebSocket(wsUrl, {
      handshakeTimeout: 12000,
      perMessageDeflate: false
    });

    const timer = setTimeout(() => {
      finish(reject, new Error("Raw Discord WebSocket opening handshake timed out after 12 seconds."));
    }, 14000);

    socket.on("open", () => {
      console.log("✅ RAW WEBSOCKET OPENED");
    });

    socket.on("message", data => {
      try {
        const packet = JSON.parse(data.toString());

        if (packet.op === 10) {
          console.log(`✅ DISCORD HELLO RECEIVED (heartbeat interval=${packet.d?.heartbeat_interval}ms)`);
          finish(resolve, packet);
          return;
        }

        console.log(`ℹ️ RAW WS PACKET: op=${packet.op}, t=${packet.t || "none"}`);
      } catch (error) {
        console.error("⚠️ Could not parse raw WebSocket packet:", error.message);
      }
    });

    socket.on("error", error => {
      console.error("❌ RAW WEBSOCKET ERROR:", error.message);
      finish(reject, error);
    });

    socket.on("close", (code, reason) => {
      console.log(`🔌 RAW WEBSOCKET CLOSED: code=${code}, reason=${reason?.toString() || "none"}`);
    });
  });
}

async function runPreflight() {
  const gateway = await testDiscordGatewayBot();
  await testRawWebSocket(gateway.url);
  console.log("🎉 PRE-FLIGHT PASSED: Render can reach Discord Gateway.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ],
  ws: {
    version: 10
  },
  failIfNotExists: false
});

client.on(Events.Debug, message => {
  console.log(`[DISCORD DEBUG] ${message}`);
});

client.on(Events.Warn, message => {
  console.warn(`[DISCORD WARN] ${message}`);
});

client.on(Events.Error, error => {
  console.error("❌ DISCORD CLIENT ERROR:", error);
  console.error(error?.stack || "");
});

client.on(Events.ShardError, (error, shardId) => {
  console.error(`❌ SHARD ERROR shard=${shardId}:`, error);
  console.error(error?.stack || "");
});

client.on(Events.ShardDisconnect, (event, shardId) => {
  console.error(`🔌 SHARD DISCONNECT shard=${shardId}, code=${event?.code}, reason=${event?.reason || "none"}`);
});

client.on(Events.ShardReconnecting, shardId => {
  console.warn(`🔄 SHARD RECONNECTING shard=${shardId}`);
});

client.on(Events.ShardResume, (shardId, replayedEvents) => {
  console.log(`♻️ SHARD RESUMED shard=${shardId}, replayed=${replayedEvents}`);
});

client.once(Events.ClientReady, async ready => {
  console.log(`✅ DISCORD READY: ${ready.user.tag} (${ready.user.id})`);
  console.log(`🏠 Guild cache size: ${ready.guilds.cache.size}`);

  try {
    ready.user.setActivity("Staff Attendance", {
      type: ActivityType.Watching
    });
  } catch (error) {
    console.warn("⚠️ Activity update failed:", error.message);
  }

  try {
    const guild = await ready.guilds.fetch(GUILD_ID);
    console.log(`✅ TARGET GUILD: ${guild.name} (${guild.id})`);
  } catch (error) {
    console.error("❌ Could not fetch target guild:", error.message);
  }

  console.log("🎉 DISCORD LOGIN SUCCESSFUL — BOT IS ONLINE");
});

async function loginWithTimeout() {
  const timeoutMs = 30000;
  console.log(`🔐 Starting discord.js login (timeout ${timeoutMs / 1000}s)...`);

  const login = client.login(TOKEN);

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(
      "discord.js login timed out. Raw WebSocket pre-flight passed, so this points to the discord.js layer rather than Render outbound connectivity."
    )), timeoutMs);
  });

  return Promise.race([login, timeout]);
}

(async () => {
  try {
    await runPreflight();

    console.log("🚀 Starting the actual Discord.js client...");
    const userId = await loginWithTimeout();
    console.log(`🔑 discord.js login resolved for user ID: ${userId}`);

    if (!client.isReady()) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("Discord.js login resolved but READY was not emitted within 15 seconds."));
        }, 15000);

        if (client.isReady()) {
          clearTimeout(timer);
          resolve();
          return;
        }

        client.once(Events.ClientReady, () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    console.log("✅ STARTUP COMPLETE");
  } catch (error) {
    console.error("❌ STARTUP FAILED");
    console.error(error?.message || error);
    console.error(error?.stack || "");
    process.exit(1);
  }
})();

process.on("unhandledRejection", error => {
  console.error("❌ UNHANDLED REJECTION:", error);
  console.error(error?.stack || "");
});

process.on("uncaughtException", error => {
  console.error("❌ UNCAUGHT EXCEPTION:", error);
  console.error(error?.stack || "");
});
