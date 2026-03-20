const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');
const { emojis, footerText, footerIcon } = require('../startEmbeds/info.js');
const fakeTimeSetting = {};
const { parser, getQuestionObject } = require('./parser');
const path = require('path');
const fs = require('fs');
const { addToDb, checkAnswer, deleteAnswer, getFailedQuestion, addFailedQuestion, updateFailedQuestions } = require('../database/science.js');
const { logError } = require('../utils/errorLogger.js');
const progressTracker = require('../utils/progressTracker.js');
const formatTime = require('../utils/formatTime');
const getProgressBar = require('../utils/getProgressBar');
const getAIanswer = require('../utils/getAIanswer.js');
const logger = require('../utils/logger.js');
const { updateStats } = require('../database/accounts.js');
const { ai } = require('../config.json');
const { checkAccount } = require('../database/accounts.js');
const convertAItoObject = require('../utils/convertAItoObject.js');
const isHigherModel = require('../utils/isHighestModel.js');

class sparxScienceAutocompleter {
    constructor(sparxScience, interaction) {
        this.sparxScience = sparxScience;
        this.interaction = interaction;
    }

    async answerQuestion(answerObject) {
        console.log(answerObject);
        const questionResponse = await this.sparxScience.answerQuestion(answerObject);
        return questionResponse;
    }

    async readyQuestion(activity, token) {
        const questionResponse = await this.sparxScience.readyQuestion(activity, token);
        return questionResponse?.activity?.state?.token;
    }

}

