const { EmbedBuilder } = require('discord.js');
const getProgressBar = require('./getProgressBar');
const { name } = require('../config.json');

class progressTracker {
    constructor(interaction, getTimeField) {
        this.interaction = interaction;
        this.user = interaction.user;
        this.targetMessage;
        this.embed;
        this.totalSeconds = 0;
        this.taskTimer = process.hrtime();
        this.row;
        this.sectionsProgress;
        this.currentPage = 1;
        this.getTimeField = getTimeField.bind(this); // <-- IMPORTANT
    }

    async end() {
        for (const component of this.row.components) {
            component.setDisabled(true);
        }
        await this.targetMessage.edit({
            components: [this.row]
        });
    }

    getTimeEmbed() {
        return {
            name: '\u200B',
            value: this.getTimeField()
        };
    }

    async wait(time, message, notcancelFlag) {
        const waitTime = Math.floor(Math.random() * (time.max - time.min + 1)) + time.min;
        const waitTimeMs = waitTime * 1000;

        if (waitTime) {
            const interval = 3000; // check every 3 seconds
            let elapsed = 0;

            await this.updateEmbed(`${message} \`<t:${Math.floor(Date.now() / 1000) + waitTime}:R>...`);

            while (elapsed < waitTimeMs && notcancelFlag()) {
                const timeLeft = waitTimeMs - elapsed;
                await new Promise(res => setTimeout(res, Math.min(interval, timeLeft)));
                elapsed += Math.min(interval, timeLeft);
            }
        }
    }

    async updateTime() {
        this.embed.data.fields[this.embed.data.fields.length - 1] = (this.getTimeEmbed());
    }

    async updateEmbed(description) {
        this.embed.data.description = `\`${description}\`${this.sectionsProgress.length > 1 ? `\n*Page ${this.currentPage} of ${this.sectionsProgress.length}*` : ''}`;

        await this.updateTime();

        await this.targetMessage.edit({
            embeds: [this.embed]
        });
    }

    async updateProgressBar(index, newProg, progMax=1) {
        this.embed.data.fields = [];
        const progressBar = getProgressBar(newProg, progMax);
        const adjustedIndex = Math.floor(index / 5);
        this.currentPage = adjustedIndex + 1;
        for (const section of this.sectionsProgress[adjustedIndex]) {
            this.embed.addFields(section);
        }
        this.embed.addFields(this.getTimeEmbed());

        this.embed.data.fields[index % 5].value = progressBar;

        await this.updateTime();

        await this.targetMessage.edit({
            embeds: [this.embed]
        });
    }

    async start(initialEmbed, row, sectionsProgress) {
        for (const section of sectionsProgress[0]) {
            initialEmbed.addFields(section);
        }
        initialEmbed.addFields(this.getTimeEmbed());

        try {
            this.embed = initialEmbed;
            this.row = row;
            this.sectionsProgress = sectionsProgress;
            this.targetMessage = await this.user.send({
                embeds: [initialEmbed],
                components: [row]
            });
        } catch {
            const noDMenabled = new EmbedBuilder()
                .setTitle('Cannot Direct Message')
                .setDescription('The autocompleter is unable to direct message you the progress tracker because your discord settings prevent this. You have been kicked out of the queue and the autocompleter has cancelled your task.')
                .addFields({
                    name: 'How do I fix this issue?',
                    value: `Please go to \`Settings -> Content & Social -> Social Permissions -> \'${name}\' -> Direct Messages ✅\``
                })
                .setColor(0xFF474D)
                .setImage('https://i.postimg.cc/5NkYDpYD/Screenshot-2025-10-17-203707.png');

            await this.interaction.followUp({
                embeds: [noDMenabled],
                ephemeral: true
            });
            return true;
        }
    }
}

module.exports = progressTracker;