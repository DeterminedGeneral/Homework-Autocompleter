const { StringSelectMenuOptionBuilder, LabelBuilder, SeparatorSpacingSize, SeparatorBuilder, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ModalBuilder, TextInputBuilder, SectionBuilder, TextInputStyle, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { emojis, footerText, footerIcon } = require('../startEmbeds/info.js');
const getProgressBar = require('../utils/getProgressBar');
const formatTime = require('../utils/formatTime');
const { useUpSlot, validAccount } = require('../handlers/accountHandler');
const DrFrost_Requesticator = require('./requesticator.js');
const { drfrostLogin } = require('./puppeteer');
const progressTracker = require('../utils/progressTracker');
const { geminiAnswer } = require('../gemini/drfrost/main');
const { checkAccount, updateDB, updateStats } = require('../database/accounts');
const { addToDb, checkAnswer } = require('../database/drfrost');
const userMenus = {};
const EMBED_COLOR = 0xe5ac3f;
const puppetQueue = require('../queues/puppeteerQueue.js');
const rowsMenu = require('../utils/rowsMenu.js');

const saveAccountBtn = new ButtonBuilder()
    .setCustomId('save_account')
    .setLabel('Save Account')
    .setEmoji(emojis.save_account)
    .setStyle(ButtonStyle.Secondary);

const seperator = new SeparatorBuilder({
    spacing: SeparatorSpacingSize.Small
});

const modeIdentifiers = {
    'Fixed number of questions': 'fixednum',
    'Keep going until I say': 'nostop',
    'Accuracy required to finish': 'accuracy'
};

function smartParse(input) {
    // 1. If it's not a string (or is null), just return it
    if (typeof input !== 'string') return input;

    try {
        const parsed = JSON.parse(input);

        // 2. CHECK: Is the result actually an Object or Array?
        // (Note: typeof null is 'object', so we exclude null)
        if (typeof parsed === 'object' && parsed !== null) {
            return parsed; // Return the Array/Object
        }

        // 3. If we get here, it parsed successfully but was a Number (2) 
        // or a Boolean, etc.
        // You said you want to keep these as strings.
        return input;

    } catch {
        // 4. If parsing fails (e.g. "\frac{1}{2}"), return the original string
        return input;
    }
}

function getDateWithOffset(years) {
    const date = new Date();

    date.setFullYear(date.getFullYear() + years);

    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}


// Helper: recursively checks if a node or its descendants have a value/id
function hasContent(node) {
    // 1. If this node is a leaf (has a value/id), it has content.
    // (Checking .value based on your previous code, and .id just in case)
    if (node.value !== undefined || node.id !== undefined) return true;

    // 2. If it has children, check if ANY child has content
    if (node.children && Array.isArray(node.children)) {
        return node.children.some(child => hasContent(child));
    }

    // 3. Otherwise, it is an empty branch
    return false;
}

function arrayToUnicodeString(nodes, prefix = "") {
    // STEP 1: Filter the nodes immediately. 
    // We only want to process nodes that lead to a valid ID.
    const visibleNodes = nodes.filter(node => hasContent(node));

    return visibleNodes
        .map((node, index) => {
            // 2. Check if this is the last item in the *filtered* list
            // This ensures the tree lines (└─) look correct visually.
            const isLast = index === visibleNodes.length - 1;
            const connector = isLast ? "└─" : "├─";

            let result = `${prefix}${connector} ${node.name}`;

            // 3. Recursively process children
            if (node.children && node.children.length > 0) {
                const childPrefix = prefix + (isLast ? "   " : "│  ");

                // Recursive call (which will also filter the children)
                const childrenString = arrayToUnicodeString(node.children, childPrefix);

                // Only append if the children actually generated text
                if (childrenString.length > 0) {
                    result += "\n" + childrenString;
                }
            }

            return result;
        })
        .join("\n");
}
function getUniqueValues(nodes) {
    // 1. Create a Set to store values automatically without duplicates
    const valuesSet = new Set();

    // 2. Define a recursive function to traverse the tree
    function traverse(items) {
        for (const item of items) {
            // If the item has a 'value', add it to the Set
            if (item.value !== undefined) {
                valuesSet.add(item.value);
            }

            // If the item has children, call traverse again (recursion)
            if (item.children && item.children.length > 0) {
                traverse(item.children);
            }
        }
    }

    // 3. Start the traversal
    traverse(nodes);

    // 4. Convert the Set back to an Array (if you need an array output)
    return Array.from(valuesSet);
}

class drfrostAutocompleter {
    constructor(interaction, authToken, loginDetails, faketime) {
        this.interaction = interaction;
        this.authToken = authToken;
        this.loginDetails = loginDetails;
        this.requesticator = new DrFrost_Requesticator(authToken);
        this.uuid = null;
        this.mode = 'Keep going until I say';
        this.startMessageInteraction = null;
        this.startSettings = {};
        this.faketime = faketime; // {min: 100, max: 140}
        this.lastMainMenuSelect = null;
    }

    createMainMenu() {
        return new TextDisplayBuilder().setContent(`### DrFrost Homework Selection\nSelect one of the homeworks below and it will automatically be completed for you!\n### ⏰ **What is time?**\nTime is the amount of time the bot will wait before completing each question to mimic real user usage. The recommended time is 100-140s.`);
    }

    async sendRequest(url, data) {
        if (data) {
            return await this.requesticator.sendRequest(url, data);
        }
        return await this.requesticator.sendRequest(url);
    }

    async getSelfInfo() {
        return await this.requesticator.sendRequest('https://www.drfrost.org/api/user/current');
    }

    async mainMenu(tasks, disabled = false, defaultID) {
        let select = new StringSelectMenuBuilder()
            .setCustomId('drfrost_homework')
            .setPlaceholder(`Choose a Homework`)
            .setMinValues(0)
            .setDisabled(disabled);

        if (tasks) {
            for (const task of tasks) {
                const value = String(task.aid);
                const option = new StringSelectMenuOptionBuilder()
                    .setLabel(task.label)
                    .setDescription(`${Math.round(Number(task.accuracy))}%`)
                    .setValue(value);

                if (defaultID === value) {
                    option.setDefault(true);
                }

                select.addOptions(option);
            }
            this.lastMainMenuSelect = select;
        } else {
            select = this.lastMainMenuSelect;
        }

        const section = this.createMainMenu();

        const minTime = new TextDisplayBuilder().setContent(`⏰ **Minimum Time**: ${this.faketime.min} Seconds`);
        const maxTime = new TextDisplayBuilder().setContent(`⏰ **Maximum Time**: ${this.faketime.max} Seconds`);

        const loginBtn = new ButtonBuilder()
            .setCustomId("set_time")
            .setLabel('Set Time')
            .setEmoji(emojis.queue)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled);

        const continueBtn = new ButtonBuilder()
            .setCustomId("continue_existing")
            .setLabel('Continue Existing')
            .setEmoji(emojis.arrow_right)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled);

        const practiseBtn = new ButtonBuilder()
            .setCustomId("start_practise")
            .setLabel('Start a Practise')
            .setEmoji(emojis.tick)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled);

        const saveAccountBtnCopy = ButtonBuilder.from(saveAccountBtn);
        saveAccountBtnCopy.setDisabled(disabled);

        const selectRow = new ActionRowBuilder().addComponents(select);

        const row = new ActionRowBuilder();
        if (defaultID) {
            const startBtn = new ButtonBuilder()
                .setCustomId("start_drfrost")
                .setLabel('Start Homework')
                .setEmoji(emojis.tick)
                .setStyle(ButtonStyle.Success)
                .setDisabled(disabled);
            row.addComponents(startBtn);
        }
        row.addComponents(loginBtn, continueBtn, practiseBtn, saveAccountBtnCopy);

        // 3. Assemble everything into the main container
        const container = new ContainerBuilder()
            .setAccentColor(EMBED_COLOR)
            .addTextDisplayComponents(
                section.data,
                minTime.data,
                maxTime.data
            )
            .addSeparatorComponents(
                seperator
            )
            .addActionRowComponents(
                selectRow,
                row
            );

        const message_sent = await this.interaction.editReply({
            flags: 32768 | 64,
            components: [container],
            withResponse: true
        });

        return message_sent;
    }

    async updateStartMessage(disabled = false) {
        const section = new TextDisplayBuilder().setContent(`### Start Courses Settings\nConfigure the settings for the practise!`);

        const mode = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`🎓 **Mode**: ${this.mode}`))
            .setButtonAccessory(new ButtonBuilder().setLabel('Mode').setCustomId('mode').setEmoji(config.emojis.mode).setStyle(ButtonStyle.Primary).setDisabled(disabled));

        const sectionButtons = [mode];

        if (this.mode === 'Accuracy required to finish') {
            const description = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`We'll interleave between the subskills within your selection. You need to achieve the required accuracy at each subskill.\n **${this.startSettings.numcorrect}** out of the last **${this.startSettings.outof}** questions correct on each subskill, **${this.startSettings.interleave ? 'with interleaving' : 'without interleaving'}**`))
                .setButtonAccessory(new ButtonBuilder().setLabel('Settings').setEmoji(emojis.settings).setCustomId('settings').setStyle(ButtonStyle.Primary).setDisabled(disabled));
            sectionButtons.push(description);
        } else if (this.mode === 'Fixed number of questions') {
            let valueShown = 'neither';
            if (this.startSettings.interleave) {
                valueShown = 'interleaving';
            } else if (this.startSettings.differentiate) {
                valueShown = 'differentiation';
            }
            const description = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Either the system differentiates between the subskills in your selection (giving you harder or easier questions based on your changing mastery), or interleaving between all the skills in your selection.\n**${this.startSettings.numquestions}** questions with **${valueShown}**`))
                .setButtonAccessory(new ButtonBuilder().setLabel('Settings').setEmoji(emojis.settings).setCustomId('settings').setStyle(ButtonStyle.Primary).setDisabled(disabled));
            sectionButtons.push(description);
        }

        const practiseBtn = new ButtonBuilder()
            .setCustomId("start")
            .setLabel('Start')
            .setEmoji(emojis.tick)
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled);

        const row = new ActionRowBuilder().addComponents(practiseBtn);

        const container = new ContainerBuilder()
            .setAccentColor(EMBED_COLOR)
            .addTextDisplayComponents(
                section.data
            )
            .addSectionComponents(
                ...sectionButtons
            )
            .addSeparatorComponents(
                seperator
            )
            .addActionRowComponents(
                row
            );

        return await this.startMessageInteraction.editReply({
            flags: 32768 | 64,
            components: [container],
            fetchReply: true
        });
    }

    async updateCourseMessage(componentInteraction, modulesToPractise, select, disabled = false) {
        select.setDisabled(disabled);

        const section = new TextDisplayBuilder().setContent(`### Courses\nSelect all courses you wish to complete and it will automatically be completed for you!\n\n${arrayToUnicodeString(modulesToPractise)}`);
        const selectRow = new ActionRowBuilder().addComponents(select);

        const practiseBtn = new ButtonBuilder()
            .setCustomId("start")
            .setLabel('Start')
            .setEmoji(emojis.tick)
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled);

        const row = new ActionRowBuilder().addComponents(practiseBtn);

        const container = new ContainerBuilder()
            .setAccentColor(EMBED_COLOR)
            .addTextDisplayComponents(
                section.data
            )
            .addSeparatorComponents(
                seperator
            )
            .addActionRowComponents(
                selectRow,
                row
            );

        return await componentInteraction.editReply({
            flags: 32768 | 64,
            components: [container],
            fetchReply: true
        });
    }
    async courseSelectorTree(interactionCourse, tree) {
        // This is the root array that will hold the tree structure
        const modulesToPractise = [];

        // Helper to remove branches that don't lead to a final value (Leaf)
        const pruneEmptyBranches = (nodes) => {
            for (let i = nodes.length - 1; i >= 0; i--) {
                const node = nodes[i];
                if (node.children) {
                    // Recursively prune children
                    pruneEmptyBranches(node.children);
                    // If it's a branch (has children array) but it's empty after recursion, remove it
                    if (node.children.length === 0) {
                        nodes.splice(i, 1);
                    }
                }
                // If it has a 'value' property, it is a leaf node and should be kept.
            }
        };

        function getContainer(title, rowMenuer) {
            const section = new TextDisplayBuilder().setContent(
                `### ${title}\n`
            );

            const selectAllButton = new ButtonBuilder()
                .setCustomId('selectAll')
                .setLabel('Select All')
                .setEmoji(emojis.independent_learning)
                .setStyle(ButtonStyle.Secondary);

            const container = new ContainerBuilder()
                .setAccentColor(EMBED_COLOR)
                .addTextDisplayComponents(section.data)
                .addSeparatorComponents(seperator)
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(rowMenuer.createDropdown()),
                    rowMenuer.createNavigationButtons(),
                );

            if (title.includes('->')) {
                container.addActionRowComponents(new ActionRowBuilder().addComponents(selectAllButton));
            }

            return container;
        }

        // 1. Update arguments to accept the current 'selection' parent node
        const newNode = async (interaction, treeCurrent, currentSelectionNode, breadcrumbs) => {

            const rowMenuer = new rowsMenu(treeCurrent.child);
            const pathTitle = breadcrumbs.join(" -> "); // Construct the title string

            async function updateMessage() {
                await interaction.editReply({
                    flags: 32768 | 64,
                    components: [getContainer(pathTitle, rowMenuer)]
                });
            }

            const container = getContainer(pathTitle, rowMenuer);

            const message = await interaction.editReply({
                flags: 32768 | 64,
                components: [container],
                fetchReply: true
            });

            const collector = message.createMessageComponentCollector({
                time: 300_000
            });

            collector.on('collect', async (componentInteraction) => {
                if (componentInteraction.isStringSelectMenu()) {

                    const moduleSelected = Number(componentInteraction.values[0]);
                    const selectedNode = treeCurrent.child[moduleSelected];

                    // 2. Logic for Branch Nodes (Non-Final)
                    if (!treeCurrent.child[0].final) {
                        await componentInteraction.deferReply({ flags: 64 });

                        // Find if this node already exists in the current parent's children
                        let newChildSelection;

                        if (currentSelectionNode) {
                            newChildSelection = currentSelectionNode.children.find(child => child.name === selectedNode.label);

                            // If it doesn't exist, create it and push it
                            if (!newChildSelection) {
                                newChildSelection = {
                                    name: selectedNode.label,
                                    children: []
                                };
                                currentSelectionNode.children.push(newChildSelection);
                            }
                        }

                        // Populate API data if needed
                        if (selectedNode.id && (!selectedNode.child || selectedNode.child.length === 0)) {

                            const newSubTree = [];
                            const moduleData = await this.sendRequest(`https://www.drfrost.org/api/course/explore/${selectedNode.id}`);

                            for (const [index, skill] of moduleData.skills.entries()) {
                                const skillToAdd = { label: skill.name, value: String(index), type: 'skill', child: [], final: false };
                                let counter = 0;
                                for (const subskill of skill.subskills) {
                                    if (subskill.active) {
                                        skillToAdd.child.push({ label: subskill.name, value: String(counter), id: String(subskill.ssid), type: 'subskill', final: true });
                                        counter++;
                                    }
                                }
                                newSubTree.push(skillToAdd);
                            }
                            selectedNode.child = newSubTree;
                        }

                        await updateMessage();
                        // 4. Pass the (existing or new) selection node down
                        await newNode(componentInteraction, selectedNode, newChildSelection, [...breadcrumbs, selectedNode.label]);

                    } else {
                        // 3. Logic for Leaf Nodes (Final)
                        await componentInteraction.deferUpdate({ flags: 64 });
                        // console.log(selectedNode);

                        if (currentSelectionNode) {
                            // Check if child already exists
                            const existingIndex = currentSelectionNode.children.findIndex(child => child.value === Number(selectedNode.id));

                            if (existingIndex !== -1) {
                                // If exists, remove it (toggle off)
                                currentSelectionNode.children.splice(existingIndex, 1);
                            } else {
                                // If not exists, add it (toggle on)
                                const newChildSelection = {
                                    name: selectedNode.label,
                                    value: Number(selectedNode.id)
                                };
                                currentSelectionNode.children.push(newChildSelection);
                            }
                        }

                        // Clean up any empty branches created by navigation that didn't result in a leaf selection
                        pruneEmptyBranches(modulesToPractise);

                        // console.log(JSON.stringify(modulesToPractise, null, 2));
                        await updateMessage();
                        await this.updateCourseMessage(interactionCourse, modulesToPractise, select);
                    }
                } else if (componentInteraction.isButton()) {
                    if (componentInteraction.customId.startsWith('nav')) {
                        await componentInteraction.deferUpdate({ flags: 64 });
                        rowMenuer.handleButton(componentInteraction);
                        await updateMessage();
                    } else if (componentInteraction.customId === 'selectAll') {
                        await componentInteraction.deferUpdate({ flags: 64 });

                        // --- 1. Identify all available IDs in the current view ---
                        const availableIdsInView = [];
                        for (const item of treeCurrent.child) {
                            // Case A: Item is a Group (has children)
                            if (item.child && Array.isArray(item.child)) {
                                for (const child of item.child) {
                                    if (child.id) availableIdsInView.push(Number(child.id));
                                }
                            }
                            // Case B: Item is a Leaf (is the item itself)
                            else if (item.id) {
                                availableIdsInView.push(Number(item.id));
                            }
                        }

                        // --- 2. Identify what is currently selected ---
                        const getSelectedIdsInNode = (node) => {
                            let ids = [];
                            if (node.children) {
                                for (const sub of node.children) {
                                    if (sub.value) ids.push(Number(sub.value)); // It's a selected leaf
                                    if (sub.children) ids = ids.concat(getSelectedIdsInNode(sub)); // Recursively check groups
                                }
                            }
                            return ids;
                        };

                        const currentSelectedIds = getSelectedIdsInNode(currentSelectionNode);

                        // --- 3. Determine Mode: Select All or Deselect All ---
                        // Deselect if we have items to select AND all of them are already selected
                        const shouldDeselect = availableIdsInView.length > 0 &&
                            availableIdsInView.every(id => currentSelectedIds.includes(id));

                        if (shouldDeselect) {
                            // --- DESELECT LOGIC ---
                            // We filter out the IDs found in the current view from the selection tree

                            if (currentSelectionNode.children) {
                                // We use a recursive filter function to clean up the tree
                                const filterNode = (childNodes) => {
                                    return childNodes.filter(node => {
                                        // If it's a leaf (has value), keep it ONLY if it's NOT in the current view
                                        if (node.value) {
                                            return !availableIdsInView.includes(Number(node.value));
                                        }
                                        // If it's a group (has children), filter its children
                                        if (node.children) {
                                            node.children = filterNode(node.children);
                                            // Keep the group only if it still has children left
                                            return node.children.length > 0;
                                        }
                                        return true;
                                    });
                                };

                                currentSelectionNode.children = filterNode(currentSelectionNode.children);
                            }

                        } else {
                            // --- SELECT ALL LOGIC ---

                            for (const item of treeCurrent.child) {

                                // --- SCENARIO 1: Item is a Category/Group ---
                                if (item.child && Array.isArray(item.child) && item.child.length > 0) {

                                    // Find or create the container for this group
                                    let groupContainer = currentSelectionNode.children.find(c => c.name === item.label && !c.value);
                                    if (!groupContainer) {
                                        groupContainer = {
                                            name: item.label,
                                            children: []
                                        };
                                        currentSelectionNode.children.push(groupContainer);
                                    }

                                    // Add all children of this group
                                    for (const child of item.child) {
                                        const childId = Number(child.id);
                                        const alreadySelected = groupContainer.children.some(c => Number(c.value) === childId);

                                        if (!alreadySelected) {
                                            groupContainer.children.push({
                                                name: child.label,
                                                value: childId
                                            });
                                        }
                                    }
                                }
                                // --- SCENARIO 2: Item is a Leaf (Direct Module) ---
                                else if (item.id) {
                                    const itemId = Number(item.id);

                                    // Check if this leaf is already in the current selection node
                                    const alreadySelected = currentSelectionNode.children.some(c => Number(c.value) === itemId);

                                    if (!alreadySelected) {
                                        currentSelectionNode.children.push({
                                            name: item.label,
                                            value: itemId
                                        });
                                    }
                                }
                            }
                        }

                        // pruneEmptyBranches(modulesToPractise);
                        await updateMessage();
                        await this.updateCourseMessage(interactionCourse, modulesToPractise, select);
                    }
                }
            });

            collector.on('end', async () => {
                const container = getContainer(pathTitle, rowMenuer);
                for (const component of container.components) {
                    if (component.components) {
                        for (const com of component.components) {
                            com.data.disabled = true;
                        }
                    }
                }

                await interaction.editReply({
                    flags: 32768 | 64,
                    components: [container]
                });
            });
        };

        // --- Initial Entry Point Logic ---

        const select = new StringSelectMenuBuilder()
            .setCustomId('course')
            .setPlaceholder(`Select a Course`);

        for (const item of tree) {
            const option = new StringSelectMenuOptionBuilder()
                .setLabel(item.label)
                .setValue(item.value);

            select.addOptions(option);
        }

        const practiseMessage = await this.updateCourseMessage(interactionCourse, modulesToPractise, select);

        const practiseCollector = practiseMessage.createMessageComponentCollector({
            time: 900_000
        });

        practiseCollector.on('collect', async (practiseInteraction) => {
            if (practiseInteraction.isStringSelectMenu()) {
                await practiseInteraction.deferReply({ flags: 64 });

                const moduleSelected = Number(practiseInteraction.values[0]);
                const selectedTreeItem = tree[moduleSelected];

                // 5. Check if root node already exists
                let rootSelection = modulesToPractise.find(item => item.name === selectedTreeItem.label);

                if (!rootSelection) {
                    rootSelection = {
                        name: selectedTreeItem.label,
                        children: []
                    };
                    modulesToPractise.push(rootSelection);
                }

                // 7. Start recursion, passing the (existing or new) root selection object
                await newNode(practiseInteraction, selectedTreeItem, rootSelection, [selectedTreeItem.label]);
            } else if (practiseInteraction.isButton()) {
                // ... (Rest of button logic remains unchanged) ...
                if (practiseInteraction.customId === 'start') {
                    await practiseInteraction.deferReply({ flags: 64 });

                    // Ensure tree is clean before starting
                    pruneEmptyBranches(modulesToPractise);

                    const ssids = getUniqueValues(modulesToPractise);

                    if (!ssids.length) {
                        const section = new TextDisplayBuilder().setContent(`### Nothing Selected\nYou have not selected anything to start.`);

                        const container = new ContainerBuilder()
                            .setAccentColor(0xFF474D)
                            .addTextDisplayComponents(
                                section.data
                            );

                        await practiseInteraction.editReply({
                            flags: 32768 | 64,
                            components: [container]
                        });
                        return;
                    }

                    this.startMessageInteraction = practiseInteraction;
                    const startInteractionMessage = await this.updateStartMessage();
                    // ... (Rest of start collector logic) ...

                    const startCollector = startInteractionMessage.createMessageComponentCollector({
                        time: 300_000
                    });

                    startCollector.on('collect', async (startInteraction) => {
                        if (startInteraction.customId === 'mode') {
                            const modal = new ModalBuilder()
                                .setCustomId(`drfrost_mode`)
                                .setTitle(`Mode Setting`);
                            const typeInput = new StringSelectMenuBuilder()
                                .setCustomId('mode')
                                .setPlaceholder("Choose a Mode")
                                .addOptions(
                                    { label: "Fixed number of questions", value: "Fixed number of questions" },
                                    { label: "Accuracy required to finish", value: "Accuracy required to finish" },
                                    { label: "Keep going until I say", value: "Keep going until I say" }
                                );
                            const typeLabel = new LabelBuilder({
                                label: 'Mode Type',
                                component: typeInput
                            });

                            modal.addLabelComponents(typeLabel);
                            await startInteraction.showModal(modal);
                        } else if (startInteraction.customId === 'start') {
                            await startInteraction.deferUpdate({ flags: 64 });

                            console.log('SSIDS for autocomplete', ssids);

                            const aaid = await this.startTask('1to4', ssids, modeIdentifiers[this.mode]);
                            await this.updateStartMessage(true);
                            await this.autocomplete(aaid);
                        } else if (startInteraction.customId === 'settings') {
                            const modal = new ModalBuilder()
                                .setCustomId(`drfrost_startSettings_${this.mode}`)
                                .setTitle(`Settings`);
                            if (this.mode === 'Fixed number of questions') {

                                const input = new TextInputBuilder()
                                    .setCustomId('questions')
                                    .setLabel('Questions Number')
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(true);
                                const typeInput = new StringSelectMenuBuilder()
                                    .setCustomId('questionsSetting')
                                    .setPlaceholder("questions with")
                                    .addOptions(
                                        { label: "differentiation", value: "differentiation" },
                                        { label: "interleaving", value: "interleaving" },
                                        { label: "neither", value: "neither" }
                                    );

                                const typeLabel = new LabelBuilder({
                                    label: 'questions with',
                                    component: typeInput
                                });

                                modal.addComponents(new ActionRowBuilder().addComponents(input));
                                modal.addLabelComponents(typeLabel);
                            } else if (this.mode === 'Accuracy required to finish') {
                                const input = new TextInputBuilder()
                                    .setCustomId('q1')
                                    .setLabel('X...')
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(true);

                                const input2 = new TextInputBuilder()
                                    .setCustomId('q2')
                                    .setLabel('out of the last X questions correct')
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(true);
                                const typeInput = new StringSelectMenuBuilder()
                                    .setCustomId('mode')
                                    .setPlaceholder("without interleaving/with interleaving")
                                    .addOptions(
                                        { label: "without interleaving", value: "without interleaving" },
                                        { label: "with interleaving", value: "with interleaving" },

                                    );
                                const typeLabel = new LabelBuilder({
                                    label: 'Interleaving',
                                    component: typeInput
                                });

                                modal.addComponents(new ActionRowBuilder().addComponents(input));
                                modal.addComponents(new ActionRowBuilder().addComponents(input2));
                                modal.addLabelComponents(typeLabel);
                            }
                            await startInteraction.showModal(modal);
                        }
                    });

                    startCollector.on('end', async () => {
                        await this.updateStartMessage(true);
                    });
                }
            }
        });


        practiseCollector.on('end', async () => {
            await this.updateCourseMessage(interactionCourse, modulesToPractise, select, true);
        });
    }

    async main() {
        const userInfo = await this.getSelfInfo();
        this.uuid = userInfo.user.uid;

        const homeworks = await this.requesticator.sendRequest('https://www.drfrost.org/api/tasks/list',
            {
                "studentselection": {
                    "uids": [
                        this.uuid
                    ]
                },
                "datefrom": getDateWithOffset(-1),
                "dateto": getDateWithOffset(1),
                "type": [
                    "a",
                    "t",
                    "x",
                    "kt"
                ]
            }
        );

        const message_sent = await this.mainMenu(homeworks.tasks);

        const collector = message_sent.createMessageComponentCollector({
            time: 900_000
        });

        collector.on('collect', async (componentInteraction) => {
            if (componentInteraction.isStringSelectMenu()) {
                await componentInteraction.deferUpdate();
                this.selectedTaskAid = componentInteraction.values[0];
                await this.mainMenu(homeworks.tasks, false, this.selectedTaskAid);
            } else if (componentInteraction.isButton()) {
                console.log(componentInteraction.customId);
                if (componentInteraction.customId === 'start_drfrost') {
                    if (!this.selectedTaskAid) return;
                    await componentInteraction.deferUpdate();
                    const taskAid = this.selectedTaskAid;
                    await this.mainMenu(homeworks.tasks, true, taskAid);

                    const timestampNow = Date.now();
                    console.log(`https://www.drfrost.org/api/tasks/tasks?aid=${taskAid}&_=${timestampNow}`);
                    const taskData = await this.requesticator.sendRequest(`https://www.drfrost.org/api/tasks/tasks?aid=${taskAid}&_=${timestampNow}`);
                    console.log(taskData);
                    const aaid = taskData.attempts[
                        Object.keys(taskData.attempts).at(-1)
                    ].at(-1).aaid;
                    console.log(aaid);
                    await this.autocomplete(aaid);
                } else if (componentInteraction.customId === 'save_account') {
                    const modal = new ModalBuilder()
                        .setCustomId(`save_account_drfrost`)
                        .setTitle(`Save Account`);
                    const input = new TextInputBuilder()
                        .setCustomId('master_password')
                        .setLabel('Master Password')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await componentInteraction.showModal(modal);
                    /*} else if (componentInteraction.customId === 'practise') {
                        const modal = new ModalBuilder()
                            .setCustomId(`drfrost_practise`)
                            .setTitle(`Practise`);
                        const input = new TextInputBuilder()
                            .setCustomId('ssid')
                            .setLabel('ID')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);
                        const typeInput = new StringSelectMenuBuilder()
                            .setCustomId('difficulty')
                            .setPlaceholder("Difficulty")
                            .setRequired(true)
                            .addOptions(
                                { label: "1-3", value: "1to3"},
                                { label: "1-4", value: "1to4"},
                                { label: "1-2", value: "1to2"},
                                { label: "2-3", value: "2to3"},
                                { label: "2-4", value: "2to4"},
                                { label: "3-4", value: "3to4"},
                                { label: "1 only", value: "1"},
                                { label: "2 only", value: "2"},
                                { label: "3 only", value: "3"},
                                { label: "4 only", value: "4"},
                            );

                        const difficultyLabel = new LabelBuilder({
                            label: 'Difficulty',
                            component: typeInput
                        });

                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                        modal.addLabelComponents(difficultyLabel);
                        await componentInteraction.showModal(modal);
                    }*/
                } else if (componentInteraction.customId === 'start_practise') {
                    await componentInteraction.deferReply({ flags: 64 });
                    const courses = await this.sendRequest('https://www.drfrost.org/api/course/course/12784');

                    const select = new StringSelectMenuBuilder()
                        .setCustomId('course')
                        .setPlaceholder(`Select a Course`);

                    const modulesValues = [];

                    for (const module of courses.modules) { // Number
                        const option = new StringSelectMenuOptionBuilder()
                            .setLabel(module.name)
                            .setValue(String(module.o));

                        const unitsValues = [];

                        for (const unit of courses.modules[module.o].units) {
                            unitsValues.push({ label: unit.name, value: String(unit.o), id: String(unit.cuid), type: 'unit', final: false });
                        }

                        modulesValues.push({ label: module.name, value: String(module.o), child: unitsValues, type: 'module', final: false });
                        select.addOptions(option);
                    }

                    await this.courseSelectorTree(componentInteraction, modulesValues);
                } else if (componentInteraction.customId === 'continue_existing') {
                    const modal = new ModalBuilder()
                        .setCustomId(`drfrost_continue`)
                        .setTitle(`Continue`);
                    const input = new TextInputBuilder()
                        .setCustomId('aaid')
                        .setLabel('AAID')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await componentInteraction.showModal(modal);
                } else if (componentInteraction.customId === 'set_time') {
                    const modal = new ModalBuilder()
                        .setCustomId(`drfrost_set_time`)
                        .setTitle(`Set Time`);
                    const input = new TextInputBuilder()
                        .setCustomId('time_min')
                        .setLabel('Time Min')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('0-180')
                        .setRequired(true);
                    const input1 = new TextInputBuilder()
                        .setCustomId('time_max')
                        .setLabel('Time Max')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('0-180')
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(input), new ActionRowBuilder().addComponents(input1));
                    await componentInteraction.showModal(modal);
                }
            }

        });

        collector.on('end', async () => {
            await this.mainMenu(homeworks.tasks, true);
        });
    }

    async startTask(difficulty, ssids, mode = "nostop") {
        const startTaskRequest = {
            "cmode": mode,
            "coids": [-1],
            "difficulty": difficulty,
            "skillselection":
                { "skids": [], "ssids": ssids },
            "type": "c",
            "recipients": { "uids": [this.uuid] },
            ...this.startSettings
        };

        console.log(startTaskRequest);

        const responseData = await this.sendRequest('https://www.drfrost.org/api/tasks/tasks', startTaskRequest);

        console.log(responseData);
        const aaid = responseData.aaids[0];

        return aaid;
    }

    async autocomplete(aaid) {
        if (await useUpSlot(this.interaction, 'drfrost', String(this.uuid))) return;
        let correctCount = 0;
        let attemptedQuestions = 0;
        const taskTimer = process.hrtime();
        let url = 'Processing...';

        let cancelled;
        const cancel = new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setEmoji(emojis.x)
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder()
            .addComponents(cancel);

        const question = await this.sendRequest('https://www.drfrost.org/api/tasks/question/get', { "aaid": aaid });
        const numQuestions = question.task.cdata.numquestions ?? undefined;

        const getTimeField = function () {
            return `> **Accuracy**: ${isNaN(Math.round(correctCount / attemptedQuestions * 100)) ? 100 : Math.round(correctCount / attemptedQuestions * 100)}%\n> **Time Spent**: ${formatTime((process.hrtime(taskTimer))[0])}\n> **Questions Attempted**: ${numQuestions ? `${attemptedQuestions}/${numQuestions}` : attemptedQuestions}\n> **Url**: ${url}`;
        };

        const sectionsProgress = [[{
            name: 'Progress',
            value: getProgressBar(0, 1)
        }]];

        const initialEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('DrFrost Autocompleter')
            .setDescription(`\`Starting Questions...\``)
            .setFooter({ text: footerText, iconURL: footerIcon });

        const progressUpdater = new progressTracker(this.interaction, getTimeField);

        if (await progressUpdater.start(initialEmbed, row, sectionsProgress)) return;

        const collector = progressUpdater.targetMessage.createMessageComponentCollector({
            componentType: ComponentType.Button
        });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();
            if (interaction.customId === 'cancel') {
                cancelled = true;

                await progressUpdater.updateEmbed(`Cancelling...`);
            }
        });

        try {
            url = `https://www.drfrost.org/do-question.php?aaid=${aaid}`;
            while (!cancelled && (!numQuestions || (attemptedQuestions < numQuestions))) {
                await progressUpdater.updateEmbed('Completing Questions...');
                const question = await this.sendRequest('https://www.drfrost.org/api/tasks/question/get', { "aaid": aaid });
                attemptedQuestions = question.attempt.numcompleted[0];
                correctCount = question.attempt.numcorrect[0];
                console.log('progress bar', attemptedQuestions, numQuestions || 1);
                await progressUpdater.updateProgressBar(0, attemptedQuestions, numQuestions || 1);
                if (attemptedQuestions + 1 > numQuestions) {
                    break;
                }
                // console.log(question);
                const qid = question.question.qid;
                const content = question.question.content;
                if (this.faketime.max) {
                    await progressUpdater.wait(this.faketime, `Waiting to complete question ${attemptedQuestions + 1}`, () => !cancelled);
                }
                if (cancelled) break;
                console.log(qid);
                console.log(content);
                console.log('Check answer', content, question.question.params);
                let answer = await checkAnswer(content, question.question.params) ?? 0;
                let inDB;
                if (answer) {
                    answer = smartParse(answer);
                    console.log('DB ANSWER!!!', answer);
                    inDB = true;
                } else {
                    let attempts = 0;
                    const maxWaitMs = 60000;
                    const checkIntervalMs = 3000;

                    while (typeof answer === "number" && !cancelled) {
                        answer = await geminiAnswer.answerQuestion(question.question, '3-pro-preview');
                        if (typeof answer === "number") {
                            attempts++;
                            let elapsed = 0;

                            await progressUpdater.updateEmbed(`The AI model returned an error code (${answer}). Waiting for 60 seconds before retrying (Attempt ${attempts})...`);
                            while (elapsed < maxWaitMs && !cancelled) {
                                const timeLeft = maxWaitMs - elapsed;
                                await new Promise(res => setTimeout(res, Math.min(checkIntervalMs, timeLeft)));
                                elapsed += Math.min(checkIntervalMs, timeLeft);
                            }
                        }
                    }
                }

                if (cancelled) {
                    break;
                }
                // console.log(answer);
                const userAnswer = ['multiplechoice', 'expression', 'table', 'desmos'].includes(question.question.answer.type) ? answer : [answer];
                const answerPayload = {
                    "userAnswer": userAnswer,
                    "qid": qid,
                    "qnum": attemptedQuestions + 1,
                    "aaid": aaid,
                    "params": question.question.params
                };
                console.log('Answer Payload', answerPayload);
                const answerSuccess = await this.sendRequest('https://www.drfrost.org/api/tasks/submitanswer', answerPayload);
                // console.log(JSON.stringify(answerSuccess, null, 2));
                console.log(attemptedQuestions + 1, answerSuccess.iscorrect);
                if (answerSuccess.iscorrect) {
                    if (!inDB) {
                        await addToDb(content, question.question.params, answer);
                    }
                } else {
                    // no idea if this will work as intended.
                    if (inDB) {
                        console.log('DB WAS WRONG!!!', answer);
                        // await deleteAnswer(content);
                    }
                }
            }
        } catch (err) {
            console.log('DrFrost Autocompleter error', err);
        } finally {
            await progressUpdater.updateEmbed(`Finished`);
            await progressUpdater.end();
            await updateStats(this.interaction.user.id, 'drfrost', (process.hrtime(taskTimer))[0]);
        }
    }

}

