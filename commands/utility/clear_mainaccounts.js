const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { clearSpecificService } = require('../../database/accounts');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('clear_mainaccounts')
		.setDescription('Reset account for a specific service for everyone.')
        // 1. Add the String Option here
        .addStringOption(option => 
            option.setName('service')
                .setDescription('The name of the service to clear')
                .setRequired(true)
        )
        // Recommended: Restrict this to Admins since it deletes data
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction) {
        return;
        // 2. Retrieve the input from the user
        const service = interaction.options.getString('service');

        await interaction.deferReply();
        
        // 3. Pass the retrieved variable to your database function
        await clearSpecificService(service);
        
        // 4. Update the reply to confirm which service was cleared
        await interaction.editReply(`Deleted main accounts for **${service}**.`);
	},
};