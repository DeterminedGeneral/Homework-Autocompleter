const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs').promises;
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const ADMIN_ROLE = process.env.ADMIN_ROLE;

const BLACKLIST_FILE = path.join(__dirname, '../../blacklisted.txt');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Manage blacklisted words for automod (staff only).')
        .setDefaultMemberPermissions(0) // Only admins can use this command
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a word to the blacklist.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to add to the blacklist.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a word from the blacklist.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to remove from the blacklist.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all blacklisted words.')),
    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const word = interaction.options.getString('word');

        let blacklistedWords = [];
        try {
            const data = await fs.readFile(BLACKLIST_FILE, 'utf8');
            blacklistedWords = data.split(/\r?\n/).map(w => w.trim()).filter(w => w.length > 0);
        } catch (error) {
            console.error('Error reading blacklisted.txt:', error);
            blacklistedWords = [];
        }

        switch (subcommand) {
            case 'add':
                if (blacklistedWords.includes(word.toLowerCase())) {
                    return interaction.reply({ content: `\`${word}\` is already in the blacklist.`, ephemeral: true });
                }
                blacklistedWords.push(word.toLowerCase());
                await fs.writeFile(BLACKLIST_FILE, blacklistedWords.join('\n'));
                return interaction.reply({ content: `\`${word}\` has been added to the blacklist.`, ephemeral: true });

            case 'remove':
                if (!blacklistedWords.includes(word.toLowerCase())) {
                    return interaction.reply({ content: `\`${word}\` is not in the blacklist.`, ephemeral: true });
                }
                blacklistedWords = blacklistedWords.filter(w => w !== word.toLowerCase());
                await fs.writeFile(BLACKLIST_FILE, blacklistedWords.join('\n'));
                return interaction.reply({ content: `\`${word}\` has been removed from the blacklist.`, ephemeral: true });

            case 'list':
                if (blacklistedWords.length === 0) {
                    return interaction.reply({ content: 'The blacklist is empty.', ephemeral: true });
                }
                return interaction.reply({ content: `Blacklisted words:\n\`\`\`\n${blacklistedWords.join('\n')}\n\`\`\``, ephemeral: true });

            default:
                return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        }
    },
};