const fs = require('node:fs');
const path = require('node:path');

const BLACKLIST_FILE = path.join(__dirname, '../blacklisted.txt');
let blacklistedWords = [];

async function loadBlacklistedWords() {
    try {
        const data = await fs.promises.readFile(BLACKLIST_FILE, 'utf8');
        blacklistedWords = data.split(/\r?\n/).map(word => word.trim()).filter(word => word.length > 0);
        console.log('Blacklisted words loaded');
    } catch (error) {
        console.error('Error loading blacklisted words:', error);
        blacklistedWords = [];
    }
}

// Load words initially and whenever the file changes
loadBlacklistedWords();
fs.watchFile(BLACKLIST_FILE, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
        console.log('Blacklisted words file changed, reloading...');
        loadBlacklistedWords();
    }
});

function containsBlacklistedWord(messageContent) {
    const lowerCaseMessage = messageContent.toLowerCase();
    return blacklistedWords.some(word => lowerCaseMessage.includes(word.toLowerCase()));
}

module.exports = { containsBlacklistedWord, loadBlacklistedWords };
