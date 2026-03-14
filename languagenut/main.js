const { MessageFlags, SeparatorSpacingSize, SeparatorBuilder, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { emojis, footerText, footerIcon } = require('../startEmbeds/info.js');
const userSessions = new Map();
const { checkAccount, updateDB, updateStats } = require('../database/accounts');
const { validAccount, useUpSlot } = require('../handlers/accountHandler');
const getProgressBar = require('../utils/getProgressBar');
const formatTime = require('../utils/formatTime');
const progressTracker = require('../utils/progressTracker');
const EMBED_COLOR = 0x11b6d4;

const HOMEWORKS_PER_PAGE = 5;

const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

const saveAccountBtn = new ButtonBuilder()
    .setCustomId('save_account_languagenut')
    .setLabel('Save Account')
    .setEmoji(emojis.save_account)
    .setStyle(ButtonStyle.Secondary);

async function getMenuEmbed(interaction, userSession, page, disabled = false) {
    await userSession.get_module_translations();
    await userSession.get_display_translations();

    const homeworks = await userSession.get_hwks();

    if (homeworks && homeworks.homework && homeworks.homework.length > 0) {
        const sortedHomeworks = homeworks.homework.sort((a, b) => new Date(b.set) - new Date(a.set));
        userSession.originalHomeworks = sortedHomeworks;
        userSession.currentPage = 0;
    }
    const allHomeworks = userSession.originalHomeworks;
    const totalPages = Math.ceil(allHomeworks.length / HOMEWORKS_PER_PAGE);
    const startIndex = page * HOMEWORKS_PER_PAGE;
    const endIndex = Math.min(startIndex + HOMEWORKS_PER_PAGE, allHomeworks.length);
    const pageHomeworks = allHomeworks.slice(startIndex, endIndex);

    userSession.homeworks = pageHomeworks;
    userSession.currentPage = page;

    const seperator = new SeparatorBuilder({
        spacing: SeparatorSpacingSize.Small
    });

    const section = new TextDisplayBuilder().setContent(`## 📚 Assignments\n${allHomeworks.length} assignments available • Page ${page + 1} of ${totalPages}\n`);

    // 3. Assemble everything into the main container
    const hwEmbed = new ContainerBuilder()
        .setAccentColor(EMBED_COLOR)
        .addTextDisplayComponents(
            section.data
        );

    const selectOptions = [];

    pageHomeworks.forEach((hw, index) => {
        const globalIndex = startIndex + index;
        const dueDateRaw = hw.due ? new Date(hw.due) : null;
        const dueDate = dueDateRaw && !isNaN(dueDateRaw.getTime()) ? `<t:${Math.floor(dueDateRaw.getTime() / 1000)}:R>` : 'No due date';
        // Calculate progress
        const percentages = [];
        for (const task of hw.tasks) {
            percentages.push(Number(task.gameResults?.percentage || 0));
        }
        const percentage = Math.round(avg(percentages)) || 0;
        const isCompleted = percentage === 100;

        // Enhanced status indicators
        let completionStatus;
        if (isCompleted) {
            completionStatus = '✅';
        } else if (percentage > 0) {
            completionStatus = '🔄';
        } else {
            completionStatus = '⭕';
        }

        hwEmbed.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${completionStatus} ${hw.name || `Assignment ${globalIndex + 1}`}\n📊 **Percentage:** ${percentage}%\n⏰ **Due:** ${dueDate}\n`)
        );

        const homeworkName = hw.name || `Assignment ${globalIndex + 1}`;

        let dueDateText = 'No due date';
        if (dueDateRaw && !isNaN(dueDateRaw.getTime())) {
            const now = new Date();
            const diffTime = dueDateRaw.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                dueDateText = `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago`;
            } else if (diffDays === 0) {
                dueDateText = 'Due today';
            } else if (diffDays === 1) {
                dueDateText = 'Due tomorrow';
            } else if (diffDays <= 7) {
                dueDateText = `Due in ${diffDays} days`;
            } else {
                dueDateText = `Due ${dueDateRaw.toLocaleDateString()}`;
            }
        }

        const label = homeworkName.length > 0 ? homeworkName.substring(0, 100) : `Assignment ${globalIndex + 1}`;

        const description = `${percentage}% complete • ${dueDateText}`.substring(0, 100) || 'No description';


        const value = `homework_${globalIndex}`;

        if (label.length >= 1 && description.length >= 1 && value.length >= 1) {
            selectOptions.push({
                label: label,
                description: description,
                value: value,
                emoji: completionStatus
            });
        }
    });

    const existingAccount = await checkAccount(interaction.user.id);
    userSession['settings'] = existingAccount.languagenut_settings;

    hwEmbed.addSeparatorComponents(
        seperator
    );

    hwEmbed.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`⚙️ Settings\n🎯 **Accuracy:** ${existingAccount.languagenut_settings.accuracy}%\n⏰ **Simulated Time:** ${existingAccount.languagenut_settings.min}-${existingAccount.languagenut_settings.max} Seconds Per Question (Not Homework)\n`)
    );

    const components = [];

    if (selectOptions.length > 0) {
        if (userSession.selectedHomeworkIndex !== undefined) {
            const matchingOption = selectOptions.find(opt => opt.value === `homework_${userSession.selectedHomeworkIndex}`);
            if (matchingOption) matchingOption.default = true;
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_homework')
            .setPlaceholder('Select assignment')
            .setMinValues(0)
            .setMaxValues(1)
            .addOptions(selectOptions)
            .setDisabled(disabled);

        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    const navigationButtons = [];
    if (userSession.selectedHomeworkIndex !== undefined) {
        const startButton = new ButtonBuilder()
            .setCustomId('start_languagenut')
            .setLabel('Start')
            .setEmoji(emojis.tick)
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled);
        navigationButtons.push(startButton);
    }

    const paginationButtons = [];
    paginationButtons.push(
        new ButtonBuilder()
            .setCustomId('set_accuracy')
            .setLabel('Accuracy')
            .setEmoji(emojis.stats)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
    );

    paginationButtons.push(
        new ButtonBuilder()
            .setCustomId('set_faketime')
            .setLabel('Simulated Time')
            .setEmoji(emojis.queue)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
    );

    const saveAccountBtnCopy = ButtonBuilder.from(saveAccountBtn);
    saveAccountBtnCopy.setDisabled(disabled);
    paginationButtons.push(saveAccountBtnCopy);

    if (page > 0) {
        paginationButtons.push(
            new ButtonBuilder()
                .setCustomId('homework_prev_page')
                .setLabel('Previous')
                .setEmoji(emojis.arrow_left)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled)
        );
    }

    if (page < totalPages - 1) {
        paginationButtons.push(
            new ButtonBuilder()
                .setCustomId('homework_next_page')
                .setLabel('Next')
                .setEmoji(emojis.arrow_right)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled)
        );
    }

    components.push(new ActionRowBuilder().addComponents(paginationButtons));
    if (navigationButtons.length > 0) {
        components.push(new ActionRowBuilder().addComponents(navigationButtons));
    }

    hwEmbed.addActionRowComponents(
        [...components]
    );

    userSession.hwEmbed = hwEmbed;

    return hwEmbed;
}

async function displayHomeworkPage(interaction, userSession, page) {
    const hwEmbed = await getMenuEmbed(interaction, userSession, page);

    await interaction.editReply({
        components: [hwEmbed],
        flags: MessageFlags.IsComponentsV2
    });

    userSession.hwMessage = interaction;
    userSession.hwEmbed = hwEmbed;
}

class task_completer {
    constructor(token, task, ietf, totalEstimatedTime, totalTasks, userId) {
        this.token = token;
        this.task = task;
        this.mode = this.get_task_type();
        this.to_language = ietf;
        this.homework_id = task.base[0];
        this.catalog_uid = task.catalog_uid || task.base[task.base.length - 1];
        this.rel_module_uid = task.rel_module_uid;
        this.game_uid = task.game_uid;
        this.game_type = task.type;
        this.userId = userId;
    }
    async get_data() {
        switch (this.mode) {
            case 'sentence':
                return await this.get_sentences();
            case 'verbs':
                return await this.get_verbs();
            case 'phonics':
                return await this.get_phonics();
            case 'exam':
                return await this.get_exam();
            default:
                return await this.get_vocabs();
        }
    }

    async logGameStart() {
        const logResponse = await this.call_lnut(
            "userDataController/triggerLogType",
            {
                typeof: 'PRE game 18',
                ownertype: 'Chrome+Windows+desktop',
                newPageTrigger: 'true',
                newPage: 'SentenceBuildingGame',
                languagenutTimeMarker: '1761853059685',
                lastLanguagenutTimeMarker: '1761853059685',
                apiVersion: '9',
                token: this.token,
            },
        );
        console.log(logResponse);
    }

    async logHomeworkStart() {
        const logResponse = await this.call_lnut(
            "userDataController/triggerLogType",
            {
                typeof: 'PRE HOMEWORK 18',
                ownertype: 'Chrome+Windows+desktop',
                languagenutTimeMarker: '1761852068969',
                lastLanguagenutTimeMarker: '1761852068969',
                apiVersion: '9',
                token: this.token,
            },
        );
        console.log(logResponse);
    }

    async logGameEnd() {
        const logResponse = await this.call_lnut(
            "userDataController/triggerLogType",
            {
                typeof: 'game 18',
                ownertype: 'Chrome+Windows+desktop',
                languagenutTimeMarker: Date.now(),
                lastLanguagenutTimeMarker: Date.now(),
                apiVersion: '9',
                token: this.token,
            },
        );
        console.log(logResponse);
    }

    async send_answers(correctVocabs, incorrectVocabs, timestampOffsets) {
        const isTeacherMarked = this.game_uid === "251" ||
            (this.task.gameResults && this.task.gameResults.percentage === null) ||
            this.task.teacherMarked === true;

        if (isTeacherMarked) {
            console.log(`\n⚠️ TEACHER-MARKED TASK DETECTED, SKIPPING`);
            return { status: 'skipped', reason: 'teacher-marked' };
        }

        const totalVocabs = correctVocabs.concat(incorrectVocabs);

        const data = {
            moduleUid: this.catalog_uid,
            gameUid: this.game_uid,
            gameType: this.game_type,
            isTest: true,
            toietf: this.to_language,
            fromietf: "en-US",
            score: correctVocabs.length * 200,
            correctVocabs: correctVocabs.map((x) => x).join(","),
            incorrectVocabs: incorrectVocabs.map((x) => x).join(","),
            homeworkUid: this.homework_id,
            isSentence: this.mode === "sentence",
            isALevel: false,
            isVerb: this.mode === "verbs",
            verbUid: this.mode === "verbs" ? this.catalog_uid : "",
            phonicUid: this.mode === "phonics" ? this.catalog_uid : "",
            sentenceScreenUid: this.mode === "sentence" ? 100 : "",
            sentenceCatalogUid: this.mode === "sentence" ? this.catalog_uid : "",
            grammarCatalogUid: this.catalog_uid,
            isGrammar: false,
            isExam: this.mode === "exam",
            correctStudentAns: "",
            incorrectStudentAns: "",
            vocabNumber: totalVocabs.length,
            rel_module_uid: this.rel_module_uid,
            dontStoreStats: true,
            product: "secondary",
            token: this.token,
        };

        const timeNow = Date.now();

        data.awrtfuoivg = String(timestampOffsets * 1000);

        data.languagenutTimeMarker = timeNow;
        data.lastLanguagenutTimeMarker = timeNow;

        try {

            const response = await this.call_lnut("gameDataController/addGameScore", data);

            if (response && (response.SUCCESS === true || response.changedPercentage === 100)) {
                return { status: 'success', response };
            } else {
                console.log(`❌ Task completion failed:`, response);
                return { status: 'error', response };
            }
        } catch (error) {
            console.error(`Error sending answers:`, error);
            return { status: 'error', error: error.message };
        }
    }

    async get_verbs() {
        const vocabs = await this.call_lnut(
            "verbTranslationController/getVerbTranslations",
            {
                verbUid: this.catalog_uid,
                toLanguage: this.to_language,
                fromLanguage: "en-US",
                token: this.token,
            },
        );
        return vocabs.verbTranslations;
    }
    async get_phonics() {
        const vocabs = await this.call_lnut("phonicsController/getPhonicsData", {
            phonicCatalogUid: this.catalog_uid,
            toLanguage: this.to_language,
            fromLanguage: "en-US",
            token: this.token,
        });
        return vocabs.phonics;
    }
    async get_sentences() {
        const vocabs = await this.call_lnut(
            "sentenceTranslationController/getSentenceTranslations",
            {
                catalogUid: this.catalog_uid,
                toLanguage: this.to_language,
                fromLanguage: "en-US",
                languagenutTimeMarker: Date.now(),
                lastLanguagenutTimeMarker: Date.now(),
                token: this.token,
            },
        );
        return vocabs.sentenceTranslations;
    }
    async get_exam() {
        const vocabs = await this.call_lnut(
            "examTranslationController/getExamTranslationsCorrect",
            {
                gameUid: this.game_uid,
                examUid: this.catalog_uid,
                toLanguage: this.to_language,
                fromLanguage: "en-US",
                token: this.token,
            },
        );

        // Add safety check for exam translations
        if (!vocabs || !vocabs.examTranslations) {
            console.log(`⚠️ ERROR: No exam translations returned:`, vocabs);
            return [];
        }

        return vocabs.examTranslations;
    }
    async get_vocabs() {
        const vocabs = await this.call_lnut(
            "vocabTranslationController/getVocabTranslations",
            {
                "catalogUid[]": this.catalog_uid,
                toLanguage: this.to_language,
                fromLanguage: "en-US",
                token: this.token,
            },
        );

        // Add safety check for vocab translations
        if (!vocabs || !vocabs.vocabTranslations) {
            console.log(`⚠️ ERROR: No vocab translations returned:`, vocabs);
            return [];
        }

        return vocabs.vocabTranslations;
    }

    async call_lnut(url, data) {
        const url_data = new URLSearchParams(data).toString();
        try {
            const response = await fetch(
                `https://api.languagenut.com/${url}?${url_data}`,
            );


            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                console.error('Received HTML instead of JSON - API may have changed');
                return { success: false, error: 'API returned HTML instead of JSON' };
            }

            const json = await response.json();
            if (json?.msg === 'doubleLogin') {
                console.log('doubleLogin detected, relogging in');
                const userSession = userSessions.get(this.userId);
                const dataLogin = await login_languagenut(userSession.login_details.email, userSession.login_details.password);
                this.token = dataLogin.newToken;
                data.token = dataLogin.newToken;
                return await this.call_lnut(url, data);
            }
            return json;
        } catch (error) {
            console.error(`API call error (${url}):`, error);
            return { success: false, error: error.message };
        }
    }
    get_task_type() {
        if (this.task.gameLink.includes("sentenceCatalog")) return "sentence";
        if (this.task.gameLink.includes("verbUid")) return "verbs";
        if (this.task.gameLink.includes("phonicCatalogUid")) return "phonics";
        if (this.task.gameLink.includes("examUid")) return "exam";
        return "vocabs";
    }
}

