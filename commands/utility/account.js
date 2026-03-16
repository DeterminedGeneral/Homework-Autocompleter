const { SlashCommandBuilder, TextInputStyle, ModalBuilder, StringSelectMenuBuilder, LabelBuilder, TextInputBuilder, ComponentType, ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { checkAccount, activateFreeTrial } = require('../../database/accounts');
const config = require('../../config.json');
const queueRanksPositions = config.queue_ranks;
const emojis = config.emojis;
const whatRole = require('../../utils/whatRole');
const formatTime = require('../../utils/formatTime');
const { handleSettings } = require('../../settings/router');
const { name } = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('account')
        .setDescription(`View your ${name} Account`),
    public: true,
    async execute(interaction) {
        const seperator = new SeparatorBuilder({
            spacing: SeparatorSpacingSize.Small
        });

        const roleID = whatRole(await interaction.guild.members.fetch(interaction.user.id));
        const userRole = Object.keys(queueRanksPositions).find(key => queueRanksPositions[key] === roleID) ?? null;
        console.log(userRole);
        const account = await checkAccount(interaction.user.id, userRole);

        if (account) {

            let totalUses = 0;
            let platformsUsed = '';
            let timeSaved = 0;
            let timeSavedPlatforms = '';
            for (const [name, platform] of Object.entries(account.total_usage)) {
                totalUses += platform.total_uses;
                platformsUsed += `${name.charAt(0).toUpperCase() + name.slice(1)}: ${platform.total_uses}\n`;
                timeSaved += platform.time_saved;
                timeSavedPlatforms += `${name.charAt(0).toUpperCase() + name.slice(1)}: ${formatTime(platform.time_saved)}\n`;
            }

            let usages = '';
            for (const [platform, usage] of Object.entries(account.uses)) {
                usages += `${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${usage.length}/${account.slots}\n`;
            }

            const section = new TextDisplayBuilder().setContent(`## <@${interaction.user.id}>'s Account\n**Total Usage**: You have used the bot a total of **${totalUses}** times.\n**Slots Limit**: You have an account slots limit of **${account.slots}**.\n**Account Rank**: Your current account rank is **${account.license ?? 'None'}**.\n### Account Slots (Last 24 Hours)\n\`\`\`js\n${usages || 'No slots used in the past 24 Hours'}\`\`\``);

            const statsBtn = new ButtonBuilder()
                .setCustomId('view_stats')
                .setLabel('View Stats')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.stats);

            const savedBtn = new ButtonBuilder()
                .setCustomId('manage_saved_accounts')
                .setLabel('Saved Accounts')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.accounts);

            const mainBtn = new ButtonBuilder()
                .setCustomId('configure_main_accounts')
                .setLabel('Main Accounts')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.main_accounts);

            const settingBtn = new ButtonBuilder()
                .setCustomId('settings')
                .setLabel('Settings')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.settings);

            const freetrialBtn = new ButtonBuilder()
                .setCustomId('activate_free_trial')
                .setLabel('Activate Free Trial')
                .setEmoji(emojis.tick)
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(statsBtn, savedBtn);
            const row2 = new ActionRowBuilder().addComponents(mainBtn, settingBtn);
            if (account.free_trial_start === null && !account.license) {
                row2.addComponents(freetrialBtn);
            }

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
                    row,
                    row2
                );

            const message_sent = await interaction.reply({
                flags: 32768 | 64,
                components: [container],
                fetchReply: true
            });

            const collector = message_sent.createMessageComponentCollector({
                componentType: ComponentType.Button
            });

            collector.on('collect', async (buttonInteraction) => {

                if (buttonInteraction.customId === 'settings') {
                    const modal = new ModalBuilder()
                        .setCustomId('handleSettings')
                        .setTitle('Settings for Platform...');

                    /*
                        { label: "LanguageNut", value: "languagenut", emoji: emojis.languagenut },
                        { label: "Educake", value: "educake", emoji: emojis.educake },
                        { label: "Seneca", value: "seneca", emoji: emojis.seneca },
                        { label: "DrFrost", value: "drfrost", emoji: emojis.drfrost }
                    */
                    const sparxInput = new StringSelectMenuBuilder()
                        .setCustomId('platform')
                        .setPlaceholder("Platform")
                        .addOptions(
                            { label: "General", value: "general"},
                            { label: "Reader", value: "reader", emoji: emojis.reader },
                            { label: "Maths", value: "maths", emoji: emojis.maths },
                            { label: "Science", value: "science", emoji: emojis.science }
                        );

                    const typeLabel = new LabelBuilder({
                        label: 'Platform',
                        component: sparxInput
                    });
                    modal.addLabelComponents(typeLabel);
                    await buttonInteraction.showModal(modal);
                    return;
                    // await handleSettings(buttonInteraction);
                }

                await buttonInteraction.deferUpdate();

                if (buttonInteraction.customId === 'view_stats') {
                    const section = new TextDisplayBuilder().setContent(`## 📊 Statistics\n**Total Usage**: You have used the bot a total of **${totalUses}** times.\n**Time Saved**: You have saved **${formatTime(timeSaved)}** of time.\n### Platform Usage\n\`\`\`js\n${platformsUsed}\`\`\`\n### Time Saved\n\`\`\`js\n${timeSavedPlatforms}\`\`\``);

                    // 3. Assemble everything into the main container
                    const container = new ContainerBuilder()
                        .setAccentColor(0x353839)
                        .addTextDisplayComponents(
                            section.data
                        );

                    await buttonInteraction.followUp({
                        flags: 32768 | 64,
                        components: [container]
                    });
                } else if (buttonInteraction.customId === 'manage_saved_accounts') {

                    const section = new TextDisplayBuilder().setContent(`## 🗂️ Saved Accounts\nManage all your saved accounts. You can save accounts by clicking on the \`Save Account\` button at the homework selection on one of our services, this option only appears if you **did not** login with cookies.\n### Warning: Changing your Master Password will delete all saved accounts!`);

                    const statsBtn = new ButtonBuilder()
                        .setCustomId("view_accounts")
                        .setLabel('View Accounts')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.accounts);

                    const savedBtn = new ButtonBuilder()
                        .setCustomId("change_master_password")
                        .setLabel('Change Master Password')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.key);

                    const row = new ActionRowBuilder().addComponents(statsBtn, savedBtn);

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

                    const message_sent = await buttonInteraction.followUp({
                        flags: 32768 | 64,
                        components: [container],
                        fetchReply: true
                    });

                    const collector = message_sent.createMessageComponentCollector({
                        componentType: ComponentType.Button
                    });

                    collector.on('collect', async (accountInteraction) => {
                        const buttons = [];
                        const schoolInput = new TextInputBuilder()
                            .setCustomId('master_password')
                            .setLabel("Master Password")
                            .setStyle(TextInputStyle.Short);

                        buttons.push(schoolInput);
                        if (accountInteraction.customId === 'view_accounts') {
                            const modal = new ModalBuilder()
                                .setCustomId('view_accounts')
                                .setTitle('Saved Accounts Login');

                            for (const button of buttons) {
                                modal.addComponents(new ActionRowBuilder().addComponents(button));
                            }

                            await accountInteraction.showModal(modal);
                        } else if (accountInteraction.customId === 'change_master_password') {
                            const modal = new ModalBuilder()
                                .setCustomId('change_master_password')
                                .setTitle('Change Master Password');

                            for (const button of buttons) {
                                modal.addComponents(new ActionRowBuilder().addComponents(button));
                            }

                            await accountInteraction.showModal(modal);
                        }

                    });
                } else if (buttonInteraction.customId === 'configure_main_accounts') {
                    let configured = '';
                    for (const mainAccount of Object.keys(account.main_accounts)) {
                        configured += `${mainAccount.charAt(0).toUpperCase() + mainAccount.slice(1)}: Configured\n`;
                    }
                    const section = new TextDisplayBuilder().setContent(`## 🔒 Configure Main Accounts\nConfigure your main accounts for each platform. Main accounts do **not** count towards your accounts slots. **Your main accounts should only be your own personal accounts**, this is so you can still do *your* homework if you use up your daily slots and it is also used to prevent free trial abusing.\n### Main Accounts Configured\n\`\`\`js\n${configured || 'You have no Main Accounts Configured'}\`\`\`\n### Warning: Configuring a Main Account is irreversible!`);

                    const statsBtn = new ButtonBuilder()
                        .setCustomId("add_main_account")
                        .setLabel('Add Main Account')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.main_accounts);

                    const cookieBtn = new ButtonBuilder()
                        .setCustomId("add_main_cookie_account")
                        .setLabel('Add Main Account with Cookies (Sparx Only)')
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

                    const message_sent = await buttonInteraction.followUp({
                        flags: 32768 | 64,
                        components: [container],
                        fetchReply: true
                    });

                    const collector = message_sent.createMessageComponentCollector({
                        componentType: ComponentType.Button
                    });

                    collector.on('collect', async (accountInteraction) => {

                        const modal = new ModalBuilder()
                            .setCustomId('main_account_configure')
                            .setTitle('Main Account Configuration');

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

                } else if (buttonInteraction.customId === 'activate_free_trial') {
                    if (!Object.keys(account.main_accounts).length) {

                        const section = new TextDisplayBuilder().setContent(`### No Main Accounts Exist\nYou have no main accounts configured. Please configure at least one main account to activate your free trial. If you have *just* configured a main account, please run the command \`/account\` again.`);

                        const container = new ContainerBuilder()
                            .setAccentColor(0xFF474D)
                            .addTextDisplayComponents(
                                section.data
                            );

                        await buttonInteraction.followUp({
                            flags: 32768 | 64,
                            components: [container]
                        });

                        return;
                    }
                    const freeTrailActivatedSuccess = await activateFreeTrial(buttonInteraction.user.id);
                    if (freeTrailActivatedSuccess) {
                        const freetrialRoleId = queueRanksPositions["free-trial"];

                        try {
                            await interaction.member.roles.add(freetrialRoleId);
                        } catch (error) {
                            console.error(error);
                        }
                        const section = new TextDisplayBuilder().setContent(`### Free Trial Activated\nYour 3-day Free Trial for ${name} has been successfully activated!`);

                        const container = new ContainerBuilder()
                            .setAccentColor(0x90EE90)
                            .addTextDisplayComponents(
                                section.data
                            );

                        await buttonInteraction.followUp({
                            flags: 32768 | 64,
                            components: [container]
                        });
                    } else {
                        const section = new TextDisplayBuilder().setContent(`### Free Trial Already Exists\nYou already activated your Free Trial.`);

                        const container = new ContainerBuilder()
                            .setAccentColor(0xFF474D)
                            .addTextDisplayComponents(
                                section.data
                            );

                        await buttonInteraction.followUp({
                            flags: 32768 | 64,
                            components: [container]
                        });
                    }
                }
            });
        } else {

            const section = new TextDisplayBuilder().setContent(`## Create an Account\nBy creating an account, you agree to the Terms of Service of ${name} which can be found at https://discord.com/channels/1351338824759906345/1446936637627043932`);

            const statsBtn = new ButtonBuilder()
                .setCustomId('agree')
                .setLabel('I Agree')
                .setEmoji(emojis.tick)
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(statsBtn);

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

            const message_sent = await interaction.reply({
                flags: 32768 | 64,
                components: [container],
                fetchReply: true
            });

            const collector = message_sent.createMessageComponentCollector({
                componentType: ComponentType.Button
            });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.customId === 'agree') {
                    await buttonInteraction.deferUpdate();
                    const section = new TextDisplayBuilder().setContent(`## Create Master Password\nCreate a Master Password that will be used whenever you choose to save an account one of our services. The option to save an account will be provided at the homework selection assuming you **did not** login with cookies. You will be prompted to input your Master Password whenever you try to save an account.\n\nThe Master Password stored in the Database is hashed and all saved account data is encrypted. Consequently, we **cannot view your saved accounts or master password** meaning all saved accounts are deleted when changing the Master Password.`);

                    const statsBtn = new ButtonBuilder()
                        .setCustomId('create_master_password')
                        .setLabel('Create Master Password')
                        .setEmoji(emojis.key)
                        .setStyle(ButtonStyle.Primary);

                    const row = new ActionRowBuilder().addComponents(statsBtn);
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

                    await buttonInteraction.editReply({
                        flags: 32768 | 64,
                        components: [container]
                    });
                } else if (buttonInteraction.customId === 'create_master_password') {
                    const buttons = [];
                    const schoolInput = new TextInputBuilder()
                        .setCustomId('master_password')
                        .setLabel("Master Password")
                        .setStyle(TextInputStyle.Short);

                    buttons.push(schoolInput);
                    const modal = new ModalBuilder()
                        .setCustomId('create_master_password')
                        .setTitle('Saved Accounts Login');

                    for (const button of buttons) {
                        modal.addComponents(new ActionRowBuilder().addComponents(button));
                    }

                    await buttonInteraction.showModal(modal);
                }
            });
        }
    },
};