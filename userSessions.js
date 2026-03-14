const { SectionBuilder, SeparatorSpacingSize, ThumbnailBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { emojis } = require('./config.json');
const queueRanks = require('./config.json');
const saveAccountBtn = new ButtonBuilder()
    .setCustomId('save_account')
    .setLabel('Save Account')
    .setEmoji(emojis.save_account)
    .setStyle(ButtonStyle.Secondary);
const tagChangerBtn = new ButtonBuilder()
    .setCustomId('tag_changer')
    .setLabel('Tag Changer')
    .setEmoji(emojis.tag_changer)
    .setStyle(ButtonStyle.Secondary);

class UserSession {
    constructor(sparxClass) {
        // Core Logic
        this.sparxClass = sparxClass;

        // Discord Context (Common to all)
        this.interaction = null;
        this.message_sent = null;

        this.selectRow = null;

        // User Identity (Common to all)
        this.userInfo = null;
        this.givenName = "";
        this.userDisplayName = "";
    }

    loadFromObject(data) {
        Object.assign(this, data);
    }
}

class ReaderSession extends UserSession {
    constructor(sparxClass) {
        super(sparxClass);

        // Reader Specific Settings
        this.points = 0;
        this.wpm = 0;
        this.mode = 'Read Until Points Target Achieved';
        this.goldReader = false;
        // Reader Specific UI State
        this.selectedBook = null;
    }

    async updateEmbed(disabled = false) {
        const goldEmoji = this.goldReader ? emojis.goldtrue : emojis.goldfalse;

        const loginSuccessSection = new TextDisplayBuilder().setContent(`## Library\nWelcome, ${goldEmoji} **${this.userInfo.givenName} the ${this.userDisplayName}**!`);
        const sectionThumb = new SectionBuilder()
            .addTextDisplayComponents(
                loginSuccessSection.data
            )
            .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: 'https://i.postimg.cc/cJQg4QDt/library-book.webp' } }));
        const settingsSetup = new TextDisplayBuilder().setContent(`### Settings`);

        if (this.selectRow) {
            this.selectRow.setDisabled(disabled);
        }

        const selectButton = new ActionRowBuilder()
            .addComponents(
                this.selectRow
            );

        const startRow = new ActionRowBuilder();
        if (this.selectedBook) {
            const startButton = new ButtonBuilder()
                .setCustomId('start_reader')
                .setLabel('Start')
                .setEmoji(emojis.tick)
                .setStyle(ButtonStyle.Success)
                .setDisabled(disabled);
            startRow.addComponents(startButton);
        }

        const modeButton = new ButtonBuilder()
            .setCustomId('mode')
            .setLabel('Mode')
            .setEmoji(emojis.x)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled);
        startRow.addComponents(modeButton);

        if (this.sparxClass.login.email) {
            const saveAccountBtnCopy = ButtonBuilder.from(saveAccountBtn);
            saveAccountBtnCopy.setDisabled(disabled);
            startRow.addComponents(saveAccountBtnCopy);
        }

        const tagBtnCopy = ButtonBuilder.from(tagChangerBtn);
        tagBtnCopy.setDisabled(disabled);
        startRow.addComponents(tagBtnCopy);
        const settingBtn = new ButtonBuilder()
            .setCustomId('settings')
            .setLabel('Settings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.settings)
            .setDisabled(disabled);
        startRow.addComponents(settingBtn);

        const settingsEmbed = new ContainerBuilder()
            .setAccentColor(0x4467C4)
            .addSectionComponents(
                sectionThumb
            )
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(
                settingsSetup.data
            )
            .addTextDisplayComponents([new TextDisplayBuilder().setContent(`⏰ **Words Per Minute**: ${this.wpm}`), new TextDisplayBuilder().setContent(`⭐️ **Sparx Reader Points**: ${this.points}`), new TextDisplayBuilder().setContent(`📖 **Mode**: *${this.mode}*`)])
            .addActionRowComponents(
                selectButton,
                startRow
            );

        const message_sent = await this.interaction.editReply({
            components: [settingsEmbed]
        });

        console.log('Setting embed sent successfully');

        this.message_sent = message_sent;
    }

}

// Optional: Create an intermediate class for Maths/Science since they share Time logic
class TimedHomeworkSession extends UserSession {
    constructor(sparxClass) {
        super(sparxClass);
        this.min = 60;
        this.max = 100;
    }
}

class MathsSession extends TimedHomeworkSession {
    constructor(sparxClass) {
        super(sparxClass);

        // Maths Specific Settings
        this.pdfSettings = {
            question: false,
            working_out: false
        };
    }

