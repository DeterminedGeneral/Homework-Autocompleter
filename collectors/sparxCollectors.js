const { ComponentType, ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { handleSparxLogin } = require('../handlers/sparxLoginHandler');
const { handleSavedAccounts } = require('../handlers/savedAccountsHandler.js');
const { validAccount } = require('../handlers/accountHandler.js');
const { emojis } = require('../config.json');

const helpSteps = [
    {
        title: "Step 1: Download the extension",
        description: "Download the Cookie Getter Extension below.",
        gif: "https://cdn.discordapp.com/attachments/1352797472652525649/1476330466612347091/sparxnow.gif?ex=69a0bb64&is=699f69e4&hm=c9b27fc91ed990674e9c0f485ac458d2820b974e204bf677530d4d0622c7ce5b&",
        attachment: "https://cdn.discordapp.com/attachments/1468312023623536835/1469772855880319189/Sparx_Cookie_Getter.zip?ex=69a09b23&is=699f49a3&hm=76448b7af46af88510adcf3b05440c2b8aabf87a770edc96363f5556043f5bca&"
    },
    {
        title: "Step 2: Extract the zip file",
        description: "Extract the file by right clicking on the zip file and selecting ``Extract``.",
        gif: "https://cdn.discordapp.com/attachments/1352797472652525649/1476330466612347091/sparxnow.gif?ex=69a0bb64&is=699f69e4&hm=c9b27fc91ed990674e9c0f485ac458d2820b974e204bf677530d4d0622c7ce5b&"
    },
    {
        title: "Step 3: Add the extension",
        description: "Go to ``extensions`` in your browser by typing ``chrome://extensions`` in your web bar.\n> If you use a different browser other than chrome, it is your browser name and then extensions: ``edge://extensions`` for example.",
        gif: "https://cdn.discordapp.com/attachments/1352797472652525649/1476330466612347091/sparxnow.gif?ex=69a0bb64&is=699f69e4&hm=c9b27fc91ed990674e9c0f485ac458d2820b974e204bf677530d4d0622c7ce5b&"
    },
    {
        title: "Step 4: Turn on Developer Mode",
        description: "Turn on developer mode in the top right corner of the extensions page.",
        gif: "https://cdn.discordapp.com/attachments/1352797472652525649/1476330466612347091/sparxnow.gif?ex=69a0bb64&is=699f69e4&hm=c9b27fc91ed990674e9c0f485ac458d2820b974e204bf677530d4d0622c7ce5b&"
    },
    {
        title: "Step 5: Load the extension",
        description: "Click on ``Load unpacked`` and select the folder where you extracted the extension.",
        gif: "https://cdn.discordapp.com/attachments/1352797472652525649/1476330466612347091/sparxnow.gif?ex=69a0bb64&is=699f69e4&hm=c9b27fc91ed990674e9c0f485ac458d2820b974e204bf677530d4d0622c7ce5b&"
    },
    {
        title: "Step 6: Get your cookie",
        description: "Go on the homework website, click on the extension, click copy, and then paste it in Discord.",
        gif: "https://cdn.discordapp.com/attachments/1352797472652525649/1476330466612347091/sparxnow.gif?ex=69a0bb64&is=699f69e4&hm=c9b27fc91ed990674e9c0f485ac458d2820b974e204bf677530d4d0622c7ce5b&"
    }
];

function getLoginContainer(nameL) {
    const idValues = {};
    if (nameL === 'Maths') {
        idValues['loginBtn'] = 'login';
        idValues['loginCookieBtn'] = 'login_cookies';
        idValues['nameL'] = 'Maths';
        idValues['nameS'] = 'maths';
    } else if (nameL === 'Reader') {
        idValues['loginBtn'] = 'sparxreader_login';
        idValues['loginCookieBtn'] = 'sparxreader_login_cookies';
        idValues['nameL'] = 'Reader';
        idValues['nameS'] = 'reader';
    } else if (nameL === 'Science') {
        idValues['loginBtn'] = 'sparxscience_login';
        idValues['loginCookieBtn'] = 'sparxscience_login_cookies';
        idValues['nameL'] = 'Science';
        idValues['nameS'] = 'science';
    }

    const loginBtn = new ButtonBuilder()
        .setCustomId(idValues['loginBtn'])
        .setLabel('Login')
        .setStyle(ButtonStyle.Success)
        .setEmoji(emojis.login);

    const loginCookieBtn = new ButtonBuilder()
        .setCustomId(idValues['loginCookieBtn'])
        .setLabel('Login with Cookies')
        .setStyle(ButtonStyle.Success)
        .setEmoji(emojis.cookies);

    const savedBtn = new ButtonBuilder()
        .setCustomId(idValues['nameS'] + "_savedAccounts_view")
        .setLabel('Saved Accounts')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(emojis.accounts);

    const helpBtn = new ButtonBuilder()
        .setCustomId(`cookie_help_0_${idValues['nameL']}`)
        .setLabel('Help')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.help || '❔');

    const row = new ActionRowBuilder().addComponents(loginBtn, loginCookieBtn, savedBtn);
    const row2 = new ActionRowBuilder().addComponents(helpBtn);

    let embedColor;
    if (idValues['nameS'] === 'reader') {
        embedColor = 0x4467C4; // Sparx Reader purple
    } else if (idValues['nameS'] === 'maths') {
        embedColor = 0x0099FF; // Sparx Maths blue
    } else {
        embedColor = 0x1d9b8f; // Sparx Science teal
    }

    const seperator = new SeparatorBuilder({
        spacing: SeparatorSpacingSize.Small
    });

    const section = new TextDisplayBuilder().setContent(`# Sparx ${idValues['nameL']} Login\nUsing the regular \`\`Login\`\` is recommended but\nif you are unable to for any reasons, you can choose to \`\`Login with cookies\`\``);

    return new ContainerBuilder()
        .setAccentColor(embedColor)
        .addTextDisplayComponents(
            section.data
        )
        .addSeparatorComponents(
            seperator
        )
        .addActionRowComponents(
            row,
            row2
        );
}

