const { SlashCommandBuilder } = require('discord.js');
const { getAudit } = require('../../database/accounts');
const config = require('../../config.json');

const queueRanksPositions = config.queue_ranks;
const emojis = config.emojis;
module.exports = {
    data: new SlashCommandBuilder()
        .setName('audit')
        .setDescription('Audit the free trials'),
    async execute(interaction) {
        await interaction.deferReply();
        const accounts = await getAudit();

        const freetrialRoleId = queueRanksPositions['free-trial'];
        const guild = interaction.guild;
        const timeNow = new Date();

        let removedUsers = [];

        for (const account of accounts) {
            const start = new Date(account.free_trial_start);
            const diffMs = timeNow - start;
            const diffDays = diffMs / (1000 * 60 * 60 * 24);

            if (diffDays >= 3 && account.license === 'free-trial') {
                try {
                    // Fetch the member from the guild
                    const member = await guild.members.fetch(account.discord_id);
                    if (member && member.roles.cache.has(freetrialRoleId)) {
                        await member.roles.remove(freetrialRoleId, 'Free trial expired');
                        removedUsers.push(member.user.tag);
                    }
                } catch (error) {
                    console.error(`Could not remove role from user ${account.discord_id}:`, error);
                }
            }
        }

        if (removedUsers.length > 0) {
            await interaction.editReply(`Removed free-trial role from: ${removedUsers.join(', ')}`);
        } else {
            await interaction.editReply('No free-trial roles needed to be removed.');
        }
    },
};
