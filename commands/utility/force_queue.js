const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('force_queue')
		.setDescription('Force the queue')
		.addStringOption(option =>
			option
				.setName('type')
				.setDescription('Select which queue to get')
				.setRequired(true)
				.addChoices(
					{ name: 'Reader', value: 'reader' },
					{ name: 'Maths', value: 'maths' },
					{ name: 'Science', value: 'science' },
				)
		),
	async execute(interaction) {
        const type = interaction.options.getString('type');
        const { queue, queueMaths, queueScience } = require('../../queues/queue');
        const possibleQueues = {
            "reader": queue,
            "maths": queueMaths,
            "science": queueScience
        };
        const queuePeople = await possibleQueues[type].getPeople();

        if (!queuePeople.currentPerson) {
            const responseEmbed = new EmbedBuilder()
                .setTitle(`No current person using the bot`)
                .setDescription('Noone is is currently using the bot')
                .setColor(0xDAA06D);

            await interaction.reply({ embeds: [responseEmbed]});
            return;
        }

        possibleQueues[type].lockPerson = [];

        const responseEmbed = new EmbedBuilder()
            .setTitle(`Queue Forced`)
            .setDescription(`People currently using the autocompleter specified have been forced out.`)
            .setColor(0xDAA06D);

        await interaction.reply({ embeds: [responseEmbed]});
	},
};
