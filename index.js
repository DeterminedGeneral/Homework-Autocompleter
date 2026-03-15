require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const ADMIN_ROLE = process.env.ADMIN_ROLE;
const fs = require('node:fs');
const fspromise = require('fs').promises;
const path = require('node:path');
const { Client, GatewayIntentBits, EmbedBuilder, Collection, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { logError } = require('./utils/errorLogger.js');
const { executeViewAccounts, saveAccount } = require('./handlers/savedAccountsHandler.js');
const { handleFAQ } = require('./utils/faq.js');
const { educake_collector, educake_model_executor } = require('./educake/main.js');
const { seneca_collector, seneca_model_executor } = require('./seneca/main.js');
const { drfrost_collector, drfrost_model_executor } = require('./drfrost/main.js');
const { createAccount } = require('./handlers/accountHandler.js');
const { mainAccountLogin } = require('./handlers/mainAccountLogin.js');
const { viewSavedAccounts, changeMasterPassword, updateAccountInteraction, changeSlots, disableMasterPassword, enableMasterPassword, verifyPasswordForChange, enableMasterPasswordDirect } = require('./handlers/accountManager.js');
const { updateAnalyticsEmbed } = require('./utils/analytics.js');
const { handleSettings } = require('./settings/router.js');
const { handleApiKeyRequest } = require('./handlers/apikeyHandler.js');
const config = require('./config.json');
const imageSolverHandler = require('./imageSolver.js');
const util = require('util');

// Ensure the file exists
if (!fs.existsSync('logs.txt')) {
    fs.writeFileSync('logs.txt', ''); // create an empty file
}
// Create a write stream to the file, 'w' = overwrite on startup
const logFile = fs.createWriteStream('logs.txt', { flags: 'w' });

const originalLog = console.log;

console.log = function (...args) {
    // Write to file
    logFile.write(util.format(...args) + '\n');

    // Also output to the console
    originalLog.apply(console, args);
};

async function cleanLogs(dir = 'logs') {
    const entries = await fspromise.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            await cleanLogs(fullPath);
        } else if (entry.isFile() && entry.name !== ".gitkeep") {
            await fspromise.unlink(fullPath);
        }
    }
}

cleanLogs();

const { executeTasks } = require('./executeTasks.js');
const { languagenut_model_executor, languagenut_collector } = require('./languagenut/main.js');
const { cookieUpdate } = require('./cookies_menu.js');

process.on('uncaughtException', async (err) => {
    console.error('Uncaught Exception:', err);
    try {
        await logError(err, null, 'Global Uncaught Exception');
    } catch (e) {
        console.error('Failed to log error to DB:', e);
    }
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    try {
        await logError(reason, null, 'Global Unhandled Rejection');
    } catch (e) {
        console.error('Failed to log error to DB:', e);
    }
});

const { sparxReaderCollector } = require('./collectors/sparxCollectors.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ],
});

client.on('error', (error) => {
    console.error('Discord Client Error:', error);
});

client.on('warn', (info) => {
    console.warn('Discord Client Warning:', info);
});

client.on('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    updateAnalyticsEmbed(client);
    setInterval(() => {
        updateAnalyticsEmbed(client);
    }, 300000); // 5 minutes
});

client.commands = new Collection();


const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    if (folder === '.DS_Store') continue;
    const commandsPath = path.join(foldersPath, folder);
    const stats = fs.statSync(commandsPath);
    if (!stats.isDirectory()) continue;
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        // Set a new item in the Collection with the key as the command name and the value as the exported module
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

async function sendPersistentEmbeds(client) {
    await updateAnalyticsEmbed(client);

    // Absolute path to the embeds folder
    const embedsPath = path.join(__dirname, 'startEmbeds', 'embeds');

    // Read all files in the folder
    const embedFiles = fs.readdirSync(embedsPath).filter(file => file.endsWith('.js'));

    // Collection to store them (optional but recommended)
    const embeds = new Map();

    // Loop through each file
    for (const file of embedFiles) {
        const filePath = path.join(embedsPath, file);
        const embed = require(filePath);

        // Store using filename (without .js) as key
        const name = file.replace('.js', '');
        embeds.set(name, embed);
    }

    console.log(`Loaded ${embeds.size} embed(s).`);

    embeds.forEach(async (container, name) => {
        const channelID = config.channels[name];
        if (!channelID) {
            console.log(`Channel for ${name} is not configured`);
            return;
        }

        const channel = await client.channels.fetch(channelID);
        if (!channel) {
            console.log(`${name} channel not found`);
            return;
        }

        // Fetch recent messages to check for existing embeds
        const messages = await channel.messages.fetch({ limit: 50 });

        const existingMessage = messages.find(msg =>
            msg.author.id === client.user.id &&
            msg.components?.[0]?.components?.[0]?.components?.[0]?.data?.content === container.components[0].components[0].data.content
        );
        let embedMessage = existingMessage;

        if (!existingMessage) {
            console.log(`Sending persistent embed for ${name}`);
            embedMessage = await channel.send({
                flags: 32768,
                components: [container]
            });
        }

        const collectorsMap = new Map([
            ["languagenut_persistent", languagenut_collector],
            ["sparx_maths_persistent", sparxReaderCollector],
            ["sparx_reader_persistent", sparxReaderCollector],
            ["sparx_science_persistent", sparxReaderCollector],
            ["educake_persistent", educake_collector],
            ["seneca_persistent", seneca_collector],
            ["drfrost_persistent", drfrost_collector]
        ]);

        await (collectorsMap.get(name + '_persistent'))(embedMessage);
    });
}

