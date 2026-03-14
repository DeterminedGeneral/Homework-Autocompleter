const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, LabelBuilder } = require('discord.js');
const emojis = require('../config.json').emojis;

async function handleSparxLogin(interaction, action) {
    if (interaction.replied || interaction.deferred) {
        return;
    }

    let modalAction = 'homework';
    let actionSuffix = '';
    if (typeof action === 'string') {
        if (action === 'positiveNoun') {
            modalAction = 'positiveNoun';
        } else if (action.startsWith('homework') && action.includes('_')) {
            const parts = action.split('_');
            if (parts[1]) actionSuffix = `_${parts[1]}`;
        }
    }

    if (action.startsWith('freetrial')) {
        const loginTypeAction = action.split('_')[2];
        const modal = new ModalBuilder()
            .setCustomId(action)
            .setTitle('Sparx Login');

        const buttons = [];
        if (loginTypeAction === 'regular') {
            const schoolInput = new TextInputBuilder()
                .setCustomId('school')
                .setLabel("School")
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
            .setPlaceholder("Normal/Microsoft/Google")
            .addOptions(
                { label: "Normal", value: "Normal", emoji: emojis.sparx },
                { label: "Microsoft", value: "Microsoft", emoji: emojis.microsoft },
                { label: "Google", value: "Google", emoji: emojis.google }
            );

            const sparxInput = new StringSelectMenuBuilder()
            .setCustomId('sparx')
            .setPlaceholder("Reader/Maths/Science")
            .addOptions(
                { label: "Reader", value: "reader", emoji: emojis.reader },
                { label: "Maths", value: "maths", emoji: emojis.maths },
                { label: "Science", value: "science", emoji: emojis.science }
            );

            buttons.push(schoolInput, emailInput, passwordInput); // flags: 32768
            for (const button of buttons) {
                modal.addComponents(new ActionRowBuilder().addComponents(button));
            }

            const typeLabel = new LabelBuilder({
                label: 'Login Type',
                component: typeInput
            });
            const sparxLabel = new LabelBuilder({
                label: 'Sparx',
                component: sparxInput
            });
            modal.addLabelComponents(typeLabel, sparxLabel);
        } else if (loginTypeAction === 'cookies') {
            const cookieInput = new TextInputBuilder()
                .setCustomId('cookies')
                .setLabel("Cookies String")
                .setStyle(TextInputStyle.Paragraph);

            modal.addComponents(new ActionRowBuilder().addComponents(cookieInput));
        }

        await interaction.showModal(modal);
    }
    else if (interaction.customId.endsWith('login')) {
        const modal = new ModalBuilder()
            .setCustomId(`loginSparx_${modalAction}${actionSuffix}`)
            .setTitle(modalAction === 'positiveNoun' ? 'Sparx Login - Change Noun' : 'Sparx Login');

        const buttons = [];

        const schoolInput = new TextInputBuilder()
            .setCustomId('school')
            .setLabel("School")
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
        .setPlaceholder("Normal/Microsoft/Google")
        .addOptions(
            { label: "Normal", value: "Normal", emoji: emojis.sparx },
            { label: "Microsoft", value: "Microsoft", emoji: emojis.microsoft },
            { label: "Google", value: "Google", emoji: emojis.google }
        );

        buttons.push(schoolInput, emailInput, passwordInput); // flags: 32768
        for (const button of buttons) {
            modal.addComponents(new ActionRowBuilder().addComponents(button));
        }

        const typeLabel = new LabelBuilder({
            label: 'Login Type',
            component: typeInput
        });
        modal.addLabelComponents(typeLabel);

        await interaction.showModal(modal);

    } else if (interaction.customId.endsWith('cookies')) {
        const modal = new ModalBuilder()
            .setCustomId(`loginSparxC_${modalAction}${actionSuffix}`)
            .setTitle(modalAction === 'positiveNoun' ? 'Sparx Login - Change Noun' : 'Sparx Login');

        const cookieInput = new TextInputBuilder()
            .setCustomId('cookies')
            .setLabel("Cookies String")
            .setStyle(TextInputStyle.Paragraph);

        modal.addComponents(new ActionRowBuilder().addComponents(cookieInput));

        await interaction.showModal(modal);
    }
}

module.exports = { handleSparxLogin };