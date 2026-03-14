const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { emojis } = require('../config.json');

async function queueCollector(interaction, embedTitle) {
    try {
        await interaction.deferReply({ ephemeral: true });
    } catch {

    }
    const { queue, queueMaths, queueScience } = require('./queue');
    let queueToUse;
    let embedColor;

    if (embedTitle.includes('math')) {
        queueToUse = queueMaths;
        embedColor = 0x0099FF; // Sparx Maths blue
    } else if (embedTitle.includes('reader')) {
        queueToUse = queue;
        embedColor = 0x4467C4; // Sparx Reader purple
    } else {
        queueToUse = queueScience;
        embedColor = 0x1d9b8f; // Sparx Science teal
    }
    const queuePeople = await queueToUse.getPeople();
    let userPosition = await queueToUse.checkQueue(interaction.user.id);
    const row = new ActionRowBuilder();

    if (userPosition === -1) {
        userPosition = 'not in the queue';
    } else if (userPosition === -2) {
        userPosition = 'using the autocompleter';
        const terminateButton = new ButtonBuilder()
            .setCustomId('terminate_session')
            .setLabel('Terminate Session')
            .setEmoji(emojis.exit_queue)
            .setStyle(ButtonStyle.Danger);

        row.addComponents(terminateButton);
    } else {
        userPosition = `position **${userPosition + 1}** in the queue`;
        const leaveQueueButton = new ButtonBuilder()
            .setCustomId('leave_queue')
            .setLabel('Leave Queue')
            .setEmoji(emojis.exit_queue)
            .setStyle(ButtonStyle.Danger);

        row.addComponents(leaveQueueButton);
    }

    const seperator = new SeparatorBuilder({
        spacing: SeparatorSpacingSize.Small
    });

    const section = new TextDisplayBuilder().setContent(`### Queue Status\nThere are **${queuePeople.queue.length}** people waiting in the queue. **${queuePeople.currentPerson.length}** people are using the autocompleter. You are ${userPosition}.`);

    // 3. Assemble everything into the main container
    const container = new ContainerBuilder()
        .setAccentColor(embedColor)
        .addTextDisplayComponents(
            section.data
        );

    if (row.components.length) {
        container.addSeparatorComponents(
            seperator
        )
            .addActionRowComponents(
                row
            );
    }

    try {
        await interaction.editReply({
            flags: 32768 | 64,
            components: [container]
        });
    } catch {
        return;
    }

    const message_sent = await interaction.fetchReply();

    const collector = message_sent.createMessageComponentCollector({
        componentType: ComponentType.Button
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate({ flags: 64 });
        const section = new TextDisplayBuilder();

        // 3. Assemble everything into the main container
        const container = new ContainerBuilder();

        if (interaction.customId === 'terminate_session') {
            const sessionTerminated = await queueToUse.terminateSession(interaction.user.id);

            if (sessionTerminated) {
                section.setContent(`### Session Terminated\nYou have successfully terminated your current session with the autocompleter.`);
                container.setAccentColor(0xFF474D);
            } else {
                section.setContent(`### No ongoing Session\nYou have no ongoing session.`);
                container.setAccentColor(0x0099FF);
            }
        } else if (interaction.customId === 'leave_queue') {
            const sessionTerminated = await queueToUse.removePerson(interaction.user.id);

            if (sessionTerminated) {
                section.setContent(`### Left Queue\nYou have successfully left the queue.`);
                container.setAccentColor(0xFF474D);
            } else {
                section.setContent(`### Not in Queue\nYou are not in the Queue.`);
                container.setAccentColor(0x0099FF);
            }
        }

        container.addTextDisplayComponents(
            section.data
        );

        await interaction.followUp({
            flags: 32768 | 64,
            components: [container]
        });

    });

}

module.exports = { queueCollector };