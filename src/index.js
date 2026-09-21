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

const LOGIN_TIMEOUT_MS = 20000;

for (const key of ["DISCORD_TOKEN", "GUILD_ID"]) {
  if (!process.env[key] || !process.env[key].trim()) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const token = process.env.DISCORD_TOKEN.trim();
const guildId = process.env.GUILD_ID.trim();

console.log("🚀 Attendance bot v20 Gateway diagnostic starting...");
console.log(`🔐 DISCORD_TOKEN present: true (length=${token.length})`);
console.log(`🏠 GUILD_ID present: true (length=${guildId.length})`);
console.log(`🌐 PORT: ${process.env.PORT || "3000"}`);
console.log("🧪 Diagnostic mode: Guilds intent ONLY");
console.log("⏱️ Discord login timeout: 20 seconds");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Gateway diagnostics
client.on(Events.Debug, message => {
  console.log(`[DISCORD DEBUG] ${message}`);
});

client.on(Events.Warn, message => {
  console.warn(`[DISCORD WARN] ${message}`);
});

client.on(Events.Error, error => {
  console.error("❌ DISCORD CLIENT ERROR:", error);
  console.error(error?.stack || error);
});

client.on(Events.Invalidated, () => {
  console.error("❌ DISCORD SESSION INVALIDATED");
});

client.on(Events.ShardReady, (id, unavailableGuilds) => {
  console.log(`✅ SHARD READY: shard=${id}, unavailableGuilds=${unavailableGuilds?.size ?? 0}`);
});

client.on(Events.ShardReconnecting, id => {
  console.warn(`🔄 SHARD RECONNECTING: shard=${id}`);
});

client.on(Events.ShardResume, (id, replayedEvents) => {
  console.log(`♻️ SHARD RESUMED: shard=${id}, replayedEvents=${replayedEvents}`);
});

client.on(Events.ShardDisconnect, (event, id) => {
  console.error(
    `🔌 SHARD DISCONNECTED: shard=${id}, code=${event?.code ?? "unknown"}, reason=${event?.reason || "unknown"}`
  );
});

client.on(Events.ShardError, (error, id) => {
  console.error(`❌ SHARD ERROR: shard=${id}`);
  console.error(error?.stack || error);
});

client.once(Events.ClientReady, async ready => {
  console.log(`✅ DISCORD READY: ${ready.user.tag} (${ready.user.id})`);
  console.log(`🏠 Cached guild count: ${ready.guilds.cache.size}`);

  try {
    ready.user.setActivity("Staff Attendance", {
      type: ActivityType.Watching
    });
  } catch (error) {
    console.warn("⚠️ Could not set bot activity:", error.message);
  }

  try {
    const guild = await ready.guilds.fetch(guildId);
    console.log(`✅ TARGET GUILD FOUND: ${guild.name} (${guild.id})`);
  } catch (error) {
    console.error("❌ TARGET GUILD FETCH FAILED");
    console.error(error?.message || error);
  }

  console.log("🎉 GATEWAY TEST PASSED");
  console.log("ℹ️ This v20 build intentionally uses Guilds intent only.");
  console.log("ℹ️ Once Gateway works, the full attendance intents/features can be restored.");
});

async function loginWithTimeout() {
  console.log("🔌 Calling client.login()...");

  const loginPromise = client.login(token);

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(
        `Discord client.login() did not resolve within ${LOGIN_TIMEOUT_MS / 1000} seconds. ` +
        "The process is hanging before Discord READY."
      ));
    }, LOGIN_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([loginPromise, timeoutPromise]);
    console.log("🔑 client.login() resolved.");
    console.log(`🔑 Logged-in bot user id: ${result}`);
    return result;
  } catch (error) {
    console.error("❌ LOGIN FAILED / TIMED OUT");
    console.error(error?.message || error);
    console.error(error?.stack || "");
    throw error;
  }
}

(async () => {
  try {
    await loginWithTimeout();

    if (!client.isReady()) {
      console.log("⏳ login() resolved but READY has not fired yet. Waiting up to 10 seconds...");

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("READY event did not fire within 10 seconds after client.login() resolved."));
        }, 10000);

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

    console.log("🎉 BOT STARTUP COMPLETE");
  } catch (error) {
    console.error("❌ STARTUP DIAGNOSTIC FAILED");
    console.error(error?.stack || error);
    process.exit(1);
  }
})();

process.on("unhandledRejection", error => {
  console.error("❌ UNHANDLED REJECTION:", error);
  console.error(error?.stack || error);
});

process.on("uncaughtException", error => {
  console.error("❌ UNCAUGHT EXCEPTION:", error);
  console.error(error?.stack || error);
});
