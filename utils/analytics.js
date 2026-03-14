const { EmbedBuilder } = require('discord.js');

async function updateAnalyticsEmbed(client) {
	try {
		const analyticsChannel = client.channels.cache.get(process.env.ANALYTICS_CHANNEL_ID);
		if (!analyticsChannel) return;

		const guild = client.guilds.cache.first();
		if (!guild) return;

		const totalMembers = guild.memberCount;
		const unverifiedMembers = guild.members.cache.filter(member => 
			member.roles.cache.has('1405907792627236875') // Unverified role ID
		).size;

		await guild.members.fetch();
		
		const lifetimeLicenses = guild.members.cache.filter(member => 
			member.roles.cache.has('1353035961830867034') // Lifetime role ID
		).size;
		const monthlyLicenses = guild.members.cache.filter(member => 
			member.roles.cache.has('1353036406678622218') // Monthly role ID
		).size;
		const freeTrialLicenses = guild.members.cache.filter(member => 
			member.roles.cache.has('1411000950222618726') // Free trial role ID
		).size;

		const analyticsEmbed = new EmbedBuilder()
			.setTitle('📊 Server Analytics')
			.setDescription(`**Members:**\n👥 Total: ${totalMembers}\n❌ Unverified: ${unverifiedMembers}\n\n**Active Licenses:**\n💎 Lifetime: ${lifetimeLicenses}\n📅 Monthly: ${monthlyLicenses}\n🆓 Free Trial: ${freeTrialLicenses}`)
			.setColor('#808080')
			.setTimestamp()
			.setFooter({ text: 'Last updated' });

		const messages = await analyticsChannel.messages.fetch({ limit: 10 }).catch(() => new Map());
		const existingAnalyticsEmbed = messages.find(msg => 
			msg.author.id === client.user.id && 
			msg.embeds.length > 0 && 
			msg.embeds[0].title === '📊 Server Analytics'
		);

		if (existingAnalyticsEmbed) {
			await existingAnalyticsEmbed.edit({ embeds: [analyticsEmbed] });
		} else {
			await analyticsChannel.send({ embeds: [analyticsEmbed] });
		}
	} catch (error) {
		console.error('Error updating analytics embed:', error);
	}
}

module.exports = { updateAnalyticsEmbed };