const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, SectionBuilder } = require('discord.js');
const UserSettingsEmbeds = require('../UserSettingsEmbeds');

function getContainer(data, disabled=false) {
    const section = new SectionBuilder()
    .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## Sparx Reader Settings\n⏰ **Words Per Minute** — How fast the bot "reads". Setting it to 0 will make it complete questions as fast as possible. Recommended WPM is 300 to balance speed and reduce the risk of getting caught, WPM cannot be set below the SRP target to prevent queue abuse by delaying it with egregious wait times.\n\n⭐️ **Sparx Reader Points** — The bot will stop reading after reaching the chosen points or when all books are finished, whichever comes first. The bot will automatically choose the next book if it finishes the book before reaching the SRP target or finishes all books in your library. The SRP target maximum is 99999.`)
    )
    .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: 'https://i.postimg.cc/cJQg4QDt/library-book.webp' } }));

    const sectionButtons = [];
    const seperator = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

    sectionButtons.push(
        new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`⏰ **Words Per Minute**: ${data.wpm}`))
            .setButtonAccessory(new ButtonBuilder().setLabel('⏰ WPM').setCustomId('wpm').setStyle(ButtonStyle.Primary).setDisabled(disabled))
    );

    sectionButtons.push(
        new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`⭐️ **Sparx Reader Points**: ${data.srp}`))
            .setButtonAccessory(new ButtonBuilder().setLabel('⭐️ SRP').setCustomId('points').setStyle(ButtonStyle.Primary).setDisabled(disabled)));

    // 3. Assemble everything into the main container
    const container = new ContainerBuilder()
        .setAccentColor(0x4467C4)
        .addSectionComponents(
            section
        )
        .addSeparatorComponents(seperator)
        .addSectionComponents(
            ...sectionButtons
        );

    return container;
}

async function updateSettingEmbed(interaction, account) {
    const data = account.sparx_reader_settings;
    const container = getContainer(data);

    await interaction.editReply({
        flags: 32768 | 64,
        components: [container],
        fetchReply: true
    });
}

async function handleSetting(interaction, account) {
    const data = account.sparx_reader_settings;
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
            if (componentInteraction.customId === 'points' || componentInteraction.customId === 'wpm') {
                const isPoints = componentInteraction.customId === 'points';
                const modal = new ModalBuilder()
                    .setCustomId(`sparxreader_${isPoints ? 'points' : 'wpm'}Change`)
                    .setTitle(`${isPoints ? 'Point' : 'WPM'} Setting`);
                const input = new TextInputBuilder()
                    .setCustomId(isPoints ? 'points' : 'wpm')
                    .setLabel(isPoints ? "Points" : "WPM")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
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