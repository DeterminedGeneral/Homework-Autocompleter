const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, StringSelectMenuBuilder, LabelBuilder, TextDisplayBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, SectionBuilder } = require('discord.js');
const { emojis } = require('../../config.json');
const UserSettingsEmbeds = require('../UserSettingsEmbeds');

function getContainer(data, disabled=false) {

    const welcomeMessage = `## Sparx Maths Settings\n`;
    const pdfSettingsMessage = `\n\n**📜 PDF Settings**\nThese are the settings for the pdf provided at the end of each session.`;
    const fakeTimeMessage = `\n\n**❓ What is Fake Time?**\nFake Time is the time that the teachers will see — not how long the bot will actually take. Fake Time is **PER QUESTION**, not per homework.\n\n**🤔 What is the recommended Fake Time?**\n The recommended fake time is 100-140s and cannot be set above 180s to prevent getting caught!`;
    const modelsMessage = `\n\n**🤖 What is the Model Order?**\nThe order of the models that will assist you with your homework.`;

    const loginSuccessSection = new TextDisplayBuilder().setContent(`${welcomeMessage}${pdfSettingsMessage}${fakeTimeMessage}${modelsMessage}`);
    const settingsSetup = new TextDisplayBuilder().setContent(`### Settings`);
    const pdfSet = new TextDisplayBuilder().setContent(`**📜 PDF **\n**Answers**  \`\`✅\`\`\n**Questions**  ${data.pdfSettings?.question ? '``✅``' : '``❌``'}\n**Working Out**  ${data.pdfSettings?.working_out ? '``✅``' : '``❌``'}`);
    const minTime = new TextDisplayBuilder().setContent(`⏰ **Minimum Fake Time**: ${data.min} Seconds`);
    const maxTime = new TextDisplayBuilder().setContent(`⏰ **Maximum Fake Time**: ${data.max} Seconds`);
    const modelsSet = new TextDisplayBuilder().setContent(`🤖 \`${data.model ?? 'No Models'}\``);

    const fakeTimeButton = new ButtonBuilder()
        .setCustomId('fake_time')
        .setLabel('Edit Time')
        .setEmoji(emojis.queue)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled);

    const workingOutButton = new ButtonBuilder()
        .setCustomId('pdf_settings')
        .setLabel('PDF Settings')
        .setEmoji(emojis.pdf)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled);

    const modelsButton = new ButtonBuilder()
        .setCustomId('model_settings')
        .setLabel('Model Settings')
        .setEmoji(emojis.x)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled);

    const settingsRow = new ActionRowBuilder()
        .addComponents(fakeTimeButton, workingOutButton, modelsButton);
    const mathsEmbed = new ContainerBuilder()
        .setAccentColor(0x4467C4)
        .addTextDisplayComponents(
            loginSuccessSection.data
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
            settingsSetup.data,
            pdfSet.data,
            minTime.data,
            maxTime.data,
            modelsSet.data
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
    const data = account.sparx_maths_settings;
    console.log(data);
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
					.setCustomId(`sparxmaths_faketime`)
					.setTitle('Sparx Maths Fake Time');

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

			} else if (componentInteraction.customId === 'pdf_settings') {
				const modal = new ModalBuilder()
					.setCustomId(`sparxmaths_pdf_settings`)
					.setTitle(`PDF Settings`);
				const question = new StringSelectMenuBuilder()
					.setCustomId('question')
					.setPlaceholder("Show the question in the PDF?")
					.addOptions(
						{ label: "Show Question", value: "true" },
						{ label: "Don't Show Question", value: "false" },
					);
				const working_out = new StringSelectMenuBuilder()
					.setCustomId('working_out')
					.setPlaceholder("Show the working out in the PDF?")
					.addOptions(
						{ label: "Show Working Out", value: "true" },
						{ label: "Don't Show Working Out", value: "false" },
					);
				const typeLabel = new LabelBuilder({
					label: 'Question',
					component: question
				});

				const working_outLabel = new LabelBuilder({
					label: 'Working Out',
					component: working_out
				});

				modal.addLabelComponents(typeLabel, working_outLabel);
				await componentInteraction.showModal(modal);
			} else if (componentInteraction.customId === 'model_settings') {
				const modal = new ModalBuilder()
					.setCustomId(`sparxmaths_model_settings`)
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