const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('get_queue')
		.setDescription('Gets the current queue')
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

        let text = "";
        for (const person of queuePeople.currentPerson) {
            text += `\n**Current User.** ${person.interaction.user}`;
        }

        queuePeople.queue.forEach((value, index) => {
            text += `\n**${index}**. ${value.interaction.user}`;
        });

        const responseEmbed = new EmbedBuilder()
            .setTitle(`Queue Status - ${type}`)
            .setDescription(text || 'No one is in the queue and the bot is not in use')
            .setColor(0xDAA06D);

        await interaction.reply({ embeds: [responseEmbed]});
	},
};