async function DeleteVideos() {
    try {
        const files = await fspromise.readdir('videos');
        if (files.length > 1) {
            console.log("Deleting files...");
            for (const file of files) {
                if (file == '.gitkeep') continue;
                const filePath = path.join('videos', file);
                await fspromise.unlink(filePath);
                console.log(`Deleted ${file}`);
            }
            console.log("All files deleted.");
        } else {
            console.log("No files to delete.");
        }
    } catch (err) {
        console.error("Error deleting files:", err);
    }
}

client.once("clientReady", async () => {
    console.log("Bot has connected to discord");
    await sendPersistentEmbeds(client);
    await DeleteVideos();
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    // Prevent crash in DMs
    if (!interaction.guild) {
        return interaction.reply({
            content: 'This command can only be used in a server.',
            flags: 64
        });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.has(ADMIN_ROLE) && !command.public) {
        return interaction.reply({
            content: 'Only admins can run commands',
            flags: 64
        });
    }

    if (!command) {
        await interaction.reply(`No command matching ${interaction.commandName} was found.`);
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    await command.execute(interaction, client);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    try {

        if (interaction.customId.startsWith('set_slots')) {
            await interaction.deferUpdate({ flags: 64 });
            await changeSlots(interaction);
            return;
        }

        if (interaction.customId === 'change_apikey') {
            await interaction.deferUpdate({ flags: 64 });
            await handleApiKeyRequest(interaction);
            return;
        }

        if (interaction.customId === 'handleSettings') {
            await interaction.deferReply({ flags: 64 });
            await handleSettings(interaction);
            return;
        }

        if (interaction.customId === 'accountManager_service') {
            await interaction.deferUpdate({ flags: 64 });
            await updateAccountInteraction(interaction);
            return;
        }

        if (interaction.customId === 'view_accounts') {
            await viewSavedAccounts(interaction);
            return;
        }

        if (interaction.customId === 'change_master_password') {
            await changeMasterPassword(interaction);
            return;
        }

        if (interaction.customId.startsWith('main_account')) {
            if (interaction.customId.endsWith('configure')) {
                await mainAccountLogin(interaction);
            } else if (interaction.customId.endsWith('remove')) {
                await mainAccountLogin(interaction, true);
            }
            return;
        }

        if (interaction.customId === 'create_master_password') {
            await createAccount(interaction);
            return;
        }

        if (interaction.customId === 'confirm_disable_mp') {
            await disableMasterPassword(interaction);
            return;
        }

        if (interaction.customId === 'confirm_enable_mp') {
            await enableMasterPassword(interaction);
            return;
        }

        if (interaction.customId === 'verify_password_for_change') {
            await verifyPasswordForChange(interaction);
            return;
        }

        if (interaction.customId === 'enable_master_password_direct') {
            await enableMasterPasswordDirect(interaction);
            return;
        }

        if (interaction.customId.startsWith('seneca')) {
            try {
                await seneca_model_executor(interaction);
            } catch (err) {
                if (err.code !== 10062) console.error('Error in seneca_model_executor:', err);
            }
            return;
        }

        if (interaction.customId.startsWith('drfrost')) {
            try {
                await drfrost_model_executor(interaction);
            } catch (err) {
                if (err.code !== 10062) console.error('Error in drfrost_model_executor:', err);
            }
            return;
        }

        if (interaction.customId.startsWith('educake')) {
            try {
                await educake_model_executor(interaction);
            } catch (err) {
                if (err.code !== 10062) console.error('Error in educake_model_executor:', err);
            }
            return;
        }

        if (interaction.customId.startsWith('languagenut_set')) {
            await languagenut_model_executor(interaction);
            return;
        }

        if (interaction.customId.startsWith('save_account')) {
            await interaction.deferReply({ flags: 64 });
            await saveAccount(interaction);
            return;
        }

        if (interaction.customId.startsWith('view_saved_accounts')) {
            try {
                await interaction.deferReply({ flags: 64 });
                await executeViewAccounts(interaction);
                return;
            } catch {
                return;
            }
        }

        if (interaction.customId === 'cookies_maintenance') {
            await cookieUpdate(interaction);
            return;
        }

        // Check if user has required roles
        if (!interaction.guild) {
            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply({
                    content: 'This bot can only be used in a server.',
                    flags: 64
                });
            }
            return;
        }

        if (interaction.customId === 'languagenut_login_modal') {
            try {
                await languagenut_model_executor(interaction);
            } catch (error) {
                console.error('Error in languagenut_model_executor:', error);

                if (!interaction.replied && !interaction.deferred) {
                    try {
                        await interaction.reply({
                            content: 'An error occurred while processing your LanguageNut login. Please try again.',
                            flags: 64
                        });
                    } catch (replyError) {
                        console.error('Failed to send error reply for LanguageNut:', replyError);
                    }
                }
            }
            return;
        }

        if (interaction.customId.startsWith('loginSparx')) {
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.deferReply({ flags: 64 });
                } catch (err) {
                    if (err.code === 10062) return; // Unknown interaction, ignore
                    throw err;
                }
            }

            await executeTasks(interaction);
            // await addPersonToQueue(interaction, 'login');
            return;
        }

        if (interaction.customId.startsWith('sparxreader') || interaction.customId.startsWith('sparxmaths') || interaction.customId.startsWith('sparxscience')) {
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.deferUpdate();
                } catch (err) {
                    if (err.code === 10062) return; // Unknown interaction, ignore
                    throw err;
                }
            }
            await executeTasks(interaction);
            return;
        }
    } catch (error) {
        if (error.code === 40060 || error.code === 10062) {
            console.log(`Interaction timeout or already acknowledged, ignoring: ${error.code}`);
            return;
        }
        console.error('Error handling modal submit interaction:', error);
        await logError(error, interaction.user, 'Modal Submit Handler');

        try {
            const errorMessage = {
                content: 'An error occurred while processing your request. Please try again.',
                flags: 64
            };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage).catch(() => { });
            } else {
                await interaction.reply(errorMessage).catch(() => { });
            }
        } catch (e) {
            // Ignore further errors in the error reporter
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // Handle persistent ticket buttons
    if (['resolved', 'close_ticket'].includes(interaction.customId)) {
        try {
            await interaction.deferReply({ ephemeral: true });
        } catch {
            return;
        }
        const embed = interaction.message.embeds[0];
        if (!embed || !embed.footer || !embed.footer.text) {
            await interaction.editReply('Could not find ticket information in the embed footer.');
            return;
        }

        const footerText = embed.footer.text;
        const userIdMatch = footerText.match(/UserID:(\d+)/);

        if (!userIdMatch) {
            await interaction.editReply('Could not parse user ID from the embed footer.');
            return;
        }

        const userId = userIdMatch[1];

        const ticketChannel = interaction.channel;

        if (interaction.customId === 'close_ticket') {
            await interaction.editReply('Deleting ticket...');
            setTimeout(() => ticketChannel.delete().catch(err => console.error('Failed to delete ticket channel:', err)), 1000);
        } else if (interaction.customId === 'resolved') {
            const resolvedEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('Bug Resolved!')
                .setDescription("Thank you for your bug report! Our team has investigated and we're happy to let you know that the issue has been fixed.\nYou can now try again. If you run into any other problems, please let us know again.")
                .setFooter({ text: "Thanks for making SparxNow better!" });

            try {
                const user = await client.users.fetch(userId);
                await user.send({ embeds: [resolvedEmbed] });
                await interaction.editReply({ content: 'Resolution notice sent to the user.', ephemeral: true });

            } catch (e) {
                console.error("Failed to send resolution message or disable buttons:", e);
                await interaction.editReply({ content: 'Could not send the resolution message to the user or disable buttons. They may have DMs disabled or the message was deleted.', ephemeral: true });
            }
        }

        // Disable the buttons after processing
        const components = interaction.message.components;
        const updatedComponents = components.map(row => {
            if (row.components.some(comp => comp.customId === 'resolved' || comp.customId === 'close_ticket')) {
                const newRow = new ActionRowBuilder();
                row.components.forEach(comp => {
                    const button = ButtonBuilder.from(comp);
                    if (button.customId === 'resolved' || button.customId === 'close_ticket') {
                        button.setDisabled(true);
                    }
                    newRow.addComponents(button);
                });
                return newRow;
            }
            return row;
        });
        await interaction.message.edit({ components: updatedComponents });

        return;
    }
    // Handle other button interactions here if needed

});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (handleFAQ(message)) return;
});

client.on('messageCreate', async (message) => {
    await imageSolverHandler(message);
});

if (require.main === module) {
    client.login(token);
}
