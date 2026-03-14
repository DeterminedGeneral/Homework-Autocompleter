const { SlashCommandBuilder } = require('discord.js');
const { resetAllUses } = require('../../database/accounts');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reset_slots')
		.setDescription('Reset all used slots to 0'),
	async execute(interaction) {
        await interaction.deferReply();
        await resetAllUses();
        await interaction.editReply('All used slots reset to 0');
	},
};