async function sparxScienceAutocomplete(interaction, packageID, sparxScience, fakeTime) {
    const apikey = (await checkAccount(interaction.user.id)).apikey;
    const ai = convertAItoObject(fakeTime.model);
    const log = new logger(`logs/sparx_science/${interaction.user.id}.txt`);
    sparxScience.log = log;
    log.logToFile('Logging Start');
    log.logToFile(`**Settings**\nFaketime Min: ${fakeTime.min}\nFaktime Max: ${fakeTime.max}`);
    fakeTimeSetting[interaction.user.id] = { min: fakeTime.min, max: fakeTime.max, total: 0 };

    const { queueScience } = require('../queues/queue');

    const taskTimer = process.hrtime();

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setEmoji(emojis.x)
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder()
        .addComponents(cancel);

    const sparxScienceExecuter = new sparxScienceAutocompleter(sparxScience, interaction);

    const initialEmbed = new EmbedBuilder()
        .setColor('#1d9b8f')
        .setTitle('Sparx Science Autocompleter')
        .setDescription(`\`Starting Questions...\``);

    const getTimeField = function () {
        return `> **Time Spent**: ${formatTime((process.hrtime(taskTimer))[0])}`;
    };
    const progressUpdater = new progressTracker(interaction, getTimeField);

    try {

        let homeworkTasks = await sparxScience.getTaskItems(packageID);
        if ((homeworkTasks.package.contents.tasks.length === 0)) {
            await sparxScience.generateTaskItems(packageID);
            homeworkTasks = await sparxScience.getTaskItems(packageID);
        }

        const sectionsProgress = [];
        const tasksScores = [];
        let currentGroup = [];
        for (const task of homeworkTasks.package.contents.tasks) {
            let totalCorrect = 0;
            let total;
            if (task.type === 'flashcards') {
                let correct = task?.state?.completion?.progress?.C ?? 0;
                let halfCorrect = task?.state?.completion?.progress?.FNR ?? 0;
                totalCorrect = correct + (halfCorrect * 0.5);
                total = task?.state?.completion?.size ?? 10;
            } else {
                totalCorrect = 0;
                total = task.contents.skillsTask.taskItems.length;
                for (const skillTask of task.contents.skillsTask.taskItems) {
                    if (skillTask.state.completed) totalCorrect++;
                }
            }

            const progressEntry = {
                name: task.title,
                value: getProgressBar(totalCorrect, total)
            };

            tasksScores.push({ totalCorrect, total });

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

        let cancelled = false;

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();
            if (interaction.customId === 'cancel') {
                cancelled = true;
                log.logToFile('User hit cancel button!');

                await progressUpdater.updateEmbed('Cancelling...');
            }
        });

        log.logToFile(homeworkTasks.package.contents.tasks);

        for (const task of homeworkTasks.package.contents.tasks) {
            if (cancelled || !(await queueScience.stillUsing(interaction.user.id))) break;
            await progressUpdater.updateEmbed(`Moving onto Task ${task.taskIndex + 1}...`);
            log.logToFile(`Moving onto Task ${task.taskIndex + 1}...`);
            let index = 0;
            for (const skillTask of task.contents.skillsTask.taskItems) {
                if (cancelled || !(await queueScience.stillUsing(interaction.user.id))) break;
                index++;
                if (skillTask.state.completed) continue;
                let stayOnQuestion = true;
                let aiModel = ai[0];
                log.logToFile(`Task type: ${task.type}`);
                let isFlashcard = task.type === 'flashcards';
                let timesIncorrect = 0;
                let timesO = 0;
                let supportMaterial = '';
                while (stayOnQuestion && timesO < 20) {
                    timesO += 1;
                    if (isFlashcard) {
                        await progressUpdater.updateEmbed(`Completing Flashcards at Task ${task.taskIndex + 1}...`);
                        log.logToFile(`Completing Flashcards at Task ${task.taskIndex + 1}...`);
                    } else if (aiModel === ai[0]) {
                        await progressUpdater.updateEmbed(`Completing Question ${index} at Task ${task.taskIndex + 1}...`);
                        log.logToFile(`Completing Question ${index} at Task ${task.taskIndex + 1}...`);
                    } else {
                        await progressUpdater.updateEmbed(`Retrying Question ${index} at Task ${task.taskIndex + 1}...`);
                        log.logToFile(`Retrying Question ${index} at Task ${task.taskIndex + 1}...`);
                    }
                    const questionActivity = await sparxScience.getQuestionActivity(skillTask.name);
                    log.logToFile(questionActivity);
                    const activityName = questionActivity.activity.name;
                    let token = questionActivity.activity.state.token;
                    const question = await sparxScience.getQuestion(questionActivity.activity.name);
                    if (!question?.activity?.state?.skillActivity?.question?.questionJson) break;
                    const questionLayout = JSON.parse(question.activity.state.skillActivity.question.questionJson);


                    const folderPath = path.join(__dirname, 'tasks_temp'); // folder inside the script's folder
                    const filePath = path.join(folderPath, `${task.name}_${skillTask.name}.json`);

                    fs.mkdirSync(path.dirname(filePath), { recursive: true });
                    // Make sure the folder exists

                    // Write the string to the file
                    fs.writeFileSync(filePath, JSON.stringify(questionLayout, null, 1), 'utf8');
                    log.logToFile(`Written to ${filePath}`);

                    const readyResponse = await sparxScienceExecuter.readyQuestion(activityName, token);
                    if (readyResponse) {
                        token = readyResponse;
                    }

                    const waitTime = Math.floor(Math.random() * (fakeTime.max - fakeTime.min + 1)) + fakeTime.min;
                    const waitTimeMs = waitTime * 1000;

                    if (waitTime) {
                        const interval = 3000; // check every 3 seconds
                        let elapsed = 0;

                        await progressUpdater.updateEmbed(`Waiting to Complete Question ${index} at Task ${task.taskIndex + 1} \`<t:${Math.floor(Date.now() / 1000) + waitTime}:R>...`);
                        log.logToFile(`Waiting to Complete Question ${index} at Task ${task.taskIndex + 1} for ${waitTime} Seconds`);
                        while (elapsed < waitTimeMs && !cancelled && (await queueScience.stillUsing(interaction.user.id))) {
                            const timeLeft = waitTimeMs - elapsed;
                            await new Promise(res => setTimeout(res, Math.min(interval, timeLeft)));
                            elapsed += Math.min(interval, timeLeft);
                        }

                        if (cancelled || !(await queueScience.stillUsing(interaction.user.id))) {
                            break; // exit the while loop
                        }
                    }

                    let aiAnswered = await checkAnswer(JSON.stringify(questionLayout));
                    let alreadyInDB;

                    if (!aiAnswered && !ai[0]) {
                        stayOnQuestion = false;
                        break;
                    }

                    let failedQuestion = null;
                    let shouldTry = true;
                    if (!aiAnswered) {
                        failedQuestion = await getFailedQuestion(JSON.stringify(questionLayout));

                        log.logToFile('Failed question', failedQuestion);
                        if (failedQuestion) {
                            console.log('Failed question', failedQuestion);
                            let nextBetterModel = null;

                            console.log('Ai', ai);
                            for (const item of Object.values(ai)) {
                                if (!item) break;
                                const model = `gemini-${item}`;
                                console.log('Trying item', model);

                                if (isHigherModel(model, failedQuestion.ai_model)) {
                                    nextBetterModel = item;
                                    break;
                                }
                            }

                            console.log('Ai model to try', nextBetterModel);
                            if (!nextBetterModel) shouldTry = false;
                            if (nextBetterModel) aiModel = nextBetterModel;
                        }
                    }

                    if (!shouldTry) {
                        break;
                    }

                    if (!aiAnswered) {
                        log.logToFile('Trying to run AI Model', aiModel);

                        aiAnswered = await getAIanswer(
                            () => parser(apikey, questionLayout[questionLayout.length - 1], aiModel, activityName, token, supportMaterial, failedQuestion?.incorrect_answers),
                            queueScience,
                            interaction,
                            progressUpdater,
                            60000,
                            3000,
                            () => cancelled
                        );

                        log.logToFile("AI Answer:");
                        log.logToFile(aiAnswered.action.answer.components);

                    } else {
                        alreadyInDB = true;
                        aiAnswered = getQuestionObject(JSON.parse(aiAnswered), activityName, token);
                        log.logToFile("DB Answer:");
                        log.logToFile(aiAnswered.action.answer.components);
                    }

                    if (cancelled || !(await queueScience.stillUsing(interaction.user.id))) {
                        break;
                    }

                    let errorCode = await sparxScienceExecuter.answerQuestion(aiAnswered);
                    if (errorCode === 9) {
                        const readyResponse = await sparxScienceExecuter.readyQuestion(activityName, token);
                        if (readyResponse) {
                            token = readyResponse;
                            aiAnswered.token = token;
                        }
                        log.logToFile('About to input for twice', aiAnswered);
                        errorCode = await sparxScienceExecuter.answerQuestion(aiAnswered);
                        log.logToFile(`Error code twice`);
                        log.logToFile(errorCode);
                    }
                    // await progressUpdater.updateProgressBar(packageID, taskTimer);
                    let continuousRetry = errorCode.activity?.annotations?.multistep_type === "continuous";
                    log.logToFile(`Continious retry ${continuousRetry}`); // Need to check for flashcards if correct
                    let questionSuccecceed;
                    if (isFlashcard) { // marks
                        questionSuccecceed = errorCode.packageUpdate.contents.tasks[task.taskIndex].contents.skillsTask.taskItems[index - 1].state.marks === 1;
                        if (task?.state?.completion?.progress?.C !== errorCode.packageUpdate.contents.tasks[task.taskIndex].state?.completion?.progress?.C) {
                            task.state.completion.progress.C = errorCode.packageUpdate.contents.tasks[task.taskIndex].state?.completion.progress.C;
                            tasksScores[task.taskIndex].totalCorrect += 1;
                        } else if (task?.state?.completion?.progress?.FNR !== errorCode.packageUpdate.contents.tasks[task.taskIndex].state?.completion?.progress?.FNR) {
                            task.state.completion.progress.FNR = errorCode.packageUpdate.contents.tasks[task.taskIndex].state?.completion.progress.FNR;
                            tasksScores[task.taskIndex].totalCorrect += 0.5;
                        }
                    } else {
                        questionSuccecceed = errorCode.packageUpdate.contents.tasks[task.taskIndex].contents.skillsTask.taskItems[index - 1].state.status === 1;
                        if (questionSuccecceed) tasksScores[task.taskIndex].totalCorrect += 1;
                    }
                    if (errorCode.activity.state.skillActivity.question?.supportMaterial) {
                        supportMaterial = errorCode.activity.state.skillActivity.question.supportMaterial?.text;
                    }

                    if (alreadyInDB && !questionSuccecceed) {
                        await deleteAnswer(JSON.stringify(questionLayout));
                    }
                    log.logToFile('Support Material', supportMaterial); // supportMaterial

                    log.logToFile('Task Score', tasksScores[task.taskIndex]);
                    await progressUpdater.updateProgressBar(task.taskIndex, tasksScores[task.taskIndex].totalCorrect, tasksScores[task.taskIndex].total);
                    log.logToFile('Stay questions', (aiModel === ai[1]), !(isFlashcard && questionSuccecceed), !continuousRetry);
                    if (aiModel === ai[1] && (timesIncorrect > 3 || isFlashcard) && !(isFlashcard && questionSuccecceed) && (timesIncorrect > 5 || !continuousRetry)) {
                        stayOnQuestion = false;
                    }

                    if (questionSuccecceed) {
                        if (!alreadyInDB) {
                            log.logToFile("Adding fuckas question to db");
                            await addToDb(questionLayout, aiAnswered.action.answer.components);
                        }
                        timesIncorrect = 0;
                        aiModel = ai[0];
                    } else {
                        if (!failedQuestion) {
                            await addFailedQuestion(JSON.stringify(questionLayout), [aiAnswered.action.answer.components], aiModel);
                        } else {
                            failedQuestion.incorrect_answers.push(aiAnswered.action.answer.components);
                            await updateFailedQuestions(questionLayout, failedQuestion.incorrect_answers);
                            console.log('Updated failed questions');
                        }
                        timesIncorrect += 1;
                        aiModel = ai[1];
                        if (!aiModel) {
                            stayOnQuestion = false;
                        }
                        log.logToFile("Question was wrong or already in db");
                    }
                }
            }
        }

    } catch (err) {
        log.logToFile("Sparx science error");
        log.logToFile(err);
        logError(err, null, 'Sparx Science');
    } finally {
        await log.sendToWebhook();

        await progressUpdater.updateEmbed('Finished');
        await progressUpdater.end();

        await updateStats(interaction.user.id, 'science', (process.hrtime(taskTimer))[0]);
        await queueScience.terminateSession(interaction.user.id);
    }

}

module.exports = { sparxScienceAutocomplete };