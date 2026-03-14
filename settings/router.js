const { checkAccount } = require('../database/accounts');

async function handleSettings(interaction) {
    const platform = interaction.fields.getField('platform').values[0];
    /*
    { label: "Reader", value: "reader", emoji: emojis.reader },
    { label: "Maths", value: "maths", emoji: emojis.maths },
    { label: "Science", value: "science", emoji: emojis.science },
    { label: "LanguageNut", value: "languagenut", emoji: emojis.languagenut },
    { label: "Educake", value: "educake", emoji: emojis.educake },
    { label: "Seneca", value: "seneca", emoji: emojis.seneca },
    { label: "DrFrost", value: "drfrost", emoji: emojis.drfrost }
    */
    console.log(platform);
    const { handleSetting } = require(`./platforms/${platform}`);
    const account = await checkAccount(interaction.user.id);
    await handleSetting(interaction, account);
}

async function updateSettingEmbedRouter(interaction, platform) {
	const account = await checkAccount(interaction.user.id);
    const { updateSettingEmbed } = require(`./platforms/${platform}`);
    await updateSettingEmbed(interaction, account);
}

module.exports = { handleSettings, updateSettingEmbedRouter };