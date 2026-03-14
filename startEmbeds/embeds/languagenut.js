const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, SectionBuilder } = require('discord.js');
const info = require('../info');

const seperator = new SeparatorBuilder({
    spacing: SeparatorSpacingSize.Small
});

const section = new SectionBuilder()
.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# LanguageNut\nAutomate your Languagenut homework with 100% Accuracy and a simulated time to mimic real completion time!${info.legalDisclamer}\n## ✨ Features\n- ⏰ **Instant** — Instantly completed at the press of a button! \n- 🎯 **Customisable Accuracy** — Set your target accuracy score!\n- 🕵️‍♂️ **Simulated Time** — Simulate realistic completion time to mimic real effort!`)
)
.setThumbnailAccessory(new ThumbnailBuilder({ media: { url: 'https://i.postimg.cc/tRnhvy7v/languagenut-png.webp' } }));
// 2. Create the buttons and the action row
const mathButtons = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('open_login_modal_languagenut')
            .setLabel('Login')
            .setStyle(ButtonStyle.Success)
            .setEmoji(info.emojis.login)
    );

// 3. Assemble everything into the main container
const container = new ContainerBuilder()
    .setAccentColor(0x11b6d4)
    .addSectionComponents(
        section
    )
    .addSeparatorComponents(
        seperator
    )

    .addActionRowComponents(
        mathButtons
    );

module.exports = container;