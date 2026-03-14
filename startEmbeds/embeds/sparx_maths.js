const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, SectionBuilder } = require('discord.js');
const info = require('../info');

const seperator = new SeparatorBuilder({
    spacing: SeparatorSpacingSize.Small
});

const section = new SectionBuilder()
.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# Sparx Maths\nAutomate your Sparx Maths homework with high accuracy and zero detection by your teacher. Simply press \`Login\` and follow the instructions to be on your way to acing your Sparx Maths homework and never fearing of Sparx Maths again in your life!${info.legalDisclamer}\n## ✨ Features\n- ⏰ **Takes Less than 10 Minutes of Real Time** — Autocompletes your Sparx Maths homework in less than 10 minute of real-time!\n- 🎯 **Very High Accuracy** — Excellent accuracy of >90% at completing questions and 100% at bookwork checks!\n- 🕵️‍♂️ **Simulated Time** — Simulate realistic completion time to mimic real effort!\n- 📖 **Detailed PDF of Bookworks** — A Detailed PDF of all Bookworks is provided at the end of each session that can be copied down to trick any demanding teachers!\n- 🧠 **Easy To Use** — Simple and intuitive to use with the press of only a few buttons!`)
)
.setThumbnailAccessory(new ThumbnailBuilder({ media: { url: 'https://i.imgur.com/C90kXPO.png' } }));
// 2. Create the buttons and the action row
const mathButtons = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('sparx_maths_show_login')
            .setLabel('Login')
            .setStyle(ButtonStyle.Success)
            .setEmoji(info.emojis.login),
        new ButtonBuilder()
            .setCustomId('check_queue_maths')
            .setLabel('Check Queue')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(info.emojis.queue)
    );

// 3. Assemble everything into the main container
const container = new ContainerBuilder()
    .setAccentColor(0x0099FF)
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