async function drfrost_model_executor(interaction) {
    if (interaction.customId.startsWith('drfrost_login')) {
        let username;
        let password;
        let loginType;

        if (interaction.customId === 'drfrost_login_modal') {
            await interaction.deferReply({ flags: 64 });
            username = interaction.fields.getTextInputValue('drfrost_username');
            password = interaction.fields.getTextInputValue('drfrost_password');
            loginType = interaction.fields.getField('type').values[0];
        } else if (interaction.customId === 'drfrost_login_account') {
            username = interaction.loginDetails.email;
            password = interaction.loginDetails.password;
            loginType = interaction.loginDetails.loginType;
        }

        const Loadingsection = new TextDisplayBuilder().setContent(`### Logging In... :hourglass:\nAttempting to log in to your account...`);

        const Loadingcontainer = new ContainerBuilder()
            .setAccentColor(EMBED_COLOR)
            .addTextDisplayComponents(
                Loadingsection.data
            );

        await interaction.editReply({
            components: [Loadingcontainer],
            flags: 32768 | 64
        });


        const cookie = await puppetQueue.add(() =>
            drfrostLogin(username, password, loginType)
        );
        if (!cookie || cookie.length < 50) {
            const section = new TextDisplayBuilder().setContent(`### ❌ Login Failed\nUnable to Login. Please check your login details and try again.`);

            const container = new ContainerBuilder()
                .setAccentColor(0xFF474D)
                .addTextDisplayComponents(
                    section.data
                );

            await interaction.editReply({
                flags: 32768 | 64,
                components: [container]
            });
            return;
        }

        const loginSuccessSection = new TextDisplayBuilder().setContent(`### ✅ Login Successful\nSuccessfully logged into your Drfrost account. Loading...`);

        const loginSuccessContainer = new ContainerBuilder()
            .setAccentColor(0x90EE90)
            .addTextDisplayComponents(
                loginSuccessSection.data
            );

        await interaction.editReply({
            flags: 32768 | 64,
            components: [loginSuccessContainer],
            fetchReply: true
        });


        const drfrostMainmenuer = new drfrostAutocompleter(interaction, cookie, { email: username, password, loginType, app: 'drfrost' }, (await checkAccount(interaction.user.id)).drfrost_settings);
        userMenus[interaction.user.id] = drfrostMainmenuer;
        await drfrostMainmenuer.main();
        /*
        } else if (interaction.customId.startsWith('drfrost_practise')) {
            await interaction.deferUpdate({ flags: 64 });
            const ssid = interaction.fields.getTextInputValue('ssid');
            const difficulty = interaction.fields.getField('difficulty').values[0];
            const userMenu = userMenus[interaction.user.id];
            const aaid = await userMenu.startTask(difficulty, [Number(ssid)]);
            await userMenu.autocomplete(aaid);
        */
    } else if (interaction.customId.startsWith('drfrost_continue')) {
        await interaction.deferUpdate({ flags: 64 });
        const aaid = Number(interaction.fields.getTextInputValue('aaid'));
        const userMenu = userMenus[interaction.user.id];
        console.log(aaid);
        await userMenu.autocomplete(aaid);
    } else if (interaction.customId.startsWith('drfrost_mode')) {
        await interaction.deferUpdate({ flags: 64 });
        const mode = interaction.fields.getField('mode').values[0];
        const userMenu = userMenus[interaction.user.id];
        userMenu.mode = mode;
        // Default settings for modes
        if (mode === 'Fixed number of questions') {
            userMenu.startSettings = {
                differentiate: true,
                interleave: false,
                numquestions: 10
            };
        } else if (mode === 'Accuracy required to finish') {
            userMenu.startSettings = {
                numcorrect: 4,
                interleave: false,
                outof: 5
            };
        } else {
            userMenu.startSettings = {};
        }
        await userMenu.updateStartMessage();
    } else if (interaction.customId.startsWith('drfrost_startSettings')) {
        console.log('Drfrost start settings activated');
        await interaction.deferUpdate({ flags: 64 });
        const userMenu = userMenus[interaction.user.id];
        if (interaction.customId.endsWith('Fixed number of questions')) {
            const questionNumbers = Number(interaction.fields.getTextInputValue('questions'));
            const questionsSetting = interaction.fields.getField('questionsSetting').values[0];
            console.log(questionsSetting);
            userMenu.startSettings = {
                differentiate: questionsSetting === 'differentiation',
                interleave: questionsSetting === 'interleaving',
                numquestions: questionNumbers
            };
        } else if (interaction.customId.endsWith('Accuracy required to finish')) {
            const q1 = Number(interaction.fields.getTextInputValue('q1'));
            const q2 = Number(interaction.fields.getTextInputValue('q2'));
            const interleaving = interaction.fields.getField('mode').values[0];
            console.log(interleaving);
            userMenu.startSettings = {
                numcorrect: q1,
                interleave: interleaving === 'with interleaving',
                outof: q2
            };
        }
        console.log(userMenu.startSettings);
        await userMenu.updateStartMessage();
    } else if (interaction.customId === 'drfrost_set_time') {
        await interaction.deferUpdate();
        const minTime = Number(interaction.fields.getTextInputValue('time_min'));
        const maxTime = Number(interaction.fields.getTextInputValue('time_max'));
        if (isNaN(minTime) || minTime < 0 || maxTime < 0 || isNaN(maxTime) || minTime > maxTime || maxTime > 180) {
            return;
        }
        const userSession = userMenus[interaction.user.id];
        await updateDB(interaction.user.id, { drfrost_settings: { min: minTime, max: maxTime } });
        userSession.faketime = { min: minTime, max: maxTime };
        await userSession.mainMenu();
    }
}