function getHelpEmbed(stepIndex, nameL, accentColor) {
    const step = helpSteps[stepIndex];
    if (!step) return null;

    // Build the description text, appending a download link if there's an attachment
    let descriptionText = step.description;
    if (step.attachment) {
        descriptionText += `\n[📥 Download Extension](${step.attachment})`;
    }

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# ${step.title}`).data,
            new TextDisplayBuilder().setContent(descriptionText).data
        );

    if (step.gif) {
        const gallery = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL(step.gif));
        container.addMediaGalleryComponents(gallery);
    }

    container.addSeparatorComponents(new SeparatorBuilder({ spacing: SeparatorSpacingSize.Small }));

    const isFirstStep = stepIndex === 0;
    const backBtn = new ButtonBuilder()
        .setCustomId(isFirstStep ? `cookie_help_login_${nameL}` : `cookie_help_${stepIndex - 1}_${nameL}`)
        .setEmoji(emojis.arrow_left || '⬅️')
        .setStyle(ButtonStyle.Secondary);

    const middleBtn = new ButtonBuilder()
        .setCustomId(`cookie_help_noop_${stepIndex}`)
        .setEmoji(emojis.sparxnow || emojis.sparx || '🛡️')
        .setStyle(ButtonStyle.Secondary);

    const isLastStep = stepIndex === helpSteps.length - 1;
    const forwardBtn = new ButtonBuilder()
        .setCustomId(isLastStep ? `cookie_help_${nameL}_cookies` : `cookie_help_${stepIndex + 1}_${nameL}`)
        .setEmoji(emojis.arrow_right || '➡️')
        .setStyle(isLastStep ? ButtonStyle.Success : ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(backBtn, middleBtn, forwardBtn);
    container.addActionRowComponents(row);

    return container;
}

