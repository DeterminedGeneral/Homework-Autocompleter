const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resource_stats')
        .setDescription('Shows PC specs and the bot\'s specific memory and CPU usage.'),
    async execute(interaction, client) {
        // Defer the reply because we need to wait a tiny bit (100ms) to calculate CPU usage accurately
        await interaction.deferReply();

        // ---------------------------------------------------------
        // 1. CALCULATE CPU USAGE (Bot Process Only)
        // ---------------------------------------------------------
        const startUsage = process.cpuUsage();
        const hrStart = process.hrtime();
        
        // Wait 100ms to measure how much CPU time the bot uses in that timeframe
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const hrEnd = process.hrtime(hrStart);
        const endUsage = process.cpuUsage(startUsage);
        
        // Convert time to microseconds
        const elapsedMicros = (hrEnd[0] * 1e6) + (hrEnd[1] / 1e3);
        const totalCpuMicros = endUsage.user + endUsage.system;
        
        // Calculate percentage (Time spent working / Total time elapsed)
        const processCpuUsage = ((totalCpuMicros / elapsedMicros) * 100).toFixed(2);

        // ---------------------------------------------------------
        // 2. CALCULATE MEMORY USAGE (Bot Process Only)
        // ---------------------------------------------------------
        const memoryUsage = process.memoryUsage();
        // RSS (Resident Set Size) is the total RAM allocated to the bot process
        const rssMb = (memoryUsage.rss / 1024 / 1024).toFixed(2); 
        // Heap Used is the actual memory being actively used by the V8 JavaScript engine
        const heapUsedMb = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2); 

        // ---------------------------------------------------------
        // 3. GET PC SPECS (Host Machine)
        // ---------------------------------------------------------
        const cpuModel = os.cpus()[0].model;
        const coreCount = os.cpus().length;
        const totalMemGb = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const osType = `${os.type()} ${os.release()}`;

        // ---------------------------------------------------------
        // 4. BUILD AND SEND EMBED
        // ---------------------------------------------------------
        const embed = new EmbedBuilder()
            .setTitle('🤖 Bot & System Statistics')
            .setColor('Blurple')
            .addFields(
                { 
                    name: '🖥️ Host PC Specs', 
                    value: `**OS:** ${osType}\n**CPU:** ${cpuModel} (${coreCount} Cores)\n**Total RAM:** ${totalMemGb} GB`, 
                    inline: false 
                },
                { 
                    name: '🧠 Bot Memory Usage', 
                    value: `**Total Allocated (RSS):** ${rssMb} MB\n**Actively Used (Heap):** ${heapUsedMb} MB`, 
                    inline: true 
                },
                { 
                    name: '⚙️ Bot CPU Usage', 
                    value: `**Usage:** ${processCpuUsage}%`, 
                    inline: true 
                }
            )
            .setFooter({ text: `Websocket Ping: ${client.ws.ping}ms` })
            .setTimestamp();

        // Edit the deferred reply to show the embed
        await interaction.editReply({ embeds: [embed] });
    },
};