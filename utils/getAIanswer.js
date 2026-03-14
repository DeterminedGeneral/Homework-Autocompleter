async function getAIanswer(
    actionFn,
    queue,
    interaction,
    progressUpdater,
    maxWaitMs = 60000,
    checkIntervalMs = 3000,
    cancelFlag = () => false
) {
    let result = await actionFn();
    let attempts = 0;

    while (typeof result === 'number') { // Retry for any numeric error code
        attempts++;
        await progressUpdater.updateEmbed(
            `The AI model returned an error code (${result}). Waiting for 60 seconds before retrying (Attempt ${attempts})...`
        );

        let elapsed = 0;
        while (elapsed < maxWaitMs && !cancelFlag() && (await queue.stillUsing(interaction.user.id))) {
            const timeLeft = maxWaitMs - elapsed;
            await new Promise(res => setTimeout(res, Math.min(checkIntervalMs, timeLeft)));
            elapsed += Math.min(checkIntervalMs, timeLeft);
        }

        if (cancelFlag() || !(await queue.stillUsing(interaction.user.id))) {
            return 'break';
        }

        result = await actionFn();
    }

    return result;
}

module.exports = getAIanswer;