const { SeparatorSpacingSize, SeparatorBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextDisplayBuilder  } = require('discord.js');
const fs = require('fs');
const positiveNouns = JSON.parse(fs.readFileSync('./positive_nouns.json', 'utf8'));

async function positiveNounChanger(interaction, givenName, userDisplayName, UserSession) {
	await interaction.deferReply({ flags: 64 });
	const itemsPerPage = 25;
	const totalPages = Math.ceil(positiveNouns.length / itemsPerPage);
	let currentPage = 0;

	function createNounDropdown(page) {
		const startIndex = page * itemsPerPage;
		const endIndex = Math.min(startIndex + itemsPerPage, positiveNouns.length);

		const select = new StringSelectMenuBuilder()
			.setCustomId('positiveNoun_select')
			.setPlaceholder(`Choose a positive noun (Page ${page + 1}/${totalPages})`);

		for (let i = startIndex; i < endIndex; i++) {
			select.addOptions(
				new StringSelectMenuOptionBuilder()
					.setLabel(positiveNouns[i])
					.setValue(positiveNouns[i])
			);
		}

		return select;
	}

	function createNavigationButtons(page) {
		const skipBackButton = new ButtonBuilder()
			.setCustomId('noun_skip_back')
			.setLabel('◀◀')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === 0);

		const prevButton = new ButtonBuilder()
			.setCustomId('noun_prev')
			.setLabel('◀ Previous')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === 0);

		const nextButton = new ButtonBuilder()
			.setCustomId('noun_next')
			.setLabel('Next ▶')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === totalPages - 1);

		const skipForwardButton = new ButtonBuilder()
			.setCustomId('noun_skip_forward')
			.setLabel('▶▶')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === totalPages - 1);

		return new ActionRowBuilder().addComponents(skipBackButton, prevButton, nextButton, skipForwardButton);
	}

const selectRow = new ActionRowBuilder().addComponents(createNounDropdown(currentPage));
const buttonRow = createNavigationButtons(currentPage);

const section = new TextDisplayBuilder().setContent(`### Positive Noun Changer\nWelcome, **${givenName} the ${userDisplayName}**!\n\nSelect a positive noun from the dropdown menu to set it as your positive noun. This appears on the leaderboard on Sparx.`);

const seperator = new SeparatorBuilder({
	spacing: SeparatorSpacingSize.Small
});

const container = new ContainerBuilder()
	.setAccentColor(0xED7B58)
	.addTextDisplayComponents(
		section
	)
	.addSeparatorComponents(
		seperator
	)
	.addActionRowComponents(
		selectRow,
		buttonRow
	);

	await interaction.editReply({ 
		flags: 32768 | 64,
		components: [container]
	});
	
	const message_sent = await interaction.fetchReply();

	const collector = message_sent.createMessageComponentCollector({
		time: 180_000
	});

	collector.on('collect', async (selectInteraction) => {
		if (selectInteraction.customId === 'noun_prev') {
			currentPage = Math.max(0, currentPage - 1);
			const newSelectRow = new ActionRowBuilder().addComponents(createNounDropdown(currentPage));
			const newButtonRow = createNavigationButtons(currentPage);
			container.components[2] = newSelectRow;
			container.components[3] = newButtonRow;
			
			await selectInteraction.update({
				components: [container]
			});
			return;
		}
		
		if (selectInteraction.customId === 'noun_skip_back') {
			currentPage = 0;
			const newSelectRow = new ActionRowBuilder().addComponents(createNounDropdown(currentPage));
			const newButtonRow = createNavigationButtons(currentPage);
			container.components[2] = newSelectRow;
			container.components[3] = newButtonRow;
			
			await selectInteraction.update({
				components: [container]
			});
			return;
		}
		
		if (selectInteraction.customId === 'noun_next') {
			currentPage = Math.min(totalPages - 1, currentPage + 1);
			const newSelectRow = new ActionRowBuilder().addComponents(createNounDropdown(currentPage));
			const newButtonRow = createNavigationButtons(currentPage);
			container.components[2] = newSelectRow;
			container.components[3] = newButtonRow;
			
			await selectInteraction.update({
				components: [container]
			});
			return;
		}
		
		if (selectInteraction.customId === 'noun_skip_forward') {
			currentPage = totalPages - 1;
			const newSelectRow = new ActionRowBuilder().addComponents(createNounDropdown(currentPage));
			const newButtonRow = createNavigationButtons(currentPage);
			container.components[2] = newSelectRow;
			container.components[3] = newButtonRow;
			
			await selectInteraction.update({
				components: [container]
			});
			return;
		}
		
		if (selectInteraction.customId === 'positiveNoun_select') {
			await selectInteraction.deferUpdate();
			const selectedNoun = selectInteraction.values[0];
			
			const sparxReader = UserSession.sparxClass;
			const response_code = await sparxReader.changePositiveNoun(selectedNoun);

			if (response_code === 1) {
				const successEmbed = new EmbedBuilder()
					.setColor(0x90EE90)
					.setTitle('Positive Noun has been changed Successfully')
					.setDescription(`Your positive noun has been successfully changed to **${selectedNoun}**.`);

				await selectInteraction.user.send({
					embeds: [successEmbed],
					ephemeral: true
				});
			} 
			else {
				const exampleEmbed = new EmbedBuilder()
					.setColor(0xFF474D)
					.setTitle('Unexpected Error')
					.setDescription(`An unexpected error has occured.`);

				await selectInteraction.user.send({
					embeds: [exampleEmbed],
					ephemeral: true
				});
			}
		}
	});

	collector.on('end', async () => {
		selectRow.components.forEach(component => component.setDisabled(true));
		buttonRow.components.forEach(component => component.setDisabled(true));
		container.components[2] = selectRow;
		container.components[3] = buttonRow;

		await interaction.editReply({ 
			components: [container]
		});
	});

}

module.exports = positiveNounChanger;