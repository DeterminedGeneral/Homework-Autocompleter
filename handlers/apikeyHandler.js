const { ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { updateDB } = require('../database/accounts');

async function handleApiKeyRequest(interaction) {
    if (interaction.customId === 'change_apikey') {
        const apikey = interaction.fields.getTextInputValue('apikey');
        await updateDB(interaction.user.id, {apikey});
        const section = new TextDisplayBuilder().setContent(`## API Key Changed Successfully\nYour API Key has been successfully changed to \`${apikey}\``);

        const container = new ContainerBuilder()
            .setAccentColor(0x90EE90)
            .addTextDisplayComponents(
                section.data
            );

        await interaction.followUp({
            flags: 32768 | 64,
            components: [container]
        });
    }
}

module.exports = { handleApiKeyRequest };