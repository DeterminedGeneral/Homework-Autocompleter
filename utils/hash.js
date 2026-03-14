const bcrypt = require('bcrypt');

async function hash(secret) {
    const saltRounds = 10; // 10 is the standard default
    const hash = await bcrypt.hash(secret, saltRounds);

    return hash;
}

module.exports = hash;