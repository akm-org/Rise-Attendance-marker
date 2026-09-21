require("../server");
require("dotenv").config();

const {Client,GatewayIntentBits,Events,REST,Routes,ActivityType}=require("discord.js");
const {commands,execute,handleButton}=require("./commands");
const {getConfig,getAttendance,saveAttendance,ensureMember}=require("./database");
const {handlePresence,updateLiveStatus}=require("./attendance");

const TOKEN=(process.env.DISCORD_TOKEN||"").trim();
const GUILD_ID=(process.env.GUILD_ID||"").trim();
if(!TOKEN){console.error("❌ DISCORD_TOKEN is missing.");process.exit(1);}
if(!GUILD_ID){console.error("❌ GUILD_ID is missing.");process.exit(1);}

console.log(`🚀 Discord Attendance Bot v2.1 starting on Node ${process.version}`);
console.log(`🔐 DISCORD_TOKEN present: true (length=${TOKEN.length})`);
console.log(`🏠 GUILD_ID present: true (length=${GUILD_ID.length})`);
console.log(`🌐 PORT: ${process.env.PORT||"3000"}`);
console.log("✅ Removed /gateway/bot preflight to prevent 429/1015.");
console.log("✅ Direct discord.js Gateway connection.");

const client=new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildPresences],
  failIfNotExists:false
});

client.on(Events.Debug,m=>console.log(`[DISCORD DEBUG] ${m}`));
client.on(Events.Warn,m=>console.warn(`[DISCORD WARN] ${m}`));
client.on(Events.Error,e=>console.error("❌ DISCORD CLIENT ERROR:",e?.stack||e));
client.on(Events.Invalidated,()=>console.error("❌ DISCORD SESSION INVALIDATED"));
client.on(Events.ShardReady,(id,ug)=>console.log(`✅ SHARD READY: ${id}; unavailable=${ug?.size??0}`));
client.on(Events.ShardReconnecting,id=>console.warn(`🔄 SHARD RECONNECTING: ${id}`));
client.on(Events.ShardResume,(id,r)=>console.log(`♻️ SHARD RESUMED: ${id}; replayed=${r}`));
client.on(Events.ShardDisconnect,(event,id)=>console.error(`🔌 SHARD DISCONNECTED: shard=${id}, code=${event?.code??"unknown"}, reason=${event?.reason||"none"}`));
client.on(Events.ShardError,(e,id)=>console.error(`❌ SHARD ERROR: shard=${id}`,e?.stack||e));

async function registerCommands(){
  const rest=new REST({version:"10"}).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id,GUILD_ID),{body:commands.map(c=>c.toJSON())});
  console.log(`✅ Registered ${commands.length} /attendance commands.`);
}

client.once(Events.ClientReady,async ready=>{
  console.log(`✅ DISCORD READY: ${ready.user.tag} (${ready.user.id})`);
  ready.user.setActivity("Staff Attendance",{type:ActivityType.Watching});
  try{
    const guild=await client.guilds.fetch(GUILD_ID);
    console.log(`✅ TARGET GUILD FOUND: ${guild.name} (${guild.id})`);
    console.log(`👥 Guild member count: ${guild.memberCount??"unknown"}`);
    await registerCommands();
    await updateLiveStatus(guild).catch(e=>console.warn("⚠️ Initial dashboard update skipped:",e.message));
    console.log("🎉 BOT IS ONLINE AND READY");
    console.log("ℹ️ Staff click 🟢 Mark Online to start attendance; Discord offline ends active sessions.");
    console.log("ℹ️ Nickname changes are disabled.");
  }catch(e){console.error("❌ READY INITIALIZATION ERROR:",e?.stack||e);}
});

client.on(Events.InteractionCreate,async interaction=>{
  const started=Date.now();
  try{
    console.log(`[INTERACTION] ${interaction.type} ${interaction.isButton()?interaction.customId:interaction.isChatInputCommand()?interaction.commandName:"other"} by ${interaction.user?.tag||interaction.user?.id||"unknown"}`);
    if(interaction.isButton()){await handleButton(interaction);return;}
    if(!interaction.isChatInputCommand()||interaction.commandName!=="attendance")return;
    await interaction.deferReply();
    await execute(interaction);
    console.log(`[INTERACTION] /attendance completed in ${Date.now()-started}ms`);
  }catch(e){
    console.error("[INTERACTION ERROR]",e?.stack||e);
    try{
      const msg=`❌ Interaction error: ${e.message||"Unknown error"}`;
      if(interaction.deferred)await interaction.editReply({content:msg});
      else if(interaction.replied)await interaction.followUp({content:msg,flags:64});
      else await interaction.reply({content:msg,flags:64});
    }catch(x){console.error("[INTERACTION RESPONSE ERROR]",x?.stack||x);}
  }
});

client.on(Events.PresenceUpdate,async(oldPresence,newPresence)=>{
  try{
    const member=newPresence?.member||oldPresence?.member;if(!member)return;
    const c=getConfig();if(!c.roleId||!member.roles.cache.has(c.roleId))return;
    const oldStatus=oldPresence?.status??"offline",newStatus=newPresence?.status??"offline";
    const wasOnline=["online","idle","dnd"].includes(oldStatus),nowOnline=["online","idle","dnd"].includes(newStatus);
    if(wasOnline===nowOnline||nowOnline)return;
    await handlePresence(member,"offline",true,"Discord presence changed to offline");
  }catch(e){console.error("[PRESENCE ERROR]",e?.stack||e);}
});

client.on(Events.GuildMemberUpdate,async(oldMember,newMember)=>{
  try{
    const c=getConfig();if(!c.roleId)return;
    const had=oldMember.roles.cache.has(c.roleId),has=newMember.roles.cache.has(c.roleId);
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

async function start(){
  console.log("🔌 Connecting to Discord Gateway...");
  const maxAttempts=3;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      console.log(`🔑 Gateway login attempt ${attempt}/${maxAttempts}...`);
      await Promise.race([
        client.login(TOKEN),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error("Gateway login timeout after 45 seconds")),45000))
      ]);
      console.log("✅ client.login() resolved.");
      return;
    }catch(e){
      console.error(`❌ Gateway login attempt ${attempt} failed: ${e.message}`);
      if(attempt<maxAttempts){
        const wait=5000*attempt;
        console.log(`⏳ Retrying in ${wait/1000}s...`);
        await new Promise(r=>setTimeout(r,wait));
      }else{
        console.error("❌ Discord Gateway could not be established after 3 attempts.");
        process.exit(1);
      }
    }
  }
}
start();
