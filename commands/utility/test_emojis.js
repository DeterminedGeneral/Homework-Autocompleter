const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../../config.json');
const emojis = config.emojis;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('test_emojis')
		.setDescription('Tests rendering of all configured emojis'),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const embedLines = [];
		const buttonRows = [];
		let currentRow = new ActionRowBuilder();
        let totalButtons = 0;

		for (const [name, value] of Object.entries(emojis)) {
            let displayForEmbed = value;
            let emojiIdForButton = value;

            if (value.startsWith('<')) {
                const match = value.match(/<:(.+):(\d+)>/);
                if (match) {
                    const emojiName = match[1];
                    const emojiId = match[2];
                    displayForEmbed = `:${emojiName}: (ID: ${emojiId})`; // Display as :name: (ID: 123)
                    emojiIdForButton = emojiId;
                }
            } else if (/^\d+$/.test(value)) {
                 // If it's just an ID, assume generic name for display
                displayForEmbed = `(ID: ${value})`; 
                emojiIdForButton = value;
            }
            
            embedLines.push(`${name}: ${displayForEmbed}`);

            // Add button logic
            // Limit to 25 buttons (5 rows * 5 buttons)
            if (totalButtons < 25) {
                try {
                    // Extract emoji ID for buttons if it's a full emoji string
                    let emojiIdForButton = value;
                    if (value.startsWith('<')) {
                        const match = value.match(/:(\d+)>$/);
                        if (match) emojiIdForButton = match[1];
                    }

                    const button = new ButtonBuilder()
                        .setCustomId(`test_emoji_${name}`)
                        .setLabel(name.length > 80 ? name.substring(0, 77) + '...' : name)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojiIdForButton);

                    currentRow.addComponents(button);
                    totalButtons++;

                    if (currentRow.components.length === 5) {
                        buttonRows.push(currentRow);
                        currentRow = new ActionRowBuilder();
                    }
                } catch (e) {
                    console.error(`Failed to create button for emoji ${name}:`, e);
                }
            }
		}

		if (currentRow.components.length > 0 && buttonRows.length < 5) {
            buttonRows.push(currentRow);
        }

		const testEmbed = new EmbedBuilder()
			.setTitle('Emoji Rendering Test')
			.setDescription(embedLines.length > 0 ? 'Here are all configured emojis:\n\n' + embedLines.join('\n') : 'No emojis to render in embed.')
			.setColor(0x00FF00)
            .setFooter({ text: buttonRows.length === 5 ? 'Note: Some buttons omitted due to Discord limits. Click a button to see its full ID code.' : null });

		const response = await interaction.editReply({ embeds: [testEmbed], components: buttonRows });

        // Create a collector for the buttons
        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.customId.startsWith('test_emoji_')) {
                const emojiName = i.customId.replace('test_emoji_', '');
                const emojiValue = emojis[emojiName];
                
                let msg = `Config Key: \`${emojiName}\`\nValue from Config: ${emojiValue}`;
                
                await i.reply({ content: msg, flags: MessageFlags.Ephemeral });
            }
        });
	},
};
