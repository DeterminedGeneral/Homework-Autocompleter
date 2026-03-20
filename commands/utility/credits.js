const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('credits')
		.setDescription('Credits for people who made the bot'),
    public: true,
	async execute(interaction) {

		const embed = new EmbedBuilder()
			.setColor(0x5865F2)
			.setTitle('✨ Credits')
			.addFields(
				{ name: '👨‍💻 Developer', value: '<@1187435043493257256>', inline: true },
				{ name: '🛠️ Github Link', value: 'https://github.com/DeterminedGeneral/Homework-Autocompleter/tree/main', inline: true },
				{ name: '💡 Discord Server', value: 'https://discord.gg/SYH5DSz6Bb', inline: false }
			)
			.setTimestamp();

		await interaction.reply({ embeds: [embed], flags: 64 });
	},
};