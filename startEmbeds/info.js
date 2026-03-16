const config = require('../config.json');
const emojis = config.emojis;
const { name } = require('../config.json');
module.exports = {
    legalDisclamer: `\n> **LEGAL DISCLAMER**: ${name} employs the use of human tutors to complete the tasks given to them by customers of ${name}. No LLM (AI) is used throughout this process. No content or material from the homework platform is used for anything other than its permitted purpose. ${name} is in compliance with all regulations and abides by all Terms of Service of this homework platform.`,
    emojis: emojis
};