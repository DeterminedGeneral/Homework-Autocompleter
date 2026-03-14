const { LabelBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { ReaderSession } = require('../userSessions.js');
const { useUpSlot, cookieMenuCall, getSparxAccountId, positiveNounChanger } = require('./shared.js');
const { sparxReaderAutocomplete } = require('../sparx_reader/autocompleter.js');
const { handleSetting } = require('../settings/platforms/reader.js');
const { checkAccount } = require('../database/accounts.js');

async function readerExecutor(interaction, sparxReader, queue, existingAccount) {
    const { UserSessions } = require('../executeTasks.js');
    const UserSession = new ReaderSession(sparxReader);
    UserSessions.set(interaction.user.id, UserSession);

    const hasGoldReader = await sparxReader.getGoldReaderState();

    let goldReader = false;
    if (hasGoldReader?.passExpiry) {
        goldReader = true;
    }

    const userDisplayName = await sparxReader.getUserDisplayName() || 'User';
    const userInfo = await sparxReader.getUserInfo();

    console.log(existingAccount.sparx_reader_settings);
    // UserSession = { points: existingAccount.sparx_reader_settings.srp, wpm: existingAccount.sparx_reader_settings.wpm, message_sent: null, interaction: interaction, userInfo, userDisplayName, goldReader, selectedBook: null, mode: 'Read Until Points Target Achieved' };
    UserSession.loadFromObject({ points: existingAccount.sparx_reader_settings.srp, wpm: existingAccount.sparx_reader_settings.wpm, message_sent: null, interaction: interaction, userInfo, userDisplayName, goldReader, selectedBook: null, mode: 'Read Until Points Target Achieved' });

    const select = new StringSelectMenuBuilder()
        .setCustomId('sparxreader_homework')
        .setPlaceholder('Choose a book')
        .setMinValues(0);

    let booksAdded = 0;
    let currentSelectedBookId;

    const bookNames = {};
    let homeworkBooks = [];
    async function createBookSelector() {
        homeworkBooks = await sparxReader.getHomeworks();
        homeworkBooks.sort((a, b) => {
            // First: sort so that setBook === true comes first
            if (a.setBook !== b.setBook) {
                return a.setBook ? -1 : 1; // true before false
            }

            // Then: sort by progress descending
            return b.progress - a.progress;
        });

        booksAdded = 0;
        currentSelectedBookId = null;
        // UserSession.selectedBook = currentSelectedBookId;
        UserSession.loadFromObject({ selectedBook: currentSelectedBookId });
        for (const book of homeworkBooks) {
            booksAdded += 1;
            bookNames[book.bookId] = book.title;
            const option = new StringSelectMenuOptionBuilder()
                .setLabel(book.title)
                .setDescription(`${book.progress}%`)
                .setValue(book.bookId);
            if (book.bookId === currentSelectedBookId) {
                option.setDefault(true);
            }
            select.addOptions(option);
        }
    }

    await createBookSelector();

    if (booksAdded === 0) {
        const bookOptions = await sparxReader.getNewBookOptions();
        const bookUid = bookOptions.books[0].name.split('/')[1];
        await sparxReader.getBookTask(bookUid);
        await createBookSelector();
    }

    UserSession.loadFromObject({ selectRow: select });
    // UserSession.selectRow = select;

    await UserSession.updateEmbed();

    // const taskForQueue = 'library';

    const collector = UserSession.message_sent.createMessageComponentCollector({
        time: 180_000
    });

    collector.on('collect', async (componentInteraction) => {
        if (componentInteraction.user.id !== interaction.user.id) return;

        if (componentInteraction.isStringSelectMenu()) {
            await componentInteraction.deferUpdate();

            currentSelectedBookId = componentInteraction.values[0];
            UserSession.selectedBook = currentSelectedBookId;

            const newSelect = new StringSelectMenuBuilder()
                .setCustomId('sparxreader_homework')
                .setPlaceholder('Choose a book')
                .setMinValues(0);

            for (const book of homeworkBooks) {
                const option = new StringSelectMenuOptionBuilder()
                    .setLabel(book.title)
                    .setDescription(`${book.progress}%`)
                    .setValue(book.bookId);
                if (book.bookId === currentSelectedBookId) {
                    option.setDefault(true);
                }
                newSelect.addOptions(option);
            }

            UserSession.selectRow = newSelect;

            await UserSession.updateEmbed();
        } else if (componentInteraction.isButton()) {
            if (componentInteraction.customId === 'start_reader') {
                await componentInteraction.deferUpdate();
                console.log('Start reader button clicked, deferUpdate completed');

                const selectedBook = UserSession.selectedBook;
                console.log('Selected book:', selectedBook);

                if (!selectedBook) {
                    console.log('No book selected, showing error message');
                    await componentInteraction.followUp({ content: 'Please select a book first.', ephemeral: true });
                    return;
                }
                console.log('Book selection check passed');

                try {
                    console.log('Advancing queue to autocompleter');

                    console.log('Creating disabled select menu');
                    const disabledSelect = new StringSelectMenuBuilder()
                        .setCustomId('sparxreader_homework')
                        .setPlaceholder('Choose a book')
                        .setDisabled(true);

                    for (const book of homeworkBooks) {
                        const option = new StringSelectMenuOptionBuilder()
                            .setLabel(book.title)
                            .setDescription(`${book.progress}%`)
                            .setValue(book.bookId);
                        if (book.bookId === selectedBook) {
                            option.setDefault(true);
                        }
                        disabledSelect.addOptions(option);
                    }

                    console.log('Updating UI with disabled components');
                    UserSession.selectRow = disabledSelect;
                    await UserSession.updateEmbed(true);
                    console.log('UI updated successfully');

                    console.log('Starting sparxReaderAutocomplete'); // Sparx Reader Autocompleter

                    if (await useUpSlot(interaction, 'reader', getSparxAccountId(UserSession.userInfo), 'sparx')) return;
                    // start of the fucking cookie login crap
                    if (Object.keys(sparxReader.login).length === 0) {
                        await cookieMenuCall(interaction, sparxReader);
                    }

                    await queue.addQueue({
                        action: async () => {
                            return await sparxReaderAutocomplete(
                                componentInteraction,
                                sparxReader,
                                selectedBook,
                                UserSession.points,
                                UserSession.wpm,
                                bookNames[selectedBook],
                                UserSession.mode
                            );
                        },
                        id: interaction.user.id,
                        interaction: interaction
                    });

                    await interaction.followUp({ flags: 64, content: "You have been added to the queue" });
                } catch (error) {
                    console.error('Error in start_reader handler:', error);
                }
            } else if (componentInteraction.customId === 'mode') {
                const modal = new ModalBuilder()
                    .setCustomId(`sparxreader_mode`)
                    .setTitle(`Mode`);
                const typeInput = new StringSelectMenuBuilder()
                    .setCustomId('type')
                    .setPlaceholder("Choose a Mode")
                    .addOptions(
                        { label: "Read Until Points Target Achieved", value: "Read Until Points Target Achieved" },
                        { label: "Read Until Book Completed", value: "Read Until Book Completed" }
                    );
                const typeLabel = new LabelBuilder({
                    label: 'Mode Type',
                    component: typeInput
                });

                modal.addLabelComponents(typeLabel);
                await componentInteraction.showModal(modal);
            }
            else if (componentInteraction.customId === 'save_account') {
                const modal = new ModalBuilder()
                    .setCustomId(`save_account`)
                    .setTitle(`Save Account`);
                const input = new TextInputBuilder()
                    .setCustomId('master_password')
                    .setLabel('Master Password')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await componentInteraction.showModal(modal);
            } else if (componentInteraction.customId === 'tag_changer') {
                await positiveNounChanger(componentInteraction, userInfo.givenName, userDisplayName, UserSession);
            } else if (componentInteraction.customId === 'settings') {
				console.log('reader settings');
				await componentInteraction.deferReply({ flags: 64});
				const account = await checkAccount(componentInteraction.user.id);
				await handleSetting(componentInteraction, account);
			}
        }
    });

    collector.on('end', async () => {
        const selectedBook = UserSession.selectedBook;

        const disabledSelect = new StringSelectMenuBuilder()
            .setCustomId('sparxreader_homework')
            .setPlaceholder('Choose a book')
            .setDisabled(true);

        for (const book of homeworkBooks) {
            const option = new StringSelectMenuOptionBuilder()
                .setLabel(book.title)
                .setDescription(`${book.progress}%`)
                .setValue(book.bookId);
            if (book.bookId === selectedBook) {
                option.setDefault(true);
            }
            disabledSelect.addOptions(option);
        }

        UserSession.selectRow = disabledSelect;

        await UserSession.updateEmbed(true);
    });
}

module.exports = readerExecutor;