const { StringSelectMenuOptionBuilder, LabelBuilder, SeparatorSpacingSize, SeparatorBuilder, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { emojis, footerText, footerIcon } = require('../startEmbeds/info.js');
const getProgressBar = require('../utils/getProgressBar');
const formatTime = require('../utils/formatTime');
const userSessions = {};
const { checkAccount, updateDB, updateStats } = require('../database/accounts');
const { senecaLogin } = require('./puppeteer');
const { DynamicSessionGenerator } = require('./parser');
const progressTracker = require('../utils/progressTracker');
const dueDate = require('../utils/dueDate');
const axios = require('axios');
const { useUpSlot, validAccount } = require('../handlers/accountHandler');
const WebSocket = require('ws');
const config = require('../config.json');
const puppetQueue = require('../queues/puppeteerQueue.js');
const crypto = require('crypto');

const EMBED_COLOR = 0x3574cf;

const seperator = new SeparatorBuilder({
    spacing: SeparatorSpacingSize.Small
});

const saveAccountBtn = new ButtonBuilder()
    .setCustomId('save_account')
    .setLabel('Save Account')
    .setEmoji(emojis.save_account)
    .setStyle(ButtonStyle.Secondary);

function generateUUID() {
    return crypto.randomUUID();
}

class senecaAutocompleter {
    constructor(interaction, authToken, timeSettings, login) {
        this.interaction = interaction;
        this.authToken = authToken;
        this.timeSettings = timeSettings ?? { min: 0, max: 0 };
        this.login = login;
        this.select;
        this.assignements;
        this.sessionId;
        this.userId;
        this.mainMenuSection = this.createMainMenu();
    }

    createMainMenu() {
        return new TextDisplayBuilder().setContent(`### Seneca Homework Selection\nSelect one of the homeworks below and it will automatically be completed for you!\n\n**❓ What is Simulated Time?**\nSimulated Time is the amount of time the bot simulate completing for each question. This is **PER QUESTION**, not per homework. Recommended time is 60-90 Seconds per question.\n\n**⏰ Simulated Time**: ${this.timeSettings.min}-${this.timeSettings.max} Seconds Per Question`);
    }

    async startSession(courseId, sectionId) {
        this.sessionId = generateUUID();
        const url = `wss://session-ws.app.senecalearning.com/?access-key=${this.authToken}&sessionId=${this.sessionId}`;

        const ws = await new Promise((resolve, reject) => {
            const socket = new WebSocket(url, {
                headers: {
                    'Origin': 'https://app.senecalearning.com',
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            socket.on('open', () => resolve(socket));
            socket.on('error', (err) => reject(err));
        });

        // Send message
        ws.send(JSON.stringify({
            action: "start-session",
            data: {
                userId: this.userId,
                sessionId: this.sessionId,
                courseId,
                sectionId
            }
        }));
    }

    async post(url, body = {}, attempts = 3) {
        try {

            const response = await axios.request({
                url: url,
                method: 'POST',
                headers: {
                    accept: '*/*',
                    'accept-language': 'en-GB,en;q=0.9,en-US;q=0.8',
                    'access-key': this.authToken,
                    'content-type': 'application/json',
                    correlationid: '1763233862854::4c3cc314-bc1f-4c34-a16b-2f8056a93e76',
                    origin: 'https://app.senecalearning.com',
                    priority: 'u=1, i',
                    referer: 'https://app.senecalearning.com/',
                    'sec-ch-ua': '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-site',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
                    'user-region': 'GB',
                    'x-amz-date': '20251115T191102Z'
                },
                data: body // pass the request body here
            });

            return response.data; // only the response body
        } catch (err) {
            console.log('Error occured with senca');
            if (attempts) {
                await new Promise(res => setTimeout(res, 5000));
                return await this.post(url, body, attempts - 1);
            } else {
                throw err;
            }
        }
    }

    async get(url, params = {}, attempts = 3) {

        try {

            const response = await axios.get(url, {
                params: params,
                headers: {
                    accept: '*/*',
                    'accept-language': 'en-GB,en;q=0.9,en-US;q=0.8',
                    'access-key': this.authToken,
                    'content-type': 'application/json',
                    correlationid: '1763233862854::4c3cc314-bc1f-4c34-a16b-2f8056a93e76',
                    origin: 'https://app.senecalearning.com',
                    priority: 'u=1, i',
                    referer: 'https://app.senecalearning.com/',
                    'sec-ch-ua': '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-site',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
                    'user-region': 'GB',
                    'x-amz-date': '20251115T191102Z'
                }
            });

            return response.data; // only the response body
        } catch (err) {
            console.log('Error occured with senca');
            if (attempts) {
                await new Promise(res => setTimeout(res, 5000));
                return await this.get(url, params, attempts - 1);
            } else {
                throw err;
            }
        }
    }

    getButtons(disabled = false) {
        const setTimeBtn = new ButtonBuilder()
            .setCustomId('set_time')
            .setLabel('Set Time')
            .setEmoji(emojis.queue)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled);

        const saveAccountBtnCopy = ButtonBuilder.from(saveAccountBtn);
        saveAccountBtnCopy.setDisabled(disabled);
        return (new ActionRowBuilder().addComponents(setTimeBtn, saveAccountBtnCopy));
    }

    async autoComplete(courseId, sectionIds, sectionStats) {
        const cancel = new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setEmoji(emojis.x)
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder()
            .addComponents(cancel);

        const initialEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('Seneca Autocompleter')
            .setDescription(`\`Starting Questions...\``)
            .setFooter({ text: footerText, iconURL: footerIcon });

        const taskInfos = [];
        const sectionsProgress = [];
        let currentGroup = [];

        for (const sectionId of sectionIds) {
            const section = sectionStats.find(item => item.sectionId === sectionId) ?? { sectionId: sectionId, bestScore: 0 };

            const contentsUrl = await this.get(`https://course.app.senecalearning.com/api/courses/${courseId}/signed-url?sectionId=${sectionId}&contentTypes=standard,hardestQuestions`, {
                "sectionId": sectionId,
                "contentTypes": "standard"
            });

            const taskInfo = await this.get(contentsUrl.url);
            taskInfos.push(taskInfo);

            const progressEntry = {
                name: taskInfo.title,
                value: getProgressBar(section.bestScore, 1)
            };

            // Push into current group
            currentGroup.push(progressEntry);

            // If group reaches 5, push it to the main array and start new group
            if (currentGroup.length === 5) {
                sectionsProgress.push(currentGroup);
                currentGroup = [];
            }
        }

        if (currentGroup.length > 0) {
            sectionsProgress.push(currentGroup);
        }

        let cancelled = false;
        const getTimeField = function () {
            return `> **Time Spent**: ${formatTime((process.hrtime(this.taskTimer))[0])}\n> **Time Simulated**: ${formatTime(this.totalSeconds)}`;
        };

        const progressUpdater = new progressTracker(this.interaction, getTimeField);
        if (await progressUpdater.start(initialEmbed, row, sectionsProgress)) return;

        const collector = progressUpdater.targetMessage.createMessageComponentCollector({
            componentType: ComponentType.Button
        });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();
            if (interaction.customId === 'cancel') {
                cancelled = true;

                await progressUpdater.updateEmbed(`Cancelling...`);
            }
        });

        for (const [index, taskInfo] of taskInfos.entries()) {
            if (cancelled) break;
            await progressUpdater.updateEmbed(`Answering Questions for ${taskInfo.title}...`);
            await this.startSession(courseId, taskInfo.id);

            const timeQuestions = [];
            let fakeTime = 0;
            for (let i = 0; i < 5; i++) {
                const timeTaken = Math.floor(Math.random() * (this.timeSettings.max - this.timeSettings.min + 1)) + this.timeSettings.min;
                timeQuestions.push(timeTaken);
                if (i === 1 || i === 2 || i === 4) {
                    fakeTime += timeTaken;
                }
            }

            const generator = new DynamicSessionGenerator(taskInfo);

            const answerData = generator.generate({
                userId: this.userId,
                sessionId: this.sessionId,
                durations: timeQuestions
            });

            await this.post('https://session.app.senecalearning.com/api/session', answerData);

            progressUpdater.totalSeconds += fakeTime;
            await progressUpdater.updateProgressBar(index, 1);
        }

        if (cancelled) {
            await progressUpdater.updateEmbed(`Cancelled`);
        } else {
            await progressUpdater.updateEmbed(`Finished`);
        }

        await updateStats(this.interaction.user.id, 'seneca', progressUpdater.totalSeconds);
        await progressUpdater.end();

    }

    async mainMenu(select = null, assignements = this.assignements, disabled = false) {
        if (select === null) {
            const validCount = assignements.items.filter(a => a.status !== 'COMPLETE').length;
            select = new StringSelectMenuBuilder()
                .setCustomId('homework')
                .setPlaceholder('Choose a homework')
                .setMinValues(0)
                .setMaxValues(Math.min(config.max_homework_selection?.seneca || 6, validCount || 1));
        }
        if (!select.options.length) {
            for (const assignment of assignements.items) {
                if (assignment.status === 'COMPLETE') {
                    continue; // ${Math.round(quiz.correctCount / quiz.questionCount * 100)}% • 
                }
                const option = new StringSelectMenuOptionBuilder()
                    .setLabel(assignment.name)
                    .setDescription(`${dueDate(new Date(assignment.dueDate))}`)
                    .setValue(assignment.id);

                select.addOptions(option);
            }
        }

        const selectRow = new ActionRowBuilder().addComponents(select);

        const container = new ContainerBuilder()
            .setAccentColor(EMBED_COLOR)
            .addTextDisplayComponents(
                this.createMainMenu().data
            );

        container.addSeparatorComponents(
            seperator
        );

        if (selectRow.components[0].options.length) {
            container.addActionRowComponents(
                selectRow
            );
        }

        container.addActionRowComponents(
            this.getButtons(disabled)
        );

        this.select = select;

        this.mainMenuSection = this.createMainMenu();

        const message_sent = await this.interaction.editReply({
            flags: 32768 | 64,
            components: [container]
        });

        return message_sent;
    }

    async main() {
        const userInfo = await this.get('https://user-info.app.senecalearning.com/api/user-info/me');
        this.userId = userInfo.userId;
        const assignements = await this.get('https://assignments.app.senecalearning.com/api/students/me/assignments', {
            limit: '100',
            date: '11/01/2025',
            archived: 'false'
        });
        this.assignements = assignements;
        let select = new StringSelectMenuBuilder()
            .setCustomId('homework')
            .setPlaceholder('Choose a homework')
            .setMinValues(0);

        const message_sent = await this.mainMenu(select, assignements);

        const collector = message_sent.createMessageComponentCollector({
            time: 300_000
        });

        collector.on('collect', async (componentInteraction) => {
            if (componentInteraction.isStringSelectMenu()) {
                await componentInteraction.deferUpdate();

                const disabledSelect = new StringSelectMenuBuilder()
                    .setCustomId('homework')
                    .setPlaceholder('Choose a homework')
                    .setMinValues(0);

                for (const assignment of assignements.items) {
                    if (assignment.status === 'COMPLETE') {
                        continue; // ${Math.round(quiz.correctCount / quiz.questionCount * 100)}% • 
                    }
                    const option = new StringSelectMenuOptionBuilder()
                        .setLabel(assignment.name)
                        .setDescription(`${dueDate(new Date(assignment.dueDate))}`)
                        .setValue(assignment.id);

                    if (componentInteraction.values.includes(assignment.id)) {
                        option.setDefault(true);
                    }

                    disabledSelect.addOptions(option);
                }

                const container = new ContainerBuilder()
                    .setAccentColor(EMBED_COLOR)
                    .addTextDisplayComponents(
                        this.mainMenuSection.data
                    )
                    .addSeparatorComponents(
                        seperator
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(disabledSelect),
                        this.getButtons(true)
                    );

                if (componentInteraction.values && componentInteraction.values.length > 0) {
                    const startButton = new ButtonBuilder()
                        .setCustomId('start_seneca')
                        .setLabel('Start')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(emojis.tick);

                    container.addActionRowComponents(
                        new ActionRowBuilder().addComponents(startButton)
                    );
                }

                select = disabledSelect;

                this.selectedHomeworkValues = componentInteraction.values;

                await componentInteraction.editReply({
                    components: [container]
                });
            } else if (componentInteraction.isButton()) {
                if (componentInteraction.customId === 'start_seneca') {
                    if (!this.selectedHomeworkValues || this.selectedHomeworkValues.length === 0) return;
                    await componentInteraction.deferUpdate();

                    // Re-render menu as disabled
                    const homeworkTask = assignements.items.find(item => item.id === this.selectedHomeworkValues[0]);
                    const courseId = homeworkTask.spec.courseId;

                    const disabledSelect = new StringSelectMenuBuilder()
                        .setCustomId('homework_disabled')
                        .setPlaceholder('Choose a homework')
                        .setDisabled(true);

                    for (const assignment of assignements.items) {
                        if (assignment.status === 'COMPLETE') continue;
                        const option = new StringSelectMenuOptionBuilder()
                            .setLabel(assignment.name)
                            .setDescription(`${dueDate(new Date(assignment.dueDate))}`)
                            .setValue(assignment.id);

                        if (this.selectedHomeworkValues.includes(assignment.id)) {
                            option.setDefault(true);
                        }
                        disabledSelect.addOptions(option);
                    }

                    const startButton = new ButtonBuilder()
                        .setCustomId('start_seneca')
                        .setLabel('Start')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(emojis.tick)
                        .setDisabled(true);

                    const containerObj = new ContainerBuilder()
                        .setAccentColor(EMBED_COLOR)
                        .addTextDisplayComponents(this.mainMenuSection.data)
                        .addSeparatorComponents(seperator)
                        .addActionRowComponents(
                            new ActionRowBuilder().addComponents(disabledSelect),
                            this.getButtons(true),
                            new ActionRowBuilder().addComponents(startButton)
                        );

                    await componentInteraction.editReply({
                        components: [containerObj]
                    });

                    if (await useUpSlot(this.interaction, 'seneca', this.userId)) return;
                    await this.autoComplete(courseId, homeworkTask.spec.sectionIds, homeworkTask.sectionStats);
                } else if (componentInteraction.customId === 'save_account') {
                    const modal = new ModalBuilder()
                        .setCustomId(`save_account_seneca`)
                        .setTitle(`Save Account`);
                    const input = new TextInputBuilder()
                        .setCustomId('master_password')
                        .setLabel('Master Password')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await componentInteraction.showModal(modal);
                } else if (componentInteraction.customId === 'set_time') {
                    const modal = new ModalBuilder()
                        .setCustomId(`seneca_set_time`)
                        .setTitle(`Set Time`);
                    const input = new TextInputBuilder()
                        .setCustomId('time_min')
                        .setLabel('Time Min')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('0-180')
                        .setRequired(true);
                    const input1 = new TextInputBuilder()
                        .setCustomId('time_max')
                        .setLabel('Time Max')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('0-180')
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(input), new ActionRowBuilder().addComponents(input1));
                    await componentInteraction.showModal(modal);
                }
            }
        });

        collector.on('end', async () => {
            select.setDisabled(true);
            await this.mainMenu(select, assignements, true);
        });
    }
}

