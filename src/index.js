require("../server");
require("dotenv").config();

const {Client,GatewayIntentBits,Events,REST,Routes,ActivityType}=require("discord.js");
const {commands,execute,handleButton}=require("./commands");
const {getConfig,getAttendance,saveAttendance,ensureMember}=require("./database");
const {handlePresence,updateLiveStatus}=require("./attendance");

const TOKEN=(process.env.DISCORD_TOKEN||"").trim();
const GUILD_ID=(process.env.GUILD_ID||"").trim();

console.log("🚀 Discord Attendance Bot v2.4 — AFK-RISE Gateway Mechanism");
console.log(`🟢 Node.js: ${process.version}`);
console.log("🟢 Discord library: discord.js 14.27.0");
console.log(`🟢 Token present: ${TOKEN?"true":"false"} (length=${TOKEN.length})`);
console.log(`🟢 Guild ID present: ${GUILD_ID?"true":"false"} (length=${GUILD_ID.length})`);
console.log(`🌐 PORT: ${process.env.PORT||"3000"}`);
console.log("🔌 Gateway mode: standard discord.js client.login()");
console.log("✅ No /gateway/bot request");
console.log("✅ No /gateway preflight");
console.log("✅ No custom Gateway WebSocket test");
console.log("✅ No startup retry loop");
console.log("✅ Discord debug-token logging disabled");

if(!TOKEN||!GUILD_ID){console.error("❌ DISCORD_TOKEN and GUILD_ID are required.");process.exit(1);}

const client=new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildPresences],
  failIfNotExists:false,
  ws:{version:10}
});

client.on(Events.Warn,m=>console.warn(`[DISCORD WARN] ${m}`));
client.on(Events.Error,e=>console.error("❌ DISCORD CLIENT ERROR:",e?.stack||e));
client.on(Events.Invalidated,()=>console.error("❌ DISCORD SESSION INVALIDATED"));
client.on(Events.ShardReady,(id,unavailable)=>console.log(`✅ SHARD READY: ${id}; unavailable=${unavailable?.size??0}`));
client.on(Events.ShardReconnecting,id=>console.warn(`🔄 SHARD RECONNECTING: ${id}`));
client.on(Events.ShardResume,(id,replayed)=>console.log(`♻️ SHARD RESUMED: ${id}; replayed=${replayed}`));
client.on(Events.ShardDisconnect,(event,id)=>console.error(`🔌 SHARD DISCONNECTED: shard=${id}, code=${event?.code??"unknown"}, reason=${event?.reason||"none"}`));
client.on(Events.ShardError,(e,id)=>console.error(`❌ SHARD ERROR: shard=${id}`,e?.stack||e));

async function registerCommands(){
  const rest=new REST({version:"10"}).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id,GUILD_ID),{body:commands.map(c=>c.toJSON())});
  console.log(`✅ Registered ${commands.length} /attendance commands.`);
}

client.once(Events.ClientReady,async ready=>{
  console.log(`✅ DISCORD READY: ${ready.user.tag} (${ready.user.id})`);
  try{ready.user.setActivity("Staff Attendance",{type:ActivityType.Watching});}catch{}
  try{
    const guild=await client.guilds.fetch(GUILD_ID);
    console.log(`✅ TARGET GUILD FOUND: ${guild.name} (${guild.id})`);
    await registerCommands();
    await updateLiveStatus(guild).catch(e=>console.warn("⚠️ Initial dashboard update skipped:",e.message));
    console.log("🎉 BOT IS ONLINE AND READY");
    console.log("ℹ️ Manual attendance: 🟢 Mark Online. Discord offline ends active sessions.");
    console.log("ℹ️ Nicknames are disabled — no nickname changes are performed.");
  }catch(e){console.error("❌ READY INITIALIZATION ERROR:",e?.stack||e);}
});

client.on(Events.InteractionCreate,async interaction=>{
  try{
    console.log(`[INTERACTION] ${interaction.type} ${interaction.isButton()?interaction.customId:interaction.isChatInputCommand()?interaction.commandName:"other"}`);
    if(interaction.isButton()){await handleButton(interaction);return;}
    if(!interaction.isChatInputCommand()||interaction.commandName!=="attendance")return;
    await interaction.deferReply();
    await execute(interaction);
  }catch(error){
    console.error("[INTERACTION ERROR]",error?.stack||error);
    try{
      const msg=`❌ Interaction error: ${error.message||"Unknown error"}`;
      if(interaction.deferred)await interaction.editReply({content:msg});
      else if(interaction.replied)await interaction.followUp({content:msg,flags:64});
      else await interaction.reply({content:msg,flags:64});
    }catch{}
  }
});

client.on(Events.PresenceUpdate,async(oldPresence,newPresence)=>{
  try{
    const member=newPresence?.member||oldPresence?.member;
    if(!member)return;
    const config=getConfig();
    if(!config.roleId||!member.roles.cache.has(config.roleId))return;
    const oldStatus=oldPresence?.status??"offline",newStatus=newPresence?.status??"offline";
    const wasOnline=["online","idle","dnd"].includes(oldStatus),nowOnline=["online","idle","dnd"].includes(newStatus);
    if(wasOnline===nowOnline||nowOnline)return;
    await handlePresence(member,"offline",true,"Discord presence changed to offline");
  }catch(e){console.error("[PRESENCE ERROR]",e?.stack||e);}
});

client.on(Events.GuildMemberUpdate,async(oldMember,newMember)=>{
  try{
    const config=getConfig();
    if(!config.roleId)return;
    const had=oldMember.roles.cache.has(config.roleId),has=newMember.roles.cache.has(config.roleId);
    if(!had&&has)console.log(`[ROLE] ${newMember.user.username} received attendance role; waiting for manual Mark Online.`);
    if(had&&!has){
      const data=getAttendance(),record=ensureMember(data,newMember.id);
      if(record.activeSince){
        const start=record.activeSince,end=Date.now(),seconds=Math.max(0,(end-start)/1000);
        record.sessions.push({start,end});record.totalSeconds+=seconds;record.activeSince=null;saveAttendance(data);
        console.log(`[ROLE] ${newMember.user.username} lost attendance role; active session closed.`);
        await updateLiveStatus(newMember.guild).catch(()=>{});
      }
    }
  }catch(e){console.error("[MEMBER UPDATE ERROR]",e?.stack||e);}
});

process.on("unhandledRejection",e=>console.error("❌ UNHANDLED REJECTION:",e?.stack||e));
process.on("uncaughtException",e=>console.error("❌ UNCAUGHT EXCEPTION:",e?.stack||e));

(async()=>{
  try{console.log("🔌 Connecting to Discord Gateway...");await client.login(TOKEN);console.log("✅ client.login() resolved.");}
  catch(e){console.error("❌ Discord login failed:",e?.stack||e);process.exit(1);}
})();
