const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { execSync } = require('child_process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('version')
        .setDescription('Gets the version the bot is on'),

    async execute(interaction) {
        let commitHash = 'Unknown';
        let commitMessage = 'Unknown';

        try {
            // Get the current Git commit hash
            commitHash = execSync('git rev-parse --short HEAD').toString().trim();
            // Get the latest commit message
            commitMessage = execSync('git log -1 --pretty=%s').toString().trim();
        } catch (err) {
            console.error('Could not get Git info:', err);
        }

        const embed = new EmbedBuilder()
            .setTitle('Bot Version')
            .setColor(0x00FF00)
            .addFields(
                { name: 'Commit', value: `\`${commitHash}\`` },
                { name: 'Message', value: commitMessage }
            )
            .setTimestamp()
            .setFooter({ text: 'Version info' });

        await interaction.reply({ embeds: [embed] });
    },
};
