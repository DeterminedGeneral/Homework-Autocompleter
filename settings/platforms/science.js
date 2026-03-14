const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, StringSelectMenuBuilder, LabelBuilder, TextDisplayBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, SectionBuilder } = require('discord.js');
const { emojis } = require('../../config.json');
const UserSettingsEmbeds = require('../UserSettingsEmbeds');

function getContainer(data, disabled=false) {
    const loginSuccessSection = new TextDisplayBuilder().setContent(`## Sparx Science Settings\n**❓ What is Time?**\nTime is the amount of time the bot will wait for each question. This is **PER QUESTION**, not per homework.\n\n**🤔 What is the recommended Time?**\n The recommended time is 30-140s and cannot be set above 180s to prevent queue abuse!\n\n**🤖 What is the Model Order?**\nThe order of the models that will assist you with your homework.`);
    const settingsSetup = new TextDisplayBuilder().setContent(`### Settings`);
    const minTime = new TextDisplayBuilder().setContent(`⏰ **Minimum Fake Time**: ${data.min} Seconds`);
    const maxTime = new TextDisplayBuilder().setContent(`⏰ **Maximum Fake Time**: ${data.max} Seconds`);
    const modelsSet = new TextDisplayBuilder().setContent(`🤖 \`${data.model ?? 'No Models'}\``);
    const seperator = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

    const fakeTimeButton = new ButtonBuilder()
        .setCustomId('fake_time')
        .setLabel('Edit Time')
        .setEmoji(emojis.queue)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled);

    const modelsButton = new ButtonBuilder()
        .setCustomId('model_settings')
        .setLabel('Model Settings')
        .setEmoji(emojis.x)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled);

    const settingsRow = new ActionRowBuilder()
        .addComponents(fakeTimeButton, modelsButton);

    const mathsEmbed = new ContainerBuilder()
        .setAccentColor(0x1d9b8f)
        .addTextDisplayComponents(
            loginSuccessSection.data
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
            settingsSetup.data,
            minTime.data,
            maxTime.data,
            modelsSet.data
        )
        .addSeparatorComponents(seperator);

    mathsEmbed.addActionRowComponents(settingsRow);
    return mathsEmbed;
}

async function updateSettingEmbed(interaction, account) {
    const data = account.sparx_science_settings;
    const container = getContainer(data);

    await interaction.editReply({
        flags: 32768 | 64,
        components: [container],
        fetchReply: true
    });
}

async function handleSetting(interaction, account) {
    const data = account.sparx_science_settings;
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
            if (componentInteraction.customId === 'fake_time') {
				const modal = new ModalBuilder()
					.setCustomId(`sparxscience_faketime`)
					.setTitle('Sparx Science Fake Time');

				const minInput = new TextInputBuilder()
					.setCustomId('min_time')
					.setLabel('Min Time (Seconds)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('0-180');

				const maxInput = new TextInputBuilder()
					.setCustomId('max_time')
					.setLabel('Max Time (Seconds)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('0-180');

				const buttons = [];
				buttons.push(minInput, maxInput);

				for (const button of buttons) {
					modal.addComponents(new ActionRowBuilder().addComponents(button));
				}
				await componentInteraction.showModal(modal);
			} else if (componentInteraction.customId === 'model_settings') {
				const modal = new ModalBuilder()
					.setCustomId(`sparxscience_model_settings`)
					.setTitle(`Model Settings`);
				const question = new StringSelectMenuBuilder()
					.setCustomId('model')
					.setPlaceholder("Model Order")
					.addOptions(
						{ label: "No Models", value: "No Models" },
						{ label: "2.5-flash", value: "2.5-flash" },
                        { label: "2.5-flash -> 2.5-pro", value: "2.5-flash -> 2.5-pro" },
					);

				const typeLabel = new LabelBuilder({
					label: 'Model Order',
					component: question
				});

				modal.addLabelComponents(typeLabel);
				await componentInteraction.showModal(modal);
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