class client_application {
    constructor(userId) {
        this.userId = userId;
        this.token = null;
        this.module_translations = [];
        this.display_translations = [];
        this.homeworks = [];
        this.originalHomeworks = [];
        this.userInfo = null;
    }

    async call_lnut(url, data) {
        const url_data = new URLSearchParams(data).toString();
        const response = await fetch(
            `https://api.languagenut.com/${url}?${url_data}`,
        );
        const json = await response.json();
        if (json?.msg === 'doubleLogin') {
            console.log('doubleLogin detected, relogging in');
            const userSession = userSessions.get(this.userId);
            const dataLogin = await login_languagenut(userSession.login_details.email, userSession.login_details.password);

            this.token = dataLogin.newToken;
            data.token = dataLogin.newToken;
            return await this.call_lnut(url, data);
        }
        return json;
    }

    async get_display_translations() {
        this.display_translations = await this.call_lnut(
            "publicTranslationController/getTranslations",
            {},
        );
        this.display_translations = this.display_translations.translations;
    }

    async get_module_translations() {
        this.module_translations = await this.call_lnut(
            "translationController/getUserModuleTranslations",
            {
                token: this.token,
            },
        );
        this.module_translations = this.module_translations.translations;
    }

    async get_hwks() {
        const homeworks = await this.call_lnut(
            "assignmentController/getViewableAll",
            {
                token: this.token,
            },
        );
        this.originalHomeworks = homeworks.homework || [];
        return homeworks;
    }

