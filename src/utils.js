function formatDuration(seconds) {
    seconds = Math.max(0, Math.floor(seconds));

    const days = Math.floor(seconds / 86400);
    seconds %= 86400;

    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;

    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    const parts = [];

    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    if (minutes || hours || days) parts.push(`${minutes}m`);

    parts.push(`${seconds}s`);

    return parts.join(" ");
}

function startOfDay(timestamp = Date.now()) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function startOfWeek(timestamp = Date.now()) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);

    const day = date.getDay();
    const difference = day === 0 ? 6 : day - 1;

    date.setDate(date.getDate() - difference);

    return date.getTime();
}

function startOfMonth(timestamp = Date.now()) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    date.setDate(1);

    return date.getTime();
}

function rangeSeconds(memberData, rangeStart, now = Date.now()) {
    let total = 0;

    for (const session of memberData.sessions || []) {
        const start = Math.max(session.start, rangeStart);
        const end = Math.min(session.end ?? now, now);

        if (end > start) {
            total += (end - start) / 1000;
        }
    }

    if (memberData.activeSince) {
        const start = Math.max(memberData.activeSince, rangeStart);
        const end = now;

        if (end > start) {
            total += (end - start) / 1000;
        }
    }

    return total;
}

module.exports = {
    formatDuration,
    startOfDay,
    startOfWeek,
    startOfMonth,
    rangeSeconds
};
