const { SlashCommandBuilder, TextInputStyle, ModalBuilder, StringSelectMenuBuilder, LabelBuilder, TextInputBuilder, ComponentType, ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const config = require('../../config.json');
const emojis = config.emojis;
const queueRanksPositions = config.queue_ranks;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove_main_account')
        .setDescription('Remove a main account using a login'),
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        const section = new TextDisplayBuilder().setContent(`## 🔒 Remove Main Account\nRemove a main account to whoever it is configured to!`);

        const seperator = new SeparatorBuilder({
            spacing: SeparatorSpacingSize.Small
        });

        const statsBtn = new ButtonBuilder()
            .setCustomId("add_main_account")
            .setLabel('Remove Main Account')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.main_accounts);

        const cookieBtn = new ButtonBuilder()
            .setCustomId("add_main_cookie_account")
            .setLabel('Remove Main Account with Cookies (Sparx Only)')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.cookies);

        const row = new ActionRowBuilder().addComponents(statsBtn, cookieBtn);

        // 3. Assemble everything into the main container
        const container = new ContainerBuilder()
            .setAccentColor(0x353839)
            .addTextDisplayComponents(
                section.data
            )
            .addSeparatorComponents(
                seperator
            )
            .addActionRowComponents(
                row
            );

        const message_sent = await interaction.followUp({
            flags: 32768 | 64,
            components: [container],
            withResponse: true
        });

        const collector = message_sent.createMessageComponentCollector({
            componentType: ComponentType.Button
        });

        collector.on('collect', async (accountInteraction) => {

            const modal = new ModalBuilder()
                .setCustomId('main_account_remove')
                .setTitle('Main Account Remove');

            if (accountInteraction.customId === 'add_main_account') {
                const schoolInput = new TextInputBuilder()
                    .setCustomId('school')
                    .setLabel("School")
                    .setPlaceholder('If needed for login')
                    .setRequired(false)
                    .setStyle(TextInputStyle.Short);

                const emailInput = new TextInputBuilder()
                    .setCustomId('email')
                    .setLabel("Email Address/Username")
                    .setStyle(TextInputStyle.Short);

                const passwordInput = new TextInputBuilder()
                    .setCustomId('password')
                    .setLabel("Password")
                    .setStyle(TextInputStyle.Short);

                const typeInput = new StringSelectMenuBuilder()
                    .setCustomId('type')
                    .setPlaceholder("Normal/Microsoft/Google (If needed for login)")
                    .setRequired(false)
                    .addOptions(
                        { label: "Normal", value: "Normal", emoji: emojis.sparx },
                        { label: "Microsoft", value: "Microsoft", emoji: emojis.microsoft },
                        { label: "Google", value: "Google", emoji: emojis.google }
                    );

                const sparxInput = new StringSelectMenuBuilder()
                    .setCustomId('platform')
                    .setPlaceholder("Platform")
                    .addOptions(
                        { label: "Reader", value: "reader", emoji: emojis.reader },
                        { label: "Maths", value: "maths", emoji: emojis.maths },
                        { label: "Science", value: "science", emoji: emojis.science },
                        { label: "LanguageNut", value: "languagenut", emoji: emojis.languagenut },
                        { label: "Educake", value: "educake", emoji: emojis.educake },
                        { label: "Seneca", value: "seneca", emoji: emojis.seneca },
                        { label: "DrFrost", value: "drfrost", emoji: emojis.drfrost }
                    );

                const buttons = [schoolInput, emailInput, passwordInput];
                const typeLabel = new LabelBuilder({
                    label: 'Login Type',
                    component: typeInput
                });
                const sparxLabel = new LabelBuilder({
                    label: 'Platform',
                    component: sparxInput
                });

                modal.addLabelComponents(sparxLabel);

                for (const button of buttons) {
                    modal.addComponents(new ActionRowBuilder().addComponents(button));
                }
                modal.addLabelComponents(typeLabel);
            } else if (accountInteraction.customId === 'add_main_cookie_account') {
                const cookieInput = new TextInputBuilder()
                    .setCustomId('cookies')
                    .setLabel("Cookies String")
                    .setStyle(TextInputStyle.Paragraph);

                modal.addComponents(new ActionRowBuilder().addComponents(cookieInput));
            }

            await accountInteraction.showModal(modal);
        });
    },
};
