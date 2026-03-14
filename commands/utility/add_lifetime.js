const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config.json');

const queueRanksPositions = config.queue_ranks;
const emojis = config.emojis;const { checkAccount, updateDB } = require('../../database/accounts');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add_lifetime')
        .setDescription('Add a lifetime role to someone')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to give the lifetime role to')
                .setRequired(true)
        ),

    async execute(interaction) {
        const lifetimeRoleId = queueRanksPositions.lifetime;
        const user = interaction.options.getMember('user');

        // Check bot permissions
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({
                content: "``❌`` I don't have permission to manage roles!",
                ephemeral: true
            });
        }

        // Get the role
        const role = interaction.guild.roles.cache.get(lifetimeRoleId);
        if (!role) {
            return interaction.reply({
                content: "``❌`` The lifetime role ID in the config is invalid.",
                ephemeral: true
            });
        }

        const account = await checkAccount(user.id);
        if (!account) {
            return interaction.reply({
                content: "``❌`` User does not have a SparxNow account.",
                ephemeral: true
            });
        }

        await updateDB(user.id, {slots: 3});

        // Give the role
        try {
            await user.roles.add(role);
            return interaction.reply({
                content: ```✅`` Successfully gave **${role.name}** to ${user}, Enjoy!`
            });
        } catch (err) {
            console.error(err);
            return interaction.reply({
                content: "```❌`` I couldn't assign the role. Make sure my role is above the target role!",
                ephemeral: true
            });
        }
    },
};
