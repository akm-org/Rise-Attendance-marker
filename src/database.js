const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const ATTENDANCE_FILE = path.join(DATA_DIR, "attendance.json");

function ensureFile(file, initial) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initial, null, 2));
}

ensureFile(CONFIG_FILE, { roleId: null, channelId: null, panelChannelId: null, dashboardChannelId: null, statusMessageId: null });
ensureFile(ATTENDANCE_FILE, { members: {} });

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function getConfig() {
  return readJson(CONFIG_FILE, { roleId: null, channelId: null, panelChannelId: null, dashboardChannelId: null, statusMessageId: null });
}

function saveConfig(config) {
  writeJson(CONFIG_FILE, config);
}

function getAttendance() {
  return readJson(ATTENDANCE_FILE, { members: {} });
}

function saveAttendance(data) {
  writeJson(ATTENDANCE_FILE, data);
}

function ensureMember(data, userId) {
  if (!data.members[userId]) {
    data.members[userId] = {
      baseName: null,
      sessions: [],
      totalSeconds: 0,
      activeSince: null
    };
  }
  return data.members[userId];
}

module.exports = {
  getConfig,
  saveConfig,
  getAttendance,
  saveAttendance,
  ensureMember
};
