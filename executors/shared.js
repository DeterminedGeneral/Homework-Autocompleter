const { useUpSlot } = require('../handlers/accountHandler.js');
const { getSparxAccountId } = require('../handlers/mainAccountLogin.js');
const { cookieMenuCall } = require('../cookies_menu.js');
const positiveNounChanger = require('../positiveNounChanger.js');

module.exports = { cookieMenuCall, useUpSlot, getSparxAccountId, positiveNounChanger };