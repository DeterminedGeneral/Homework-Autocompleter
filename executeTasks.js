const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, ContainerBuilder, TextDisplayBuilder, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, FileBuilder, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { execSync } = require('child_process');
const fs = require('fs');
const { updateSettingEmbedRouter } = require('./settings/router.js');
const loginsSavedTemp = [];
const { getTokenSparx, getTokenRequest } = require('./sparx/puppeteer');
const { SparxReader } = require('./sparx/reader.js');
const { SparxMaths } = require('./sparx/maths.js');
const { SparxScience } = require('./sparx/science.js');
const { sparxMathsAutocomplete } = require('./sparx_maths/autocompleter.js');
const { logError } = require('./utils/errorLogger.js');
const readerExecutor = require('./executors/reader.js');
const mathsExecuter = require('./executors/maths.js');
const scienceExecutor = require('./executors/science.js');
const puppetQueue = require('./queues/puppeteerQueue.js');
const UserSessions = new Map();
const config = require('./config.json');
const queueRanksPositions = config.queue_ranks;
const emojis = config.emojis;
const { updateDB, checkAccount } = require('./database/accounts.js');
const whatRole = require('./utils/whatRole.js');
function getGitVersion() {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'Unknown';
	}
}

async function handleShareButton(interaction, message, errorContext) {
	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 300000
	});

	collector.on('collect', async (i) => {
		if (i.customId === 'share_error' || i.customId === 'share_error_login') {
			await i.deferReply({ flags: 64 });

			try {
				const container = message.components[0];
				if (container && container.components) {
					const disabledComponents = container.components.map(c => {
						if (c.type === ComponentType.Button) {
							return ButtonBuilder.from(c).setDisabled(true);
						}
						return null;
					}).filter(c => c !== null);

					if (disabledComponents.length > 0) {
						const disabledRow = new ActionRowBuilder().addComponents(disabledComponents);
						await message.edit({ components: [disabledRow] });
					}
				}
			} catch (err) {
				console.warn('Failed to disable buttons:', err.message);
			}

			try {
				const categoryId = config.bug_report_category_id || config.bug_report_channel_id;
				if (!categoryId) {
					await i.editReply("Error: Bug report channel is not configured.");
					return;
				}
				const category = await interaction.client.channels.fetch(categoryId);
				if (!category) {
					await i.editReply("Error: Could not find report category.");
					return;
				}
				const guild = category.guild;

				const channel = await guild.channels.create({
					name: `🐛-bug-report`,
					type: ChannelType.GuildText,
					parent: categoryId,
					permissionOverwrites: [
						{
							id: guild.id,
							deny: [PermissionFlagsBits.ViewChannel],
						},
						{
							id: i.user.id,
							allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
						},
						{
							id: interaction.client.user.id,
							allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
						}
					],
				});

				const shareLogin = i.customId === 'share_error_login';
				const embedColor = shareLogin ? 0x3498DB : 0x95A5A6;

				const reportEmbed = new EmbedBuilder()
					.setColor(embedColor)
					.setTitle('Bug Report')
					.addFields(
						{ name: 'User', value: `<@${interaction.user.id}>`, inline: true },
						{ name: 'Platform', value: errorContext.platform || 'Unknown', inline: true },
						{ name: 'Version', value: getGitVersion(), inline: true },
						{ name: 'Error Message', value: `\`\`${(errorContext.errorMessage || 'None').substring(0, 1000)}\`\`` },
						{ name: 'Login Method', value: errorContext.loginType || 'Unknown', inline: true },
					)
					.setFooter({ text: `UserID:${interaction.user.id}` });

				if (shareLogin && errorContext.loginDetails) {
					reportEmbed.addFields({
						name: 'Login Details',
						value: `Email: ${errorContext.loginDetails.email}\nPassword: ${errorContext.loginDetails.password}\nSchool: ${errorContext.loginDetails.school}`
					});
				}

				const closeBtn = new ButtonBuilder()
					.setCustomId('close_ticket')
					.setLabel('Delete Ticket')
					.setEmoji(emojis.bin || '🗑️')
					.setStyle(ButtonStyle.Danger);

				const resolvedBtn = new ButtonBuilder()
					.setCustomId('resolved')
					.setLabel('Resolved')
					.setEmoji(emojis.tick || '✅')
					.setStyle(ButtonStyle.Success);

				const row = new ActionRowBuilder().addComponents(resolvedBtn, closeBtn);

				const files = [];
				if (errorContext.videoPath && fs.existsSync(errorContext.videoPath)) {
					files.push({ attachment: errorContext.videoPath, name: 'login-error.mp4' });
				}

				await channel.send({
					content: `<@${interaction.user.id}>`,
					embeds: [reportEmbed],
					components: [row],
					files: files
				});

				await i.editReply(`Thank you!\nBug reported successfully! Please wait patiently while we fix this problem.\nWe will notify you here once it's resolved.`);

			} catch (err) {
				console.error('Error creating ticket:', err);
				await i.editReply("Failed to report bug.\nPlease try again later.");
			}
		}
	});
}