async function drfrost_collector(message_sent) {

    const collector = message_sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
    });

    collector.on('collect', async (interaction) => {
        // Check if user has required roles (using the same roles as defined in main index.js)

        if (await validAccount(interaction, 'drfrost')) return;

        const loginBtn = new ButtonBuilder()
            .setCustomId("drfrost_login")
            .setLabel('Login')
            .setEmoji(emojis.login)
            .setStyle(ButtonStyle.Success);

        const savedBtn = new ButtonBuilder()
            .setCustomId("drfrost_savedAccounts_view")
            .setLabel('Saved Accounts')
            .setEmoji(emojis.accounts)
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(loginBtn, savedBtn);

        const seperator = new SeparatorBuilder({
            spacing: SeparatorSpacingSize.Small
        });

        const section = new TextDisplayBuilder().setContent(`### DrFrost Login\nLogin by simply inputting your username and password or choosing a saved account!`);

        // 3. Assemble everything into the main container
        const container = new ContainerBuilder()
            .setAccentColor(EMBED_COLOR)
            .addTextDisplayComponents(
                section.data
            )
            .addSeparatorComponents(
                seperator
            )
            .addActionRowComponents(
                row
            );

        try {
            const message_sent = await interaction.reply({
                flags: 32768 | 64,
                components: [container],
                fetchReply: true
            });

            const collector = message_sent.createMessageComponentCollector({
                componentType: ComponentType.Button
            });

            collector.on('collect', async (componentInteraction) => {
                try {
                    if (componentInteraction.customId === 'drfrost_login') {

                        const modal = new ModalBuilder()
                            .setCustomId('drfrost_login_modal')
                            .setTitle('Drfrost Login');

                        // Add input components to the modal
                        const usernameInput = new TextInputBuilder()
                            .setCustomId('drfrost_username')
                            .setLabel('Email')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                        const passwordInput = new TextInputBuilder()
                            .setCustomId('drfrost_password')
                            .setLabel('Password')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                        const typeInput = new StringSelectMenuBuilder()
                            .setCustomId('type')
                            .setPlaceholder("Normal/Microsoft/Google")
                            .addOptions(
                                { label: "Normal", value: "Normal" },
                                { label: "Microsoft", value: "Microsoft" },
                                { label: "Google", value: "Google" }
                            );

                        // Create action rows to hold the inputs
                        const usernameRow = new ActionRowBuilder().addComponents(usernameInput);
                        const passwordRow = new ActionRowBuilder().addComponents(passwordInput);
                        const typeLabel = new LabelBuilder({
                            label: 'Login Type',
                            component: typeInput
                        });

                        // Add the action rows to the modal
                        modal.addComponents(usernameRow, passwordRow);
                        modal.addLabelComponents(typeLabel);

                        await componentInteraction.showModal(modal);
                    } else if (componentInteraction.customId === 'drfrost_savedAccounts_view') {
                        const { handleSavedAccounts } = require('../handlers/savedAccountsHandler');
                        await handleSavedAccounts(componentInteraction, componentInteraction.customId.split('_')[2], 'drfrost');
                    }
                } catch (error) {
                    if (error.code === 40060 || error.code === 10062) return;
                    console.error('Error in Drfrost inner collector:', error);
                }
            });
        } catch (error) {
            if (error.code === 40060 || error.code === 10062) return;
            console.error('Error in Drfrost collector:', error);
        }

    });
}

module.exports = { drfrostAutocompleter, drfrost_collector, drfrost_model_executor, userMenus };