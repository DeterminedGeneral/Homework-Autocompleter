function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let result = [];
    if (hours > 0) result.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) result.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    if (seconds > 0 || result.length === 0) result.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

    return result.join(', ');
}

module.exports = formatTime;