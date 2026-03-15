const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { emojis } = require('./config.json');
const { footerText, footerIcon } = require('./startEmbeds/info.js');
const cookiesMaintenance = {};

async function cookieUpdate(interaction) {
    await interaction.deferUpdate();
    const cookieString = interaction.fields.getTextInputValue('cookies');
    const userForCookies = cookiesMaintenance[interaction.user.id];
    userForCookies.sparxClass.cookies = cookieString;

    const messageEmbed = userForCookies.message_sent.embeds[0];
    messageEmbed.data.fields[0] = { name: 'Last Updated', value: `<t:${Math.floor(Date.now() / 1000)}:R>` };

    await userForCookies.message_sent.edit({
        embeds: [messageEmbed]
    });
}

async function cookieMenuCall(interaction, sparxClass) {
    const cookieMenu = new EmbedBuilder()
        .setColor(0xFFAC1C)
        .setTitle('Cookie Maintenance')
        .setDescription('It is recommended to update the cookie every 5 minutes to not get deauthed by Sparx mid-session, do this even if in the queue!')
        .addFields({ name: 'Last Updated', value: `<t:${Math.floor(Date.now() / 1000)}:R>` });

    const updateCookieButton = new ButtonBuilder()
        .setCustomId('updateCookie')
        .setLabel('Update Cookie')
        .setEmoji(emojis.cookies)
        .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder().addComponents(updateCookieButton);

    const message_sent = await interaction.user.send({ embeds: [cookieMenu], components: [actionRow] });

    cookiesMaintenance[interaction.user.id] = { message_sent, sparxClass };

    const collector = message_sent.createMessageComponentCollector({});

    collector.on('collect', async (componentInteraction) => {
        if (componentInteraction.customId === 'updateCookie') {
            const modal = new ModalBuilder()
                .setCustomId(`cookies_maintenance`)
                .setTitle('Cookies Maintenance');

            // Create the text input components
            const buttons = [];

            const schoolInput = new TextInputBuilder()
                .setCustomId('cookies')
                .setLabel("Cookies String")
                .setStyle(TextInputStyle.Paragraph);

            buttons.push(schoolInput);

            // An action row only holds one text input,
            // so you need one action row per text input.
            for (const button of buttons) {
                modal.addComponents(new ActionRowBuilder().addComponents(button));
            }

            // Show the modal to the user
            await componentInteraction.showModal(modal);
        }
    });
}

module.exports = { cookieMenuCall, cookieUpdate };