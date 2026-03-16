const { REST, Routes } = require('discord.js');
require('dotenv').config();
const clientId = process.env.CLIENT_ID;
const token = process.env.DISCORD_TOKEN;
const fs = require('node:fs');
const path = require('node:path');
const { name } = require('./config.json');

const commands = [];
// const commandsAdmin = [];
// Grab all the command folders from the commands directory you created earlier
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	// Grab all the command files from the commands directory you created earlier
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	let commandsCurrentList = commands;
	/*
	if (folder === "admin") {
		commandsCurrentList = commandsAdmin;
	}
	*/

	// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			commandsCurrentList.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
    try {
        console.log(`🗑️ ${name}: Performing aggressive command cleanup...`);
        
        // Clear global commands
        console.log('🌐 Clearing global commands...');
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: [] },
        );
        
        // Also try to clear guild commands for common guild IDs (if any)
        // This helps remove any guild-specific commands that might be lingering
        try {
            console.log('🏠 Attempting to clear potential guild commands...');
            // Get all guilds the bot is in
            const guilds = await rest.get(Routes.userGuilds());
            
            for (const guild of guilds) {
                try {
                    await rest.put(
                        Routes.applicationGuildCommands(clientId, guild.id),
                        { body: [] },
                    );
                    console.log(`   ✅ Cleared commands for guild: ${guild.name}`);
                } catch (guildError) {
                    // Ignore guild-specific errors (might not have permissions)
                    console.log(`   ⚠️ Could not clear guild ${guild.name}: ${guildError.message}`);
                }
            }
        } catch {
            console.log('⚠️ Could not fetch guild list, skipping guild command cleanup');
        }
        
        console.log(`✅ ${name}: Command cleanup completed!`);
        
        // Wait longer for Discord to process all deletions
        console.log('⏳ Waiting for Discord to process deletions...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log(`🔄 ${name}: Deploying fresh global command set...`);

        // Deploy the fresh command set globally
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`✅ ${name}: Successfully deployed fresh command set!`);
        console.log(`📋 Commands deployed: ${commands.length}`);
        commands.forEach(cmd => {
            console.log(`   - /${cmd.name}: ${cmd.description}`);
        });
        
        console.log('\n🎉 Command reset complete! Please wait 1-2 minutes for Discord to fully update.');
        console.log('💡 If old commands still appear, try restarting your Discord client.');
        
    } catch (error) {
        console.error('❌ Error during command deployment:', error);
    }
})();