    async get_data() {
        switch (this.mode) {
            case 'sentence':
                return await this.get_sentences();
            case 'verbs':
                return await this.get_verbs();
            case 'phonics':
                return await this.get_phonics();
            case 'exam':
                return await this.get_exam();
            default:
                return await this.get_vocabs();
        }
    }
    async do_hwks(interaction) { // IMPORTANT
        const homework = this.homeworks[0]; // We're now only processing one homework at a time

        // Add safety check for homework and tasks
        if (!homework) {
            throw new Error('No homework found to process.');
        }

        if (!homework.tasks || !Array.isArray(homework.tasks)) {
            throw new Error('Homework tasks are not available or invalid.');
        }

        const tasksInHomework = homework.tasks.length;
        const totalEstimatedTime = parseInt(homework.estimated_time) || 0;

        const cancel = new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setEmoji(emojis.x)
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder()
            .addComponents(cancel);

        const initialEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('LanguageNut Autocompleter')
            .setDescription(`\`Starting Questions...\``)
            .setFooter({ text: footerText, iconURL: footerIcon });

        const taskTimer = process.hrtime();
        let fakeTimeTotal = 0;
        /*
        initialEmbed.addFields({
            name: '\u200B',
            value: `> **Accuracy**: ${Math.round(accuracyTotal * 100)}%\n> **Time Spent**: ${formatTime((process.hrtime(taskTimer))[0])}\n> **Time Simulated**: ${formatTime(fakeTimeTotal)}`
        });
        */
        const getTimeField = function () {
            return `> **Time Spent**: ${formatTime((process.hrtime(taskTimer))[0])}\n> **Time Simulated**: ${formatTime(fakeTimeTotal)}`;
        };

        const progressUpdater = new progressTracker(interaction, getTimeField);
        let cancelled;
        let currentGroup = [];
        const sectionsProgress = [];
        for (const task of homework.tasks) {
            console.log(task);

            const progressEntry = {
                name: task.name,
                value: getProgressBar(Number(task.gameResults?.percentage || 0) / 100, 1)
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

        const userSession = userSessions.get(interaction.user.id);
        const minTime = userSession.settings.min;
        const maxTime = userSession.settings.max;
        const accuracySet = userSession.settings.accuracy / 100;

        for (let i = 0; i < homework.tasks.length; i++) {
            if (cancelled) break;
            const task = homework.tasks[i];
            await progressUpdater.updateEmbed(`Completing ${task.name}...`);
            const task_doer = new task_completer(
                this.token,
                task,
                homework.languageCode,
                totalEstimatedTime,
                tasksInHomework,
                interaction.user.id
            );

            const answers = await task_doer.get_data();

            const correctVocabs = [];
            const incorrectVocabs = [];
            let timestampOffset = 0;
            for (const answer of answers) {
                if (correctVocabs.length / answers.length < accuracySet) {
                    correctVocabs.push(answer.uid);
                } else {
                    incorrectVocabs.push(answer.uid);
                }
                timestampOffset += (Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime);
            }
            await task_doer.logGameStart();
            await task_doer.logHomeworkStart();
            await task_doer.send_answers(correctVocabs, incorrectVocabs, timestampOffset); // awrtfuoivg: '86935'
            await task_doer.logGameEnd();

            fakeTimeTotal += timestampOffset;
            await progressUpdater.updateProgressBar(i, correctVocabs.length / answers.length);
            this.token = task_doer.token;
        }

        await progressUpdater.updateEmbed(`Finished`);
        await progressUpdater.end();
        await updateStats(interaction.user.id, 'languagenut', fakeTimeTotal);
    }
}

async function languagenut_getUserInfo(token) {
    const loginResponse = await fetch('https://api.languagenut.com/userDataController/getUserData', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            token: token
        })
    });

    const data = await loginResponse.json();
    return data;

}

