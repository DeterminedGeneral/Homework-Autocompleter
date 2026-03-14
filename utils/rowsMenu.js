const { ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder  } = require('discord.js');
const shorten = require('./shorten');

class rowsMenu {
    constructor(items, itemPerRow=5) {
        this.items = items;
        this.totalPages = Math.ceil(items.length / itemPerRow);
        this.itemPerRow = itemPerRow;
        this.page = 0;
    }

    createDropdown() {
        const startIndex = this.page * this.itemPerRow;
        const endIndex = Math.min(startIndex + this.itemPerRow, this.items.length);

        const select = new StringSelectMenuBuilder()
            .setCustomId('select')
            .setPlaceholder(`Choose (Page ${this.page + 1}/${this.totalPages})`);

        for (let i = startIndex; i < endIndex; i++) {
            select.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(shorten(this.items[i].label, 100))
                    .setValue(this.items[i].value)
            );
        }

        return select;
    }

    createNavigationButtons() {
        const skipBackButton = new ButtonBuilder()
            .setCustomId('nav_skip_back')
            .setLabel('◀◀')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(this.page === 0);

        const prevButton = new ButtonBuilder()
            .setCustomId('nav_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(this.page === 0);

        const nextButton = new ButtonBuilder()
            .setCustomId('nav_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(this.page === this.totalPages - 1);

        const skipForwardButton = new ButtonBuilder()
            .setCustomId('nav_skip_forward')
            .setLabel('▶▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(this.page === this.totalPages - 1);

        return new ActionRowBuilder().addComponents(skipBackButton, prevButton, nextButton, skipForwardButton);
    }

    handleButton(interaction) {
        if (interaction.customId.endsWith('skip_back')) {
            this.page = 0;
        } else if (interaction.customId.endsWith('skip_forward')) {
            this.page = this.totalPages-1;
        } else if (interaction.customId.endsWith('next')) {
            this.page += 1;
        } else if (interaction.customId.endsWith('prev')) {
            this.page -= 1;
        }
    }

}

module.exports = rowsMenu;