const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, SectionBuilder } = require('discord.js');
const info = require('../info');

const seperator = new SeparatorBuilder({
    spacing: SeparatorSpacingSize.Small
});

const section = new SectionBuilder()
.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# Educake\nAutomate your Educake homework with >90% accuracy and a customisable time!${info.legalDisclamer}\n## ✨ Features\n- ⏰ **Customisable Time** — Autocompletes your Educake homework in whatever time you want to balance speed and detection!\n- 🎯 **High Accuracy** — Excellent accuracy of >90% at completing questions!\n- 🧠 **Easy To Use** — Simple and intuitive to use with the press of only a few buttons!`)
)
.setThumbnailAccessory(new ThumbnailBuilder({ media: { url: 'https://i.postimg.cc/VNLwXfqj/educake-logo-favicon.png' } }));
// 2. Create the buttons and the action row
const mathButtons = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('educake_login')
            .setLabel('Login')
            .setStyle(ButtonStyle.Success)
            .setEmoji(info.emojis.login),
    );

// 3. Assemble everything into the main container
const container = new ContainerBuilder()
    .setAccentColor(0x7a5b99)
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