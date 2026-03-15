const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');
const { emojis, footerText, footerIcon } = require('../startEmbeds/info.js');
const { logError } = require('../utils/errorLogger.js');
const progressTracker = require('../utils/progressTracker.js');
const formatTime = require('../utils/formatTime');
const getProgressBar = require('../utils/getProgressBar');
const getAIanswer = require('../utils/getAIanswer.js');
const { updateStats } = require('../database/accounts.js');
const { checkAccount } = require('../database/accounts.js');
const logger = require('../utils/logger.js');

async function sparxReaderAutocomplete(interaction, sparxReader, bookUid, points, wpm, bookName, mode) {

    const log = new logger(`logs/sparx_reader/${interaction.user.id}.txt`);
    sparxReader.log = log;
    log.logToFile('Logging Start');
    log.logToFile(`**Settings**\n ${[
        ["bookUid", bookUid],
        ["points", points],
        ["wpm", wpm],
        ["bookName", bookName],
        ["mode", mode]
    ].map(([name, value]) => `${name}: ${value}`).join("\n")}`);
    // await interaction.deferUpdate();
    sparxReader.apikey = (await checkAccount(interaction.user.id)).apikey;
    const { queue } = require('../queues/queue');
    let readUntilFinish = mode === 'Read Until Book Completed';
    // let readUntilGold = mode === 'Read Until Gold Reader Acquired';
    let pointsAcquired = 0;
    let timesO = 0;
    let finishedBook = false;
    let correctQuestions = 0;
    let totalQuestions = 0;
    let cancelled = false;

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder()
        .addComponents(cancel);

    const initialEmbed = new EmbedBuilder()
        .setColor(0x4467C4)
        .setTitle('Sparx Reader Autocompleter')
        .setDescription(`\`Starting Questions...\``);

    const sectionsProgress = [[{
        name: `Progress (${points} SRP)`,
        value: getProgressBar(0, 1)
    }]];

    const getTimeField = function () {
        return `> **Time Spent**: ${formatTime((process.hrtime(this.taskTimer))[0])}\n> **Sparx Reader Points Accumulated**: ${pointsAcquired}\n> **Accuracy**: ${isNaN(Math.round(correctQuestions / totalQuestions * 100)) ? 100 : Math.round(correctQuestions / totalQuestions * 100)}%\n> **Reading**: ${bookName}`;
    };
    const progressUpdater = new progressTracker(interaction, getTimeField);
    if (await progressUpdater.start(initialEmbed, row, sectionsProgress)) return;

    const collector = progressUpdater.targetMessage.createMessageComponentCollector({
        componentType: ComponentType.Button
    });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();
        if (interaction.customId === 'cancel') {
            cancelled = true;
            log.logToFile('User hit cancel button!');
            await progressUpdater.updateEmbed(`Cancelling...`);
        }
    });

    try {
        while ((pointsAcquired < points || readUntilFinish) && timesO < 10 && !cancelled && (await queue.stillUsing(interaction.user.id))) {
            log.logToFile(`Points Accumulated: ${pointsAcquired}\nQuestions Correct: ${correctQuestions}/${totalQuestions}`);
            const taskId = await sparxReader.getBookTask(bookUid);
            if (taskId === 8) {
                finishedBook = true;
                log.logToFile(`Book finished!`);
                if (readUntilFinish) {
                    break;
                }

                let homeworkBooks = await sparxReader.getHomeworks();

                if (!homeworkBooks.length) {
                    const bookOptions = await sparxReader.getNewBookOptions();
                    const bookUid = bookOptions.books[0].name.split('/')[1];
                    await sparxReader.getBookTask(bookUid);
                    homeworkBooks = await sparxReader.getHomeworks();
                }
                bookUid = homeworkBooks[0].bookId;
                bookName = homeworkBooks[0].title;
                log.logToFile(`New Book UID: ${bookUid}\nNew Bookname: ${bookName}`);

                continue;
                /*
                if (readUntilFinish || bookUids.length < 2) {
                    break;
                }
    
                bookUids = bookUids.filter(item => item !== bookUid);
                bookUid = bookUids[0];
    
                continue;
                */
            }

            const bookTextObj = await sparxReader.getBookText(bookUid, taskId);
            const bookText = bookTextObj.paragraph;
            const wordCount = bookTextObj.wordCount;
            if (wpm) {
                const totalTime = (wordCount / wpm) * 60 * 1000; // total time in ms
                const interval = 3000; // check every 3 seconds
                let elapsed = 0;

                const totalMinutes = wordCount / wpm;
                const minutes = Math.floor(totalMinutes);
                const seconds = Math.round((totalMinutes - minutes) * 60);

                log.logToFile(`"Reading" at ${wpm} Words Per Minute for ${seconds} Seconds...`);
                await progressUpdater.updateEmbed(`"Reading" at ${wpm} Words Per Minute \`<t:${Math.floor(Date.now() / 1000) + seconds}:R>...`);

                while (elapsed < totalTime && !cancelled && (await queue.stillUsing(interaction.user.id))) {
                    const timeLeft = totalTime - elapsed;
                    await new Promise(res => setTimeout(res, Math.min(interval, timeLeft)));
                    elapsed += Math.min(interval, timeLeft);
                }

                if (cancelled || !(await queue.stillUsing(interaction.user.id))) {
                    await progressUpdater.updateEmbed(`Cancelled`);
                    break; // exit the while loop
                }
            }

            log.logToFile(`About to get AI Answer`);
            const results = await getAIanswer(
                () => sparxReader.answerQuestion(bookText, taskId, true),
                queue,
                interaction,
                progressUpdater,
                60000,
                3000,
                () => cancelled
            );

            if (cancelled || !(await queue.stillUsing(interaction.user.id))) {
                break;
            }

            const experienceGained = results?.experience ?? 0;

            pointsAcquired += experienceGained;

            if (results?.results) {
                for (const result of results.results) {
                    correctQuestions += result.score;
                    totalQuestions += result.total;
                }
            }

            timesO += 1;
            if (experienceGained !== 0) {
                log.logToFile('Got questions right!');
                await progressUpdater.updateProgressBar(0, pointsAcquired, points);
                await progressUpdater.updateEmbed(`Completing Questions...`);
                timesO = 0;
            } else {
                log.logToFile('Got questions wrong!');
                await progressUpdater.updateEmbed(`Retrying Question...`);
            }
        }
    } catch (err) {
        log.logToFile("Error caught");
        log.logToFile(err);
        logError(err, null, 'Sparx Reader');
    }

    await log.sendToWebhook();

    let finalMessage = 'Encountered an error causing the autocompleter to fail';
    if (cancelled || !(await queue.stillUsing(interaction.user.id))) {
        finalMessage = 'Cancelled';
    }
    else if (pointsAcquired >= points && !readUntilFinish) {
        finalMessage = `SRP target of ${points} has been achieved`;
    }
    else if (finishedBook && readUntilFinish) {
        finalMessage = 'The book has been Finished';
    }

    log.logToFile(`Final Message: ${finalMessage}`);

    await progressUpdater.updateEmbed(finalMessage);
    await progressUpdater.end();

    // Send feedback request embed if task completed successfully
    if ((finishedBook || (pointsAcquired >= points && !readUntilFinish)) && !cancelled && (await queue.stillUsing(interaction.user.id))) {
        try {
            const feedbackEmbed = new EmbedBuilder()
                .setTitle('Your feedback matters! ✨')
                .setDescription('Please consider writing a review in https://discord.com/channels/1351338824759906345/1433049507435778150 !')
                .setColor(0xFFD700);

            await interaction.user.send({
                embeds: [feedbackEmbed]
            });
        } catch (dmError) {
            console.error('Failed to send feedback DM:', dmError);
        }
    }

    await updateStats(interaction.user.id, 'reader', (process.hrtime(progressUpdater.taskTimer))[0]);

    await queue.terminateSession(interaction.user.id);
}

module.exports = { sparxReaderAutocomplete };