const { SlashCommandBuilder } = require('discord.js');
const { logError } = require('../../utils/errorLogger');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('test_error')
		.setDescription('Test the error logging webhook.'),
	async execute(interaction) {
        try {
            throw new Error('Testing');
        } catch(err) {
            await logError(err, null, 'Sparx Maths');
        }
        await interaction.reply(`Sent to webhook!`);
	},
};
