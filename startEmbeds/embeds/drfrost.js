const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, SectionBuilder } = require('discord.js');
const info = require('../info');

const seperator = new SeparatorBuilder({
    spacing: SeparatorSpacingSize.Small
});

const section = new SectionBuilder()
.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# DrFrost\nAutomate your Dr Frost homework with >90% Accuracy and a customisable time to mimic real completion time!\n## ✨ Features\n- ⏰ **Customisable Time** — Autocompletes your DrFrost homework in whatever time you want to balance speed and detection! \n- 🎯 **Very High Accuracy** — Excellent accuracy of >90% at completing questions!\n- 🧠 **Easy To Use** — Simple and intuitive to use with the press of only a few buttons!`)
)
.setThumbnailAccessory(new ThumbnailBuilder({ media: { url: 'https://cdn.discordapp.com/attachments/1359147152609378324/1473296788554514590/drfrost.jpg?ex=6995b20e&is=6994608e&hm=ddf7f36ac38ea41a0c1f4be33f47d935477031030704ea12dd58807f83b0eb34&' } }));
// 2. Create the buttons and the action row
const mathButtons = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('drfrost_login')
            .setLabel('Login')
            .setStyle(ButtonStyle.Success)
            .setEmoji(info.emojis.login),
    );

// 3. Assemble everything into the main container
const container = new ContainerBuilder()
    .setAccentColor(0xe5ac3f)
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