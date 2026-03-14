const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { ScienceSession } = require('../userSessions.js');
const { useUpSlot, cookieMenuCall, getSparxAccountId, positiveNounChanger } = require('./shared.js');
const formatUnixTimestamp = require('../utils/formatUnixTimestamp.js');
const { sparxScienceAutocomplete } = require('../sparx_science/autocompleter.js');
const { handleSetting } = require('../settings/platforms/science.js');
const { checkAccount } = require('../database/accounts.js');

async function scienceExecuter(interaction, sparxScience, queue, existingAccount) {
	const { UserSessions } = require('../executeTasks.js');
	const UserSession = new ScienceSession(sparxScience);
	UserSessions.set(interaction.user.id, UserSession);
	await sparxScience.getClientID();
	const homeworks = await sparxScience.getHomeworks();

	const select = new StringSelectMenuBuilder()
		.setCustomId('sparxscience_homework')
		.setPlaceholder('Choose a homework task')
		.setMinValues(0);

	const homeworksParsed = [];

	for (const homework of homeworks.packages) {
		const progress = homework.state.completion?.progress;
		const totalTasks = homework.state.completion?.size;
		const totalComplete = progress?.C || 0;
		const percent = totalTasks > 0 ? Math.round((totalComplete / totalTasks) * 100) : 0;

		homeworksParsed.push({ endTimestamp: homework.endTimestamp.seconds, percent, name: homework.name });
	}

	const sortByEndDateDesc = (a, b) => b.endTimestamp - a.endTimestamp;

	homeworksParsed.sort(sortByEndDateDesc);

	for (const homework of homeworksParsed) {
		select.addOptions(
			new StringSelectMenuOptionBuilder()
				.setLabel(`Homework for ${formatUnixTimestamp(homework.endTimestamp)}`)
				.setValue(homework.name)
				.setDescription(`${homework.percent}%`)
		);
	}

	let userDisplayName;
	let userInfo;
	try {
		userDisplayName = await sparxScience.getUserDisplayName() || 'User';
		userInfo = await sparxScience.getUserInfo();
	} catch (e) {
		console.log('!!!', e);
		userDisplayName = 'User';
		userInfo = { givenName: 'User' };
	}
	const givenName = (userInfo && userInfo.givenName) ? userInfo.givenName : 'User';

	UserSession.loadFromObject({ min: existingAccount.sparx_science_settings.min, max: existingAccount.sparx_science_settings.max, message_sent: null, interaction: interaction, givenName, userDisplayName, selectRow: select, userInfo, model: existingAccount.sparx_science_settings.model });
	await UserSession.updateEmbed();

	const collector = UserSession.message_sent.createMessageComponentCollector({
		time: 180_000
	});

	collector.on('collect', async (componentInteraction) => {
		if (componentInteraction.isStringSelectMenu()) {
			await componentInteraction.deferUpdate();

			const disabledSelect = new StringSelectMenuBuilder()
				.setCustomId('sparxscience_homework')
				.setPlaceholder('Choose a homework task')
				.setMinValues(0);

			if (UserSession.selectRow) {
				for (const homework of homeworksParsed) {
					const option = new StringSelectMenuOptionBuilder()
						.setLabel(`Homework for ${formatUnixTimestamp(homework.endTimestamp)}`)
						.setValue(homework.name)
						.setDescription(`${homework.percent}%`);
					if (homework.name === componentInteraction.values[0]) {
						option.setDefault(true);
					}
					disabledSelect.addOptions(option);
				}
			}
			UserSession.selectRow = disabledSelect;
			UserSession.selectedHomework = componentInteraction.values[0];

			await UserSession.updateEmbed(false);
		} else if (componentInteraction.isButton()) {
			if (componentInteraction.customId === 'start_science') {
				await componentInteraction.deferUpdate();
				await UserSession.updateEmbed(true);

				if (await useUpSlot(interaction, 'science', getSparxAccountId(UserSession.userInfo), 'sparx')) return;

				if (Object.keys(sparxScience.login).length === 0) {
					await cookieMenuCall(interaction, sparxScience);
				}

				await queue.addQueue({
					action: async () => {
						return await sparxScienceAutocomplete(interaction, UserSession.selectedHomework, sparxScience, UserSession);
					},
					id: interaction.user.id,
					interaction: interaction
				});

				await interaction.followUp({ flags: 64, content: "You have been added to the queue" });
			}
			else if (componentInteraction.customId === 'independent_learning') {
				const modal = new ModalBuilder()
					.setCustomId(`autocompleteSparxScience`)
					.setTitle('Sparx Science Package Id');

				const cookieInput = new TextInputBuilder()
					.setCustomId('package_id')
					.setLabel('Package Id')
					.setStyle(TextInputStyle.Short);

				modal.addComponents(new ActionRowBuilder().addComponents(cookieInput));
				await componentInteraction.showModal(modal);
			} else if (componentInteraction.customId === 'save_account') {
				const modal = new ModalBuilder()
					.setCustomId(`save_account`)
					.setTitle(`Save Account`);
				const input = new TextInputBuilder()
					.setCustomId('master_password')
					.setLabel('Master Password')
					.setStyle(TextInputStyle.Short)
					.setRequired(true);
				modal.addComponents(new ActionRowBuilder().addComponents(input));
				await componentInteraction.showModal(modal);
			} else if (componentInteraction.customId === 'tag_changer') {
				await positiveNounChanger(componentInteraction, givenName, userDisplayName, UserSession);
			} else if (componentInteraction.customId === 'settings') {
				console.log('science settings');
				await componentInteraction.deferReply({ flags: 64});
				const account = await checkAccount(componentInteraction.user.id);
				await handleSetting(componentInteraction, account);
			}
		}
	});

	collector.on('end', async () => {
		UserSession.selectRow.setDisabled(true);
		await UserSession.updateEmbed(true);
	});
}

module.exports = scienceExecuter;