async function login_languagenut(username, password) {
    const loginResponse = await fetch('https://api.languagenut.com/loginController/attemptLogin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            username: username,
            pass: password
        })
    });

    const data = await loginResponse.json();
    return data;
}

async function languagenut_model_executor(interaction) {
    if (interaction.customId.startsWith('languagenut_login')) {
        try {
            const userId = interaction.user.id;
            let userSession = userSessions.get(userId);

            if (!userSession) {
                userSession = new client_application(userId);
                userSessions.set(userId, userSession);
            }

            let username;
            let password;

            if (interaction.customId === 'languagenut_login_modal') {
                username = interaction.fields.getTextInputValue('languagenut_username');
                password = interaction.fields.getTextInputValue('languagenut_password');
            } else if (interaction.customId === 'languagenut_login_account') {
                username = interaction.loginDetails.email;
                password = interaction.loginDetails.password;
            }

            // Defer only if this modal submit interaction hasn't been acknowledged yet
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: 64 });
            } else {
                console.warn('Modal submit interaction already acknowledged; skipping deferReply');
            }

            // Make the login API call
            const data = await login_languagenut(username, password);

            if (data.newToken) {
                userSession.token = data.newToken;
                userSession.userInfo = await languagenut_getUserInfo(data.newToken);

                userSession.login_details = { email: username, password, app: 'languagenut' };

                const section = new TextDisplayBuilder().setContent(`### ✅ Logged in successfully\nLogged into your LanguageNut account successfully! Loading...`);

                const container = new ContainerBuilder()
                    .setAccentColor(0x01a75b)
                    .addTextDisplayComponents(
                        section.data
                    );

                await interaction.editReply({
                    flags: 32768 | 64,
                    components: [container]
                });

                try {
                    // Display first page
                    const hwEmbed = await getMenuEmbed(interaction, userSession, 0);

                    const hwMessage = await interaction.editReply({
                        components: [hwEmbed],
                        flags: MessageFlags.IsComponentsV2
                    });

                    userSession.hwMessage = interaction;
                    userSession.hwEmbed = hwEmbed;

                    const collector = hwMessage.createMessageComponentCollector({
                        time: 600_000
                    });

                    collector.on('collect', async (interaction) => {
                        await button_executor(interaction, userSession.currentPage);
                    });

                    collector.on('end', async () => {
                        const hwEmbed = await getMenuEmbed(interaction, userSession, userSession.currentPage, true);

                        await interaction.editReply({
                            components: [hwEmbed],
                            flags: MessageFlags.IsComponentsV2
                        });
                    });

                } catch (error) {
                    console.error('Error fetching homework:', error);
                    const section = new TextDisplayBuilder().setContent(`### ⚠️ Fetch Error\nUnable to retrieve assignments. Please try again.`);

                    const container = new ContainerBuilder()
                        .setAccentColor(0xFF474D)
                        .addTextDisplayComponents(
                            section.data
                        );

                    await interaction.editReply({
                        flags: 32768 | 64,
                        components: [container]
                    });
                }
            } else {
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
            }
        } catch (error) {
            if (error.code === 40060 || error.code === 10062) {
                console.log(`Interaction timeout or already acknowledged, ignoring: ${error.code}`);
                return;
            }
            console.error('Error handling modal submission:', error);

            try {
                // Only try to respond if we haven't already responded
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'An error occurred whilst logging in. Please try again later.',
                        flags: 64
                    });
                } else if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({
                        content: 'An error occurred whilst logging in. Please try again later.',
                        flags: 64
                    });
                }
            } catch (replyError) {
                if (replyError.code === 40060 || replyError.code === 10062) return;
                console.error('Error handling modal submit interaction:', replyError);
            }
        }
    } else if (interaction.isModalSubmit() && interaction.customId === 'languagenut_set_accuracy' || interaction.customId === 'languagenut_set_faketime') {
        await interaction.deferUpdate();
        const userId = interaction.user.id;
        let userSession = userSessions.get(userId);
        if (interaction.customId === 'languagenut_set_accuracy') {
            const accuracy = Number(interaction.fields.getTextInputValue('accuracy'));
            if (isNaN(accuracy) || accuracy < 0 || accuracy > 100) {
                return;
            }
            userSession.settings.accuracy = accuracy;
        } else if (interaction.customId === 'languagenut_set_faketime') {
            const minTime = Number(interaction.fields.getTextInputValue('faketime_min'));
            const maxTime = Number(interaction.fields.getTextInputValue('faketime_max'));
            if (isNaN(minTime) || minTime < 0 || maxTime < 0 || isNaN(maxTime) || minTime > maxTime) {
                return;
            }
            userSession.settings.min = minTime;
            userSession.settings.max = maxTime;
        }
        await updateDB(interaction.user.id, { languagenut_settings: userSession.settings });
        const hwMessage = userSession.hwMessage;
        const hwEmbed = userSession.hwEmbed;
        hwEmbed.components[hwEmbed.components.length - 3].data.content = `⚙️ Settings\n🎯 **Accuracy:** ${userSession.settings.accuracy}%\n⏰ **Simulated Time:** ${userSession.settings.min}-${userSession.settings.max} Seconds Per Question (Not Homework)\n`;
        // userSession.hwEmbed.fields[]
        await hwMessage.editReply({
            components: [hwEmbed]
        });
    }

}

