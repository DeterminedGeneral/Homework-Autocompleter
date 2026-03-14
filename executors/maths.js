const { LabelBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { MathsSession } = require('../userSessions.js');
const { useUpSlot, cookieMenuCall, getSparxAccountId, positiveNounChanger } = require('./shared.js');
const { sparxMathsAutocomplete } = require('../sparx_maths/autocompleter.js');
const { handleSetting } = require('../settings/platforms/maths.js');
const { checkAccount } = require('../database/accounts.js');

async function mathsExecuter(interaction, sparxMaths, queue, existingAccount) {
	const { UserSessions } = require('../executeTasks.js');
	const UserSession = new MathsSession(sparxMaths);
	UserSessions.set(interaction.user.id, UserSession);
	await sparxMaths.getClientSession();

	const homeworks = await sparxMaths.getHomeworks();

	console.log('Homeworks', homeworks);

	// Helper to sort descending by endDate
	const sortByEndDateDesc = (a, b) => b.endDate.seconds - a.endDate.seconds;

	// Filter categories
	const onlyHomeworks = homeworks.packages
		.filter(pkg => pkg.title.startsWith('Homework'))
		.sort(sortByEndDateDesc);

	const onlyXpBoosts = homeworks.packages
		.filter(pkg => pkg.title.startsWith('XP Boost'))
		.sort(sortByEndDateDesc);

	const onlyTargets = homeworks.packages
		.filter(pkg => pkg.title.startsWith('Targets'))
		.sort(sortByEndDateDesc);

	// Combine them in the required order
	const orderedList = [...onlyHomeworks, ...onlyXpBoosts, ...onlyTargets];

	const select = new StringSelectMenuBuilder()
		.setCustomId('sparxmaths_homework')
		.setPlaceholder('Choose a homework task')
		.setMinValues(0);

	for (const homework of orderedList) {
		select.addOptions(
			new StringSelectMenuOptionBuilder()
				.setLabel(homework.title)
				.setDescription(`${(Math.round(homework.numTaskItemsDone / homework.numTaskItems * 100)) || 0}%`)
				.setValue(homework.packageID)
		);
	}

	let userDisplayName;
	let userInfo;
	try {
		userDisplayName = await sparxMaths.getUserDisplayName() || 'User';
		userInfo = await sparxMaths.getUserInfo();
	} catch {
		userDisplayName = 'User';
		userInfo = { givenName: 'User' };
	}
	const givenName = (userInfo && userInfo.givenName) ? userInfo.givenName : 'User';

	UserSession.loadFromObject({ min: existingAccount.sparx_maths_settings.min, max: existingAccount.sparx_maths_settings.max, message_sent: null, interaction: interaction, givenName, userDisplayName, selectRow: select, userInfo, sparxMaths, pdfSettings: existingAccount.sparx_maths_settings.pdfSettings ?? { question: false, working_out: false }, model: existingAccount.sparx_maths_settings.model });

	await UserSession.updateEmbed();

	const collector = UserSession.message_sent.createMessageComponentCollector({
		time: 180_000
	});

	collector.on('collect', async (componentInteraction) => {
		if (componentInteraction.isStringSelectMenu()) {
			await componentInteraction.deferUpdate();

			const disabledSelect = new StringSelectMenuBuilder()
				.setCustomId('sparxmaths_homework')
				.setPlaceholder('Choose a homework task')
				.setMinValues(0);

			for (const homework of homeworks.packages) {
				const option = new StringSelectMenuOptionBuilder()
					.setLabel(homework.title)
					.setDescription(`${Math.round(homework.numTasksComplete / homework.numTasks * 100)}%`)
					.setValue(homework.packageID);
				if (homework.packageID === componentInteraction.values[0]) {
					option.setDefault(true);
				}
				disabledSelect.addOptions(option);
			}
			UserSession.selectRow = disabledSelect;
			UserSession.selectedHomework = componentInteraction.values[0];

			await UserSession.updateEmbed(false);
		} else if (componentInteraction.isButton()) {
			if (componentInteraction.customId === 'start_maths') {
				await componentInteraction.deferUpdate();
				await UserSession.updateEmbed(true);

				if (await useUpSlot(interaction, 'maths', getSparxAccountId(UserSession.userInfo), 'sparx')) return;

				if (Object.keys(sparxMaths.login).length === 0) {
					await cookieMenuCall(interaction, sparxMaths);
				}

				await queue.addQueue({
					action: async () => {
						return await sparxMathsAutocomplete(componentInteraction, UserSession.selectedHomework, sparxMaths, UserSession);
					},
					id: interaction.user.id,
					interaction: interaction
				});

				await interaction.followUp({ flags: 64, content: "You have been added to the queue" });
			}
			else if (componentInteraction.customId === 'independent_learning') {
				const modal = new ModalBuilder()
					.setCustomId(`sparxmaths_independant_learning`)
					.setTitle('Independant Learning Code');

				const curriculums = await sparxMaths.listCurriculumSummaries({
					"includeHidden": false,
					"subjectName": ""
				});

				const curriculumInput = new StringSelectMenuBuilder()
					.setCustomId('curriculum')
					.setPlaceholder("Curriculum");

				for (const cur of curriculums.curriculumSummaries) {
					console.log(cur.curriculum.displayName, cur.curriculum.name);
					curriculumInput.addOptions({ label: cur.curriculum.displayName, value: cur.curriculum.name });
				}

				const levelInput = new StringSelectMenuBuilder()
					.setCustomId('level')
					.setPlaceholder("Level")
					.addOptions(
						{ label: "Level 1", value: "1" },
						{ label: "Level 2", value: "2" },
						{ label: "Level 3", value: "3" },
						{ label: "Level 4", value: "4" },
						{ label: "Level 5", value: "5" }
					);

				const curriculumLabel = new LabelBuilder({
					label: 'Curriculum',
					component: curriculumInput
				});
				const levelLabel = new LabelBuilder({
					label: 'Level',
					component: levelInput
				});

				const cookieInput = new TextInputBuilder()
					.setCustomId('code')
					.setLabel('Code')
					.setStyle(TextInputStyle.Short);

				modal.addLabelComponents(curriculumLabel);
				modal.addComponents(new ActionRowBuilder().addComponents(cookieInput));
				modal.addLabelComponents(levelLabel);
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
			}
			else if (componentInteraction.customId === 'settings') {
				console.log('Math settings');
				await componentInteraction.deferReply({ flags: 64});
				const account = await checkAccount(componentInteraction.user.id);
				await handleSetting(componentInteraction, account);

			}
		}
	});

	collector.on('end', async () => {
		select.setDisabled(true);
		UserSession.selectRow = select;
		await UserSession.updateEmbed(true);
	});
}

module.exports = mathsExecuter;