async function seneca_model_executor(interaction) {
    if (interaction.customId.startsWith('seneca_login')) {
        let username;
        let password;
        let loginType;

        if (interaction.customId === 'seneca_login_modal') {
            await interaction.deferReply({ flags: 64 });
            username = interaction.fields.getTextInputValue('seneca_username');
            password = interaction.fields.getTextInputValue('seneca_password');
            loginType = interaction.fields.getField('type').values[0];
        } else if (interaction.customId === 'seneca_login_account') {
            username = interaction.loginDetails.email;
            password = interaction.loginDetails.password;
            loginType = interaction.loginDetails.loginType;
        }

        const Loadingsection = new TextDisplayBuilder().setContent(`### Logging In... :hourglass:\nAttempting to log in to your account...`);

        const Loadingcontainer = new ContainerBuilder()
            .setAccentColor(EMBED_COLOR)
            .addTextDisplayComponents(
                Loadingsection.data
            );

        await interaction.editReply({
            components: [Loadingcontainer],
            flags: 32768 | 64
        });

        const authToken = await puppetQueue.add(() =>
            senecaLogin(username, password, loginType)
        );
        if (!authToken || authToken.length < 50) {
            const section = new TextDisplayBuilder().setContent(`### ❌ Login Failed\nUnable to Login. Please check your login details and try again.`);

            const container = new ContainerBuilder()
                .setAccentColor(0xFF474D)
                .addTextDisplayComponents(
                    section.data
                );

            await interaction.editReply({
                flags: 32768 | 64,
                components: [container]
            });
            return;
        }

        const loginSuccessSection = new TextDisplayBuilder().setContent(`### ✅ Login Successful\nSuccessfully logged into your Seneca account. Loading...`);

        const loginSuccessContainer = new ContainerBuilder()
            .setAccentColor(0x90EE90)
            .addTextDisplayComponents(
                loginSuccessSection.data
            );

        await interaction.editReply({
            flags: 32768 | 64,
            components: [loginSuccessContainer]
        });

        const timeSettings = (await checkAccount(interaction.user.id)).seneca_settings;

        const senecaAuto = new senecaAutocompleter(interaction, authToken, timeSettings, { email: username, password, loginType, app: 'seneca' });
        userSessions[interaction.user.id] = senecaAuto;

        await senecaAuto.main();
    } else if (interaction.customId === 'seneca_set_time') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const minTime = Number(interaction.fields.getTextInputValue('time_min'));
        const maxTime = Number(interaction.fields.getTextInputValue('time_max'));
        if (isNaN(minTime) || minTime < 0 || maxTime < 0 || isNaN(maxTime) || minTime > maxTime || maxTime > 180) {
            return;
        }
        const userSession = userSessions[interaction.user.id];
        await updateDB(interaction.user.id, { seneca_settings: { min: minTime, max: maxTime } });
        userSession.timeSettings = { min: minTime, max: maxTime };
        await userSession.mainMenu();
    }

}