async function button_executor(interaction, page) {
    // if (!interaction.isButton() && !interaction.isStringSelectMenu()) return; // open_login_modal_languagenut help_login_modal_languagenut

    const userId = interaction.user.id;
    let userSession = userSessions.get(userId);

    if (interaction.isStringSelectMenu() && interaction.customId === 'select_homework') {

        const selectedHomeworkId = interaction.values[0];
        if (!selectedHomeworkId) {
            userSession.selectedHomeworkIndex = undefined;
        } else {
            const homeworkIndex = parseInt(selectedHomeworkId.split('_')[1]);
            userSession.selectedHomeworkIndex = homeworkIndex;
            userSession.homeworks = [userSession.originalHomeworks[homeworkIndex]];
        }

        await interaction.deferUpdate();
        await displayHomeworkPage(interaction, userSession, page);
        return;
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'start_languagenut') {
            await interaction.deferUpdate();
            await displayHomeworkPage(interaction, userSession, page, true);

            try {
                userSession.isDoingHomework = true;
                if (await useUpSlot(interaction, 'languagenut', userSession.userInfo.userUid)) return;
                await userSession.do_hwks(interaction);
                const hwEmbed = await getMenuEmbed(interaction, userSession, page);
                await interaction.editReply({
                    components: [hwEmbed],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (error) {
                console.error('Error doing homework:', error);

                let errorMessage = `An error occurred while doing the homework: ${error.message}`;
                if (error.message.includes('not found in the embed')) {
                    errorMessage += '\n\nThis might be due to a page refresh or session issue. Please try logging in again.';
                }

                await interaction.followUp({
                    content: errorMessage,
                    flags: 64
                });
            } finally {
                userSession.isDoingHomework = false;
                userSession.selectedHomeworkIndex = undefined;
                await displayHomeworkPage(interaction, userSession, page);
            }
            return;
        }

        if (interaction.customId === 'homework_next_page' || interaction.customId === 'homework_prev_page') {
            const totalPages = Math.ceil(userSession.originalHomeworks.length / HOMEWORKS_PER_PAGE);
            let newPage = userSession.currentPage;

            if (interaction.customId === 'homework_next_page' && newPage < totalPages - 1) {
                newPage++;
            } else if (interaction.customId === 'homework_prev_page' && newPage > 0) {
                newPage--;
            }

            try {
                await interaction.deferUpdate();
            } catch (error) {
                if (error.code === 10062 || error.code === 40060) {
                    console.log('Interaction timeout or already acknowledged, ignoring:', error.code);
                    return;
                }
                throw error;
            }
            await displayHomeworkPage(interaction, userSession, newPage);
        } else if (interaction.customId === 'set_accuracy' || interaction.customId === 'set_faketime') {
            const modal = new ModalBuilder()
                .setCustomId(`languagenut_${interaction.customId}`)
                .setTitle(`${interaction.customId === 'set_accuracy' ? 'Accuracy' : 'Simulated Time'} Setting`);

            if (interaction.customId === 'set_accuracy') {
                const input = new TextInputBuilder()
                    .setCustomId('accuracy')
                    .setLabel('Accuracy')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('100')
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
            } else {
                const minTime = new TextInputBuilder()
                    .setCustomId('faketime_min')
                    .setLabel('Simulated Time Minimum')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                const maxTime = new TextInputBuilder()
                    .setCustomId('faketime_max')
                    .setLabel('Simulated Time Maximum')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(minTime));
                modal.addComponents(new ActionRowBuilder().addComponents(maxTime));
            }
            await interaction.showModal(modal);
        } else if (interaction.customId === 'save_account_languagenut') {
            const modal = new ModalBuilder()
                .setCustomId(`save_account_languagenut`)
                .setTitle(`Save Account`);
            const input = new TextInputBuilder()
                .setCustomId('master_password')
                .setLabel('Master Password')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
        return;
    }
};

async function languagenut_collector(message_sent) {
    const collector = message_sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
    });

    collector.on('collect', async (interaction) => {
        // Check if user has required roles (using the same roles as defined in main index.js)

        if (await validAccount(interaction, 'languagenut')) return;

        // We no longer update the original persistent message here, so multiple users can press login at once.



        const loginBtn = new ButtonBuilder()
            .setCustomId("languagenut_login")
            .setLabel('Login')
            .setEmoji(emojis.login)
            .setStyle(ButtonStyle.Success);

        const savedBtn = new ButtonBuilder()
            .setCustomId("languagenut_savedAccounts_view")
            .setLabel('Saved Accounts')
            .setEmoji(emojis.accounts)
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(loginBtn, savedBtn);

        const seperator = new SeparatorBuilder({
            spacing: SeparatorSpacingSize.Small
        });

        const section = new TextDisplayBuilder().setContent(`### LanguageNut Login\nLogin by simply inputting your username and password or choosing a saved account!`);

        // 3. Assemble everything into the main container
        const container = new ContainerBuilder()
            .setAccentColor(0x11b6d4)
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
                    if (componentInteraction.customId === 'languagenut_login') {
                        const modal = new ModalBuilder()
                            .setCustomId('languagenut_login_modal')
                            .setTitle('LanguageNut Login');

                        // Add input components to the modal
                        const usernameInput = new TextInputBuilder()
                            .setCustomId('languagenut_username')
                            .setLabel('Username')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                        const passwordInput = new TextInputBuilder()
                            .setCustomId('languagenut_password')
                            .setLabel('Password')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);


                        // Create action rows to hold the inputs
                        const usernameRow = new ActionRowBuilder().addComponents(usernameInput);
                        const passwordRow = new ActionRowBuilder().addComponents(passwordInput);

                        // Add the action rows to the modal
                        modal.addComponents(usernameRow, passwordRow);

                        await componentInteraction.showModal(modal);
                    } else if (componentInteraction.customId === 'languagenut_savedAccounts_view') {
                        const { handleSavedAccounts } = require('../handlers/savedAccountsHandler');
                        await handleSavedAccounts(componentInteraction, componentInteraction.customId.split('_')[2], 'languagenut');
                    }
                } catch (error) {
                    if (error.code === 40060 || error.code === 10062) return;
                    console.error('Error in LanguageNut inner collector:', error);
                }

            });
        } catch (error) {
            if (error.code === 40060 || error.code === 10062) return;
            console.error('Error in LanguageNut collector:', error);
        }
    });

}

module.exports = { languagenut_collector, languagenut_model_executor, userSessions, login_languagenut, languagenut_getUserInfo };