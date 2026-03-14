const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const queueRanks = Object.keys(config.queue_ranks);
const queueRanksPositions = config.queue_ranks;
const emojis = config.emojis;
const { logError } = require('../utils/errorLogger.js');
let queueRankStatus = {};
for (const [index, value] of queueRanks.entries()) {
    queueRankStatus[value] = index;
}

class QueueSystem {
    constructor(queueMaxPerUse) {
        this.queueSystem = [];
        this.lockPerson = [];
        this.queueMaxPerUse = queueMaxPerUse;
    }

    async positionToInsert(user) {
        let userStatus = queueRankStatus[user.rank];
        let queueLastPosition;
        for (const [index, item] of this.queueSystem.entries()) {
            if (queueLastPosition === undefined) {
                queueLastPosition = queueRankStatus[item.rank];
            }

            if (queueRankStatus[item.rank] > userStatus) {
                return index;
            }
        }

        return this.queueSystem.length;
    }

    async terminateSession(userID) {
        if (this.lockPerson.some(p => p.id === userID)) {
            this.lockPerson = this.lockPerson.filter(p => p.id !== userID);
            return true;
        }
        return false;
    }

    async getFirstMatchingRole(interaction) {
        const guild = interaction.guild;
        const member = await guild.members.fetch(interaction.user);        
        const match = Object.entries(queueRanksPositions).find(([_, roleId]) =>
            member.roles.cache.has(roleId)
        );
        return match ? match[0] : null; 
    }

    async addQueue(info) {
        let queuePosition = await this.checkQueue(info.id);

        if (queuePosition === -2) {

            const responseEmbed = new EmbedBuilder()
                .setTitle(`Already Using the Autocompleter`)
                .setDescription(`You appear to have an active session. Use "Check Queue" -> "Terminate Session" to end it, then try again.`)
                .setColor(0x0099FF);

            await info.interaction.user.send({ embeds: [responseEmbed] });
            return;
        } else if (queuePosition !== -1) {
            const responseEmbed = new EmbedBuilder()
                .setTitle(`Already in the Queue`)
                .setDescription(`You are already in the queue.`)
                .setColor(0x0099FF);

            await info.interaction.user.send({ embeds: [responseEmbed] });
            return;
        }
        const rank = await this.getFirstMatchingRole(info.interaction);
        info['rank'] = rank;
        this.queueSystem.splice(await this.positionToInsert(info), 0, info);
        this.processQueue();
    }

    async processQueue() {
        while (this.queueSystem.length > 0 && this.lockPerson.length < this.queueMaxPerUse) {
            const nextPerson = this.queueSystem.shift(); // remove from queue
            this.lockPerson.push(nextPerson);

            nextPerson.action().catch(err => {
                console.log("Autocompleter failed for a user");
                logError(err, 'Autocompleter', 'Autocompleter Execution Failure');
                console.log(err);
            }).finally(() => {
                // Remove completed person from lockPerson
                this.lockPerson = this.lockPerson.filter(p => p.id !== nextPerson.id);
                // Process next person if there’s still space
                this.processQueue();
            });
        }
    }

    async checkQueue(personId) {
        if (this.lockPerson.some(p => p.id === personId)) {
            return -2; // currently processing
        }
        return this.queueSystem.findIndex(p => p.id === personId);
    }

    async stillUsing(personID) {
        return this.lockPerson.some(p => p.id === personID);
    }

    async getLength() {
        return this.queueSystem.length + this.lockPerson.length;
    }

    async getPeople() {
        return {
            queue: this.queueSystem,
            currentPerson: this.lockPerson,
        };
    }

    async removePerson(personId) {
        if (!this.queueSystem || this.queueSystem.length === 0) return false;

        const originalLength = this.queueSystem.length;
        this.queueSystem = this.queueSystem.filter(p => p?.id !== personId);
        
        return this.queueSystem.length < originalLength;
    }

}

const queue = new QueueSystem(config.reader_queue_max);
const queueMaths = new QueueSystem(config.maths_queue_max);
const queueScience = new QueueSystem(config.science_queue_max);

module.exports = { queue, queueMaths, queueScience };