const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, StringSelectMenuBuilder, LabelBuilder, TextDisplayBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, SectionBuilder } = require('discord.js');
const { emojis } = require('../../config.json');
const UserSettingsEmbeds = require('../UserSettingsEmbeds');
const { updateDB } = require('../../database/accounts');

function getContainer(data, disabled=false) {

    const welcomeMessage = `## General Settings\n`;
    const pdfSettingsMessage = `\n\n**🔑 API Key**\nThe Gemini API Key used for the AI.\n`;

    const loginSuccessSection = new TextDisplayBuilder().setContent(`${welcomeMessage}${pdfSettingsMessage}`);
    const settingsSetup = new TextDisplayBuilder().setContent(`### Settings`);
    const pdfSet = new TextDisplayBuilder().setContent(`**🔑 API Key **\`\`\`${data.apikey ?? 'None Configured. Using Global AI'}\`\`\``);

    const fakeTimeButton = new ButtonBuilder()
        .setCustomId('remove_apikey')
        .setLabel('Remove API Key')
        .setEmoji(emojis.x)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled);

    const workingOutButton = new ButtonBuilder()
        .setCustomId('change_apikey')
        .setLabel('Change API Key')
        .setEmoji(emojis.pdf)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled);

    const settingsRow = new ActionRowBuilder()
        .addComponents(fakeTimeButton, workingOutButton);
    const mathsEmbed = new ContainerBuilder()
        .setAccentColor(0x4467C4)
        .addTextDisplayComponents(
            loginSuccessSection.data
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
            settingsSetup.data,
            pdfSet.data
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    mathsEmbed.addActionRowComponents(settingsRow);

    return mathsEmbed;
}

async function updateSettingEmbed(interaction, account) {
    const data = account.sparx_maths_settings;
    const container = getContainer(data);

    await interaction.editReply({
        flags: 32768 | 64,
        components: [container],
        fetchReply: true
    });

}

async function handleSetting(interaction, account) {
    const data = account;
    const container = getContainer(data);

    const message_sent = await interaction.editReply({
        flags: 32768 | 64,
        components: [container],
        fetchReply: true
    });

    UserSettingsEmbeds.set(interaction.user.id, interaction);

	const collector = message_sent.createMessageComponentCollector({
		time: 180_000
	});

    collector.on('collect', async (componentInteraction) => {
        if (componentInteraction.isButton()) {
            if (componentInteraction.customId === 'change_apikey') {
				const modal = new ModalBuilder()
					.setCustomId(`change_apikey`)
					.setTitle('Change Apikey');

				const minInput = new TextInputBuilder()
					.setCustomId('apikey')
					.setLabel('API Key')
					.setStyle(TextInputStyle.Short);

				const buttons = [];
				buttons.push(minInput);

				for (const button of buttons) {
					modal.addComponents(new ActionRowBuilder().addComponents(button));
				}
				await componentInteraction.showModal(modal);

			} else if (componentInteraction.customId === 'remove_apikey') {
                await updateDB(interaction.user.id, {apikey: null});
                await componentInteraction.deferUpdate({ flags: 64 });
                const section = new TextDisplayBuilder().setContent(`## API Key Removed\nYour Api Key has been successfully removed`);

                const container = new ContainerBuilder()
                    .setAccentColor(0xA52A2A)
                    .addTextDisplayComponents(
                        section.data
                    );

                await componentInteraction.followUp({
                    flags: 32768 | 64,
                    components: [container]
                });
            }
        }
    });

    collector.on('end', async () => {
        const container = getContainer(data, true);
        await interaction.editReply({
            components: [container]
        });
    });
}

module.exports = {
    handleSetting,
    updateSettingEmbed
};