    async updateEmbed(disabled = false) {
        const welcomeMessage = `## Sparx Maths Autocompleter\nWelcome, **${this.givenName} the ${this.userDisplayName}**!\nSelect a homework and it automatically will be completed for you!`;
        const loginSuccessSection = new TextDisplayBuilder().setContent(`${welcomeMessage}`);
        const settingsSetup = new TextDisplayBuilder().setContent(`### Settings`);
        const pdfSet = new TextDisplayBuilder().setContent(`**📜 PDF **\n**Answers**  \`\`✅\`\`\n**Questions**  ${this.pdfSettings.question ? '``✅``' : '``❌``'}\n**Working Out**  ${this.pdfSettings.working_out ? '``✅``' : '``❌``'}`);
        const minTime = new TextDisplayBuilder().setContent(`⏰ **Minimum Fake Time**: ${this.min} Seconds`);
        const maxTime = new TextDisplayBuilder().setContent(`⏰ **Maximum Fake Time**: ${this.max} Seconds`);

        const IndependentLearningButton = new ButtonBuilder()
            .setCustomId('independent_learning')
            .setLabel('Independent Learning')
            .setEmoji(emojis.independent_learning)
            .setDisabled(disabled)
            .setStyle(ButtonStyle.Primary);

        const settingsRow = new ActionRowBuilder()
            .addComponents(IndependentLearningButton);

        const startRow = new ActionRowBuilder();
        if (this.selectedHomework) {
            const startButton = new ButtonBuilder()
                .setCustomId('start_maths')
                .setLabel('Start')
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.tick)
                .setDisabled(disabled);
            startRow.addComponents(startButton);
        }

        if (this.sparxClass.login.email) {
            const saveAccountBtnCopy = ButtonBuilder.from(saveAccountBtn);
            saveAccountBtnCopy.setDisabled(disabled);
            startRow.addComponents(saveAccountBtnCopy);
        }

        const tagBtnCopy = ButtonBuilder.from(tagChangerBtn);
        tagBtnCopy.setDisabled(disabled);
        startRow.addComponents(tagBtnCopy);
        const settingBtn = new ButtonBuilder()
            .setCustomId('settings')
            .setLabel('Settings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.settings)
            .setDisabled(disabled);
        startRow.addComponents(settingBtn);

        const mathsEmbed = new ContainerBuilder()
            .setAccentColor(0x4467C4)
            .addTextDisplayComponents(
                loginSuccessSection.data
            )
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(
                settingsSetup.data,
                pdfSet.data,
                minTime.data,
                maxTime.data
            );
        if (this.selectRow && this.selectRow.options && this.selectRow.options.length) {
            this.selectRow.setDisabled(disabled);
            mathsEmbed.addActionRowComponents(new ActionRowBuilder().addComponents(this.selectRow));
        }
        mathsEmbed.addActionRowComponents(settingsRow, startRow);
        const message_sent = await this.interaction.editReply({
            components: [mathsEmbed]
        });

        this.message_sent = message_sent;
    }
}

class ScienceSession extends TimedHomeworkSession {
    constructor(sparxClass) {
        super(sparxClass);
        // Science currently has no unique settings other than the shared Time logic
    }

    async updateEmbed(disabled = false) {
        const loginSuccessSection = new TextDisplayBuilder().setContent(`## Sparx Science Autocompleter\nWelcome, **${this.givenName} the ${this.userDisplayName}**!`);
        const settingsSetup = new TextDisplayBuilder().setContent(`### Settings`);
        const minTime = new TextDisplayBuilder().setContent(`⏰ **Minimum Fake Time**: ${this.min} Seconds`);
        const maxTime = new TextDisplayBuilder().setContent(`⏰ **Maximum Fake Time**: ${this.max} Seconds`);

        const IndependentLearningButton = new ButtonBuilder()
            .setCustomId('independent_learning')
            .setLabel('Independent Learning')
            .setEmoji(emojis.independent_learning)
            .setDisabled(disabled)
            .setStyle(ButtonStyle.Primary);

        const settingsRow = new ActionRowBuilder()
            .addComponents(IndependentLearningButton);

        const startRow = new ActionRowBuilder();
        if (this.selectedHomework) {
            const startButton = new ButtonBuilder()
                .setCustomId('start_science')
                .setLabel('Start')
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.tick)
                .setDisabled(disabled);
            startRow.addComponents(startButton);
        }

        if (this.sparxClass.login.email) {
            const saveAccountBtnCopy = ButtonBuilder.from(saveAccountBtn);
            saveAccountBtnCopy.setDisabled(disabled);
            startRow.addComponents(saveAccountBtnCopy);
        }

        const tagBtnCopy = ButtonBuilder.from(tagChangerBtn);
        tagBtnCopy.setDisabled(disabled);
        startRow.addComponents(tagBtnCopy);
        const settingBtn = new ButtonBuilder()
            .setCustomId('settings')
            .setLabel('Settings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.settings)
            .setDisabled(disabled);
        startRow.addComponents(settingBtn);

        const mathsEmbed = new ContainerBuilder()
            .setAccentColor(0x1d9b8f)
            .addTextDisplayComponents(
                loginSuccessSection.data
            )
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(
                settingsSetup.data,
                minTime.data,
                maxTime.data
            );
        if (this.selectRow && this.selectRow.options && this.selectRow.options.length) {
            this.selectRow.setDisabled(disabled);
            mathsEmbed.addActionRowComponents(new ActionRowBuilder().addComponents(this.selectRow));
        }
        mathsEmbed.addActionRowComponents(settingsRow, startRow);
        const message_sent = await this.interaction.editReply({
            components: [mathsEmbed]
        });

        this.message_sent = message_sent;
    }
}

module.exports = { ReaderSession, MathsSession, ScienceSession };