async function sparxReaderCollector(message) {
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button
    });

    collector.on('collect', async (interaction) => {
        try {

            if (await validAccount(interaction, 'sparx')) return;

            if (interaction.customId === 'sparx_maths_show_login' || interaction.customId === 'login' || interaction.customId === 'sparxreader' || interaction.customId === 'sparx_science_show_login') {
                // We no longer update the original persistent message here, so multiple users can press login at once.

                let nameL, nameS;
                const idValues = {};
                if (interaction.customId === 'sparx_maths_show_login' || interaction.customId === 'login') {
                    nameL = 'Maths';
                    nameS = 'maths';
                    idValues['loginBtn'] = 'login';
                    idValues['loginCookieBtn'] = 'login_cookies';
                } else if (interaction.customId === 'sparxreader') {
                    nameL = 'Reader';
                    nameS = 'reader';
                    idValues['loginBtn'] = 'sparxreader_login';
                    idValues['loginCookieBtn'] = 'sparxreader_login_cookies';
                } else if (interaction.customId === 'sparx_science_show_login') {
                    nameL = 'Science';
                    nameS = 'science';
                    idValues['loginBtn'] = 'sparxscience_login';
                    idValues['loginCookieBtn'] = 'sparxscience_login_cookies';
                }
                idValues['nameS'] = nameS;
                idValues['nameL'] = nameL;

                const container = getLoginContainer(nameL);
                const embedColor = container.data.accent_color;

                // console.log(container);

                try {
                    await interaction.reply({
                        flags: 32768 | 64,
                        components: [container]
                    });
                } catch {
                    return;
                }
                const replyMessage = await interaction.fetchReply();

                const collector = replyMessage.createMessageComponentCollector({
                    componentType: ComponentType.Button
                });

                collector.on('collect', async (buttonInteraction) => {
                    try {
                        if (buttonInteraction.customId === idValues['loginBtn']) {
                            await handleSparxLogin(buttonInteraction, `homework_${idValues['nameS']}`);
                        } else if (buttonInteraction.customId === idValues['loginCookieBtn']) {
                            await handleSparxLogin(buttonInteraction, `homework_${idValues['nameS']}`);
                        } else if (buttonInteraction.customId.startsWith(idValues['nameS'] + "_savedAccounts")) {
                            const action = buttonInteraction.customId.split('_')[2];
                            await handleSavedAccounts(buttonInteraction, action, idValues['nameS']);
                        } else if (buttonInteraction.customId.startsWith('cookie_help_')) {
                            if (buttonInteraction.customId.includes('_noop_')) {
                                await buttonInteraction.deferUpdate();
                                return;
                            }
                            if (buttonInteraction.customId.includes('_cookies')) {
                                const platform = buttonInteraction.customId.split('_')[2];
                                await handleSparxLogin(buttonInteraction, `homework_${platform.toLowerCase()}`);
                                return;
                            }
                            if (buttonInteraction.customId.includes('_login_')) {
                                const platform = buttonInteraction.customId.split('_')[3];
                                const loginContainer = getLoginContainer(platform);
                                await buttonInteraction.update({ components: [loginContainer] });
                                return;
                            }
                            const [, , stepIdx, platform] = buttonInteraction.customId.split('_');
                            const helpEmbed = getHelpEmbed(parseInt(stepIdx), platform, embedColor);
                            if (helpEmbed) {
                                await buttonInteraction.update({ components: [helpEmbed] });
                            }
                        }
                    } catch (err) {
                        console.error(`Error in Sparx ${idValues['nameL']} login sub-collector:`, err);
                        if (!buttonInteraction.replied && !buttonInteraction.deferred) {
                            try {
                                await buttonInteraction.reply({ content: 'An error occurred while processing your request.', flags: 64 });
                            } catch { }
                        }
                    }
                });

            } else if (interaction.customId.startsWith('check_queue')) {
                const { queueCollector } = require('../queues/queueCollecting.js');
                await queueCollector(interaction, interaction.customId.split('_')[2]);
            }
            else {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.deferUpdate();
                }
            }
        } catch (err) {
            console.error('Error in Sparx Maths collector:', err);
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ content: 'An error occurred while processing your request.', flags: 64 });
                } catch { }
            }
        }
    });
}

module.exports = { sparxReaderCollector };