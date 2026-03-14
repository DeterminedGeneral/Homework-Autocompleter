const bcrypt = require('bcrypt');

async function hashCompare(plainValue, hashedValue) {
    return await bcrypt.compare(plainValue, hashedValue);
}

module.exports = hashCompare;