async function executeTasks(interaction) {
	const { queue, queueMaths, queueScience } = require('./queues/queue');

	try {
		if (interaction.customId.startsWith('loginSparx')) {
			// Get the values from the modal inputs

			let token;
			let login = {};

			let cookies;
			let loginOutcome;

			const customIdPartsSplit = interaction.customId.split('_');
			const isReaderLogin = customIdPartsSplit[1] === 'homework' && customIdPartsSplit[2] === 'reader';
			const isMathsLogin = customIdPartsSplit[1] === 'homework' && customIdPartsSplit[2] === 'maths';
			const isScienceLogin = customIdPartsSplit[1] === 'homework' && customIdPartsSplit[2] === 'science';
			let embedColor;
			if (isReaderLogin) {
				embedColor = 0x4467C4; // Sparx Reader purple
			} else if (isMathsLogin) {
				embedColor = 0x0099FF; // Sparx Maths blue
			} else if (isScienceLogin) {
				embedColor = 0x1d9b8f; // Sparx Science green
			} else {
				embedColor = 0x7d7d7d; // Noun Changer grey
			}

			const Loadingsection = new TextDisplayBuilder().setContent(`### Logging In... :hourglass:\nAttempting to log in to your account...`);

			const Loadingcontainer = new ContainerBuilder()
				.setAccentColor(embedColor)
				.addTextDisplayComponents(
					Loadingsection.data
				);

			let last2FAInteraction = null;

			const on2FA = async (data) => {
				// data: { type: 'approval'|'code'|'select_method', value: ..., methods: [], canTryAnotherWay: boolean }
				try {
					let description = '';

					let components = [];
					const row = new ActionRowBuilder();

					if (data.type === 'approval') {
						description = `Please open your Microsoft Authenticator app and approve the sign-in request.\nType the number below to confirm:\n# **${data.value}**`;
					} else if (data.type === 'code') {
						description = 'Please enter the verification code from your Authenticator app or SMS.';
						const codeBtn = new ButtonBuilder()
							.setCustomId('enter_auth_code')
							.setLabel('Enter Code')
							.setStyle(ButtonStyle.Primary);
						row.addComponents(codeBtn);
					} else if (data.type === 'select_method') {
						description = 'Select a verification method from the options below:';
						data.methods.forEach((method, index) => {
							const btn = new ButtonBuilder()
								.setCustomId(`select_method_${index}`)
								.setLabel(method.text || 'Method ' + (index + 1))
								.setStyle(index === 0 ? ButtonStyle.Secondary : ButtonStyle.Primary);

							row.addComponents(btn);
						});
					}



					const authSection = new TextDisplayBuilder().setContent(`## 🔐 Microsoft Authentication\n${description}`);

					const containerObj = new ContainerBuilder()
						.setAccentColor(embedColor)
						.addTextDisplayComponents(authSection.data);

					if (row.components.length > 0) {
						containerObj.addActionRowComponents(row);
					}

					// Send or Update message
					await interaction.editReply({ components: [containerObj] });

					// Wait for interaction
					return new Promise(async resolve => {
						const filter = i => i.user.id === interaction.user.id;
						let messageTarget;
						try {
							messageTarget = await interaction.fetchReply();
						} catch (e) {
							console.log('Error fetching reply for collector:', e);
						}

						if (!messageTarget || !messageTarget.createMessageComponentCollector) {
							console.log('Failed to attach collector to message target:', messageTarget);
							return resolve(null);
						}

						const collector = messageTarget.createMessageComponentCollector({ filter, time: 180000 }); // Increased timeout to 3 minutes

						collector.on('collect', async i => {
							try {
								if (i.customId.startsWith('select_method_')) {
									await i.deferUpdate();
									collector.stop();
									const index = parseInt(i.customId.split('_')[2]);
									resolve({ action: 'select_method', index: index });
								} else if (i.customId === 'enter_auth_code') {
									const modal = new ModalBuilder()
										.setCustomId('auth_code_modal')
										.setTitle('Enter Verification Code');

									const codeInput = new TextInputBuilder()
										.setCustomId('auth_code')
										.setLabel('Code')
										.setStyle(TextInputStyle.Short)
										.setRequired(true);

									const modalRow = new ActionRowBuilder().addComponents(codeInput);
									modal.addComponents(modalRow);

									await i.showModal(modal);

									// Await modal submission separately
									// Note: This promise inside collector handler won't block the outer resolve unless we handle it right.
									// We can resolve directly from modal interaction.
									try {
										const modalSubmit = await i.awaitModalSubmit({ time: 60000, filter });
										await modalSubmit.deferUpdate();
										collector.stop();
										resolve({ action: 'code', code: modalSubmit.fields.getTextInputValue('auth_code') });
									} catch {
										// Modal timeout
									}
								}
							} catch (e) {
								console.error('Error handling interaction:', e);
							}
						});

						collector.on('end', () => {
							resolve(null); // Resolve with null on timeout
						});
					});

				} catch (err) {
					console.error('Error in on2FA:', err);
					return null;
				}
			};

			if (interaction.customId.startsWith('loginSparxC')) { // loginSparxC_homework_reader

				await interaction.editReply({
					components: [Loadingcontainer],
					flags: 32768 | 64
				});

				cookies = interaction.fields.getTextInputValue('cookies');
				token = await getTokenRequest(cookies);
				// console.log(`Token ${typeof(token)}: <${token.trim()}>`);
			} else if (interaction.customId.startsWith('loginSparxL')) {

				await interaction.editReply({
					components: [Loadingcontainer],
					flags: 32768 | 64
				});

				const school = interaction.loginDetails.school;
				const email = interaction.loginDetails.email;
				const password = interaction.loginDetails.password;
				const loginType = interaction.loginDetails.loginType;

				login = { school, email, password, loginType, app: customIdPartsSplit[2] };

				const tokenAndCookies = await puppetQueue.add(() =>
					getTokenSparx(
						school,
						email,
						password,
						loginType,
						customIdPartsSplit[2],
						on2FA
					));
				cookies = tokenAndCookies?.cookies;
				token = tokenAndCookies?.token;
				loginOutcome = tokenAndCookies;
			} else {

				await interaction.editReply({
					components: [Loadingcontainer],
					flags: 32768 | 64
				});

				const school = interaction.fields.getTextInputValue('school');
				const email = interaction.fields.getTextInputValue('email');
				const password = interaction.fields.getTextInputValue('password');
				const loginType = interaction.fields.getField('type').values[0];

				login = { school, email, password, loginType, app: customIdPartsSplit[2] };

				const tokenAndCookies = await puppetQueue.add(() =>
					getTokenSparx(school, email, password, loginType, customIdPartsSplit[2], on2FA
					));
				cookies = tokenAndCookies?.cookies;
				token = tokenAndCookies?.token;
				loginOutcome = tokenAndCookies;
			}

			if (!token || token.trim() === "Unauthorized") {
				const container = new ContainerBuilder().setAccentColor(0xFF474D);

				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(`# Login Failed`).data,
					new TextDisplayBuilder().setContent(`Failed to login to your account.\n*Having login issues? Use the Login with Cookies option with the [Sparx Cookie Getter](https://github.com/DeterminedGeneral/Sparx-Cookie-Getter) extension.*`).data
				);

				if (loginOutcome) {
					container.addSeparatorComponents(new SeparatorBuilder({ spacing: SeparatorSpacingSize.Small }));
					const summaryText = `**Login Attempt Summary**\n` +
						`${loginOutcome.schoolStatus ? '``✅``' : '``❌``'} School:\n` +
						`${loginOutcome.loginTypeStatus ? '``✅``' : '``❌``'} Login Type:\n` +
						`${loginOutcome.emailTypeStatus ? '``✅``' : '``❌``'} Email/Username:\n` +
						`${loginOutcome.passTypeStatus ? '``✅``' : '``❌``'} Password:`;
					container.addTextDisplayComponents(new TextDisplayBuilder().setContent(summaryText).data);
				}

				const shareBtn = new ButtonBuilder()
					.setCustomId('share_error')
					.setLabel('Share Error')
					.setStyle(ButtonStyle.Secondary);

				const shareLoginBtn = new ButtonBuilder()
					.setCustomId('share_error_login')
					.setLabel('Share with Login Details')
					.setStyle(ButtonStyle.Secondary);

				const row = new ActionRowBuilder().addComponents(shareBtn, shareLoginBtn);

				const files = [];
				if (loginOutcome?.vid_path) {
					container.addSeparatorComponents(new SeparatorBuilder({ spacing: SeparatorSpacingSize.Small }));
					container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`We ran into an error while trying to log in. This video shows the process so you can see what went wrong. If you believe your details are correct, please share the video with us using the buttons below.`).data);

					const videoGallery = new MediaGalleryBuilder()
						.addItems(new MediaGalleryItemBuilder().setURL('attachment://login-error.mp4'));
					container.addMediaGalleryComponents(videoGallery);

					files.push({
						attachment: loginOutcome.vid_path,
						name: 'login-error.mp4'
					});
				}

				container.addActionRowComponents(row);

				let finalMsg;
				try {
					finalMsg = await interaction.editReply({
						components: [container],
						files: files
					});
				} catch {
					// Interaction token expired, send DM instead
					console.log('Interaction expired, sending DM to user');
					finalMsg = await interaction.user.send({
						components: [container],
						files: files
					});
				}

				if (finalMsg) {
					handleShareButton(interaction, finalMsg, {
						platform: customIdPartsSplit[2],
						loginType: login.loginType,
						loginDetails: login,
						errorMessage: "Login Failed",
						videoPath: loginOutcome?.vid_path
					});
				}
				return;
			}

			const loginSuccessSection = new TextDisplayBuilder().setContent(`### ✅ Login Successful\nSuccessfully logged into your Sparx account. Loading...`);

			const loginSuccessContainer = new ContainerBuilder()
				.setAccentColor(0x90EE90)
				.addTextDisplayComponents(
					loginSuccessSection.data
				);

			try {
				await interaction.editReply({
					components: [loginSuccessContainer]
				});
			} catch {
				console.log('Interaction expired during login success, sending DM');
				const successEmbed = new EmbedBuilder()
					.setColor(0x90EE90)
					.setTitle('✅ Login Successful')
					.setDescription('Successfully logged into your Sparx account. Loading...');
				await interaction.user.send({ embeds: [successEmbed] });
			} loginsSavedTemp[interaction.user.id] = login;

			// authTokenSparx[interaction.user.id] = sparxReader;

			const customIdParts = interaction.customId.split('_');
			const action = customIdParts[1];

			/*
			const userDisplayName = await sparxReader.getUserDisplayName() || 'User';
			const userInfo = await sparxReader.getUserInfo();
			*/

			const roleID = whatRole(await interaction.guild.members.fetch(interaction.user.id));
			const userRole = Object.keys(queueRanksPositions).find(key => queueRanksPositions[key] === roleID);

			let existingAccount = await checkAccount(interaction.user.id, userRole);

			if (action === 'homework' || action === 'false') { // start menu
				if (customIdParts[2] === 'maths') {
					const sparxMaths = new SparxMaths(token, login, cookies);
					// authTokenSparx[interaction.user.id] = sparxMaths;
					await mathsExecuter(interaction, sparxMaths, queueMaths, existingAccount);
				} else if (customIdParts[2] === 'science') {
					const sparxScience = new SparxScience(token, login, cookies);
					await scienceExecutor(interaction, sparxScience, queueScience, existingAccount);
				} else {
					const sparxReader = new SparxReader(token, login, cookies);
					await readerExecutor(interaction, sparxReader, queue, existingAccount);
				}
			}

		} else {
			const UserSettingsEmbeds = require('./settings/UserSettingsEmbeds.js');
			const settingEmbedInteraction = UserSettingsEmbeds.get(interaction.user.id);
			let UserSession = UserSessions.get(interaction.user.id); // Change both the setting embed and menu embed if it exists
			let platformRouter = 'science';
			if (interaction.customId.startsWith('sparxreader')) {
				platformRouter = 'reader';
			} else if (interaction.customId.startsWith('sparxmaths')) {
				platformRouter = 'maths';
			}

			if (!UserSession) {
				const accountData = await checkAccount(interaction.user.id);
				if (interaction.customId.startsWith('sparxreader')) {
					UserSession = accountData.sparx_reader_settings;
					UserSession.points = accountData.sparx_reader_settings.srp;
				} else if (interaction.customId.startsWith('sparxmaths')) {
				    UserSession = accountData.sparx_maths_settings;
				} else  {
					UserSession = accountData.sparx_science_settings;
				}

				UserSession.updateEmbed = () => {};
			}

			if (['sparxreader_wpmChange', 'sparxreader_mode', 'sparxreader_pointsChange'].includes(interaction.customId)) {

				if (interaction.customId === 'sparxreader_pointsChange') {
					const pointsString = interaction.fields.getTextInputValue('points');

					const points = Number(pointsString);

					if (Number.isNaN(points) || points <= 0 || points > 99999) {
						const exampleEmbed = new EmbedBuilder()
							.setColor(0xFF474D)
							.setTitle('Invalid SRP value')
							.setDescription('Sparx Reader Points must be a Number between 1-99999.');

						await interaction.followUp({ embeds: [exampleEmbed], flags: 64 });
						return;
					}

					if (UserSession.wpm < points && UserSession.wpm !== 0) {
						UserSession.wpm = points;
					}

					if (!UserSession) {
						const exampleEmbed = new EmbedBuilder()
							.setColor(0xFF474D)
							.setTitle('Session expired')
							.setDescription('Please start the Sparx Reader login again.');

						await interaction.followUp({ embeds: [exampleEmbed], flags: 64 });
					}

					UserSession.points = points;
				} else if (interaction.customId === 'sparxreader_wpmChange') {
					const wpmString = interaction.fields.getTextInputValue('wpm');

					const wpm = Number(wpmString);

					if (Number.isNaN(wpm) || (wpm < 200 && wpm !== 0)) {
						const exampleEmbed = new EmbedBuilder()
							.setColor(0xFF474D)
							.setTitle('Invalid WPM value')
							.setDescription('Words Per Minute must be a Number and be more than or equal to 200, or be set to 0 to make it read as fast as possible.');

						await interaction.followUp({ embeds: [exampleEmbed], flags: 64 });
						return;
					}

					if (wpm < UserSession.points && wpm !== 0) {
						UserSession.points = wpm;
					}

					if (!UserSession) {
						const exampleEmbed = new EmbedBuilder()
							.setColor(0xFF474D)
							.setTitle('Session expired')
							.setDescription('Please start the Sparx Reader login again.');

						await interaction.followUp({ embeds: [exampleEmbed], flags: 64 });
						return;
					}

					if (!UserSession) return;
					UserSession.wpm = wpm;
				}
				else if (interaction.customId === 'sparxreader_mode') {
					const modeType = interaction.fields.getField('type').values[0];

					UserSession.mode = modeType;
				}
				await updateDB(interaction.user.id, { sparx_reader_settings: { wpm: UserSession.wpm, srp: UserSession.points } });
				await UserSession.updateEmbed();
				if (interaction.customId !== 'sparxreader_mode') await updateSettingEmbedRouter(settingEmbedInteraction, platformRouter);
			}
			else if (['sparxmaths_pdf_settings', 'sparxmaths_independant_learning', 'sparxmaths_model_settings'].includes(interaction.customId)) {
				if (interaction.customId === 'sparxmaths_pdf_settings') {
					const question = (interaction.fields.getField('question').values[0]) === 'true';
					const working_out = (interaction.fields.getField('working_out').values[0]) === 'true';
					UserSession.pdfSettings = { question, working_out };
					await updateDB(interaction.user.id, { sparx_maths_settings: { min: UserSession.min, max: UserSession.max, pdfSettings: { question, working_out }, model: UserSession.model } });
					await UserSession.updateEmbed();
				    await updateSettingEmbedRouter(settingEmbedInteraction, platformRouter);
				}
				else if (interaction.customId === 'sparxmaths_independant_learning') {
					const code = interaction.fields.getTextInputValue('code');
					const curriculumId = interaction.fields.getField('curriculum').values[0];
					const level = Number(interaction.fields.getField('level').values[0]);
					console.log('Independant Learning', code);
					const sparxMaths = UserSession.sparxClass;
					try {

						const topicSummariesRequest = {
							"topicParent": curriculumId,
							"options": {
								"includeLearningPaths": true,
								"omitKeyQuestions": true,
								"omitTopicLinks": false,
								"includeAllQuestions": false,
								"includeQuestionLayoutJson": false,
								"includeSkillFlagsAndTags": false
							}
						};

						const topicSummaries = await sparxMaths.listTopicSummariesRequest(topicSummariesRequest);

						const foundTopic = topicSummaries.topicSummaries.find(topic => topic.topic.code === code);
						console.log(foundTopic);

						foundTopic.learningPaths.sort((a, b) => {
							return Number(a.level) - Number(b.level);
						});

						const specName = foundTopic.learningPaths[level - 1].specName;
						const learningUnitNames = foundTopic.learningPaths[level - 1].learningUnitNames;

						const packagesActive = {
							"curriculumName": curriculumId,
							"topicLevelName": specName,
							"objectiveNames": learningUnitNames
						};

						const packagesResponse = await sparxMaths.getPackagesIndependantLearning(packagesActive);
						const packageId = packagesResponse.packages[0].packageId;

						console.log(packageId);
						if (!packageId) {
							throw new Error('No Package ID');
						}

						UserSession.selectRow.setDisabled(true);
						await UserSession.updateEmbed(true);

						await queueMaths.addQueue({
							action: async () => {
								return await sparxMathsAutocomplete(interaction, packageId, sparxMaths, UserSession);
							},
							id: interaction.user.id,
							interaction: interaction
						});

						await interaction.followUp({ flags: 64, content: "You have been added to the queue" });
					} catch {
						await interaction.followUp({ flags: 64, content: "Invalid Code or an Error Occured" });
					}

				} else if (interaction.customId === 'sparxmaths_model_settings') {
					const modelOrder = interaction.fields.getField('model').values[0];
					UserSession.model = modelOrder;
					await updateDB(interaction.user.id, { sparx_maths_settings: { min: UserSession.min, max: UserSession.max, pdfSettings: UserSession.pdfSettings, model: modelOrder } });
					await UserSession.updateEmbed();
				    await updateSettingEmbedRouter(settingEmbedInteraction, platformRouter);
				}
			}
            else if (interaction.customId === 'sparxscience_model_settings') {
				const modelOrder = interaction.fields.getField('model').values[0];
				UserSession.model = modelOrder;
				await updateDB(interaction.user.id, { sparx_science_settings: { min: UserSession.min, max: UserSession.max, model: modelOrder } });
				await UserSession.updateEmbed();
				await updateSettingEmbedRouter(settingEmbedInteraction, platformRouter);
			}
			else if (interaction.customId.endsWith('_faketime')) { // sparxmaths_faketime
				const minTime = Number(interaction.fields.getTextInputValue('min_time'));
				const maxTime = Number(interaction.fields.getTextInputValue('max_time'));

				if (Number.isNaN(minTime) || minTime < 0 || minTime > 180 || Number.isNaN(maxTime) || maxTime < 0 || maxTime > 180 || minTime > maxTime) {
					const exampleEmbed = new EmbedBuilder()
						.setColor(0xFF474D)
						.setTitle('Invalid Fake Time')
						.setDescription('Both min and max fake time must be a number and between 0-180 and min cannot be larger than max.');

					await interaction.followUp({ embeds: [exampleEmbed], flags: 64 });
					return;
				}

				if (!UserSession) return;
				UserSession.min = minTime;
				UserSession.max = maxTime;

				if (interaction.customId.startsWith('sparxmaths')) {
					await updateDB(interaction.user.id, { sparx_maths_settings: { min: minTime, max: maxTime, pdfSettings: UserSession.pdfSettings, model: UserSession.model } });
				} else if (interaction.customId.startsWith('sparxscience')) {
					await updateDB(interaction.user.id, { sparx_science_settings: { min: minTime, max: maxTime, model: UserSession.model } });
				}

				await UserSession.updateEmbed();
				await updateSettingEmbedRouter(settingEmbedInteraction, platformRouter);
			}
		}
	} catch (err) {
		console.log(err);
		const container = new ContainerBuilder().setAccentColor(0x8B0000);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`# Hmm, looks like we ran into an error 🤒`).data,
			new TextDisplayBuilder().setContent(`Use the buttons below to share the error with us so we can fix it.`).data
		);

		logError(err, 'Unresolved', 'Execute Tasks');

		const shareBtn = new ButtonBuilder()
			.setCustomId('share_error')
			.setLabel('Share')
			.setStyle(ButtonStyle.Secondary);

		const shareLoginBtn = new ButtonBuilder()
			.setCustomId('share_error_login')
			.setLabel('Share with Login Details')
			.setStyle(ButtonStyle.Secondary);

		const row = new ActionRowBuilder().addComponents(shareBtn, shareLoginBtn);
		container.addActionRowComponents(row);

		const errorMsg = await interaction.user.send({
			components: [container]
		});

		// Try to infer context if available
		let context = { errorMessage: err.message || String(err) };
		try {
			// Basic attempt to recover login details if they exist in scope (this is hard due to scope)
			// We can check if `loginsSavedTemp[interaction.user.id]` exists
			const savedLogin = loginsSavedTemp[interaction.user.id];
			if (savedLogin) {
				context.loginDetails = savedLogin;
				context.loginType = savedLogin.loginType;
				context.platform = savedLogin.app || 'unknown';
			}
		} catch { }

		handleShareButton(interaction, errorMsg, context);
	}
}

module.exports = { executeTasks, loginsSavedTemp, UserSessions };