async function seneca_collector(message_sent) {

    const collector = message_sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
    });

    collector.on('collect', async (interaction) => {
        // Check if user has required roles (using the same roles as defined in main index.js)

        if (await validAccount(interaction, 'seneca')) return;

        const loginBtn = new ButtonBuilder()
            .setCustomId("seneca_login")
            .setLabel('Login')
            .setEmoji(emojis.login)
            .setStyle(ButtonStyle.Success);

        const savedBtn = new ButtonBuilder()
            .setCustomId("seneca_savedAccounts_view")
            .setLabel('Saved Accounts')
            .setEmoji(emojis.accounts)
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(loginBtn, savedBtn);

        const seperator = new SeparatorBuilder({
            spacing: SeparatorSpacingSize.Small
        });

        const section = new TextDisplayBuilder().setContent(`### Seneca Login\nLogin by simply inputting your username and password or choosing a saved account!`);

        // 3. Assemble everything into the main container
        const container = new ContainerBuilder()
            .setAccentColor(EMBED_COLOR)
            .addTextDisplayComponents(
                section.data
            )
            .addSeparatorComponents(
                seperator
            )
            .addActionRowComponents(
                row
            );

        try {
            const message_sent = await interaction.reply({
                flags: 32768 | 64,
                components: [container],
                fetchReply: true
            });

            const collector = message_sent.createMessageComponentCollector({
                componentType: ComponentType.Button
            });

            collector.on('collect', async (componentInteraction) => {
                try {
                    if (componentInteraction.customId === 'seneca_login') {

                        const modal = new ModalBuilder()
                            .setCustomId('seneca_login_modal')
                            .setTitle('Seneca Login');

                        // Add input components to the modal
                        const usernameInput = new TextInputBuilder()
                            .setCustomId('seneca_username')
                            .setLabel('Email')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                        const passwordInput = new TextInputBuilder()
                            .setCustomId('seneca_password')
                            .setLabel('Password')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                        const typeInput = new StringSelectMenuBuilder()
                            .setCustomId('type')
                            .setPlaceholder("Normal/Microsoft/Google")
                            .addOptions(
                                { label: "Normal", value: "Normal", emoji: emojis.sparx },
                                { label: "Microsoft", value: "Microsoft", emoji: emojis.microsoft },
                                { label: "Google", value: "Google", emoji: emojis.google }
                            );

                        // Create action rows to hold the inputs
                        const usernameRow = new ActionRowBuilder().addComponents(usernameInput);
                        const passwordRow = new ActionRowBuilder().addComponents(passwordInput);
                        const typeLabel = new LabelBuilder({
                            label: 'Login Type',
                            component: typeInput
                        });

                        // Add the action rows to the modal
                        modal.addComponents(usernameRow, passwordRow);
                        modal.addLabelComponents(typeLabel);

                        await componentInteraction.showModal(modal);
                    } else if (componentInteraction.customId === 'seneca_savedAccounts_view') {
                        const { handleSavedAccounts } = require('../handlers/savedAccountsHandler');
                        await handleSavedAccounts(componentInteraction, componentInteraction.customId.split('_')[2], 'seneca');
                    }
                } catch (error) {
                    if (error.code === 40060 || error.code === 10062) return;
                    console.error('Error in Seneca inner collector:', error);
                }
            });
        } catch (error) {
            if (error.code === 40060 || error.code === 10062) return;
            console.error('Error in Seneca collector:', error);
        }

    });
}

module.exports = { seneca_collector, seneca_model_executor, userSessions, senecaAutocompleter };