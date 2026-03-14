const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Gets the ping of the bot'),
	async execute(interaction, client) {
        await interaction.reply(`The current ping of the bot is **${client.ws.ping}ms**!`);
	},
};
