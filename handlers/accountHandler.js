const { ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { checkAccount, addToDb, updateDB } = require('../database/accounts');
const whatRole = require('../utils/whatRole');
const config = require('../config.json');
const queueRanksPositions = config.queue_ranks;
const emojis = config.emojis; const hash = require('../utils/hash');
const hashCompare = require('../utils/hashCompare');
const { name } = require('../config.json');

async function useUpSlot(interaction, platform, accountId, alias) {
    if (!alias) alias = platform;
    const account = await checkAccount(interaction.user.id);
    if (config.require_mainaccounts && await hashCompare(accountId, account.main_accounts[alias])) {
        console.log('Main account detected, not using an account slot');
        if (!account.used_main_account) {
            console.log('Add total use for main account');
            account.used_main_account = true;
            account.total_uses += 1;
            await updateDB(interaction.user.id, account);
        }
    } else {
        console.log('Not a main account, checking if account alrady used');
        const platformUsesAccounts = account.uses[platform] ?? [];
        let accountAlreadyUsed = false;
        for (const accountUsed of platformUsesAccounts) {
            if (await hashCompare(accountId, accountUsed)) {
                accountAlreadyUsed = true;
                break;
            }
        }
        console.log(accountAlreadyUsed);
        if (!accountAlreadyUsed) {
            console.log('The account has not been used so we need to check if has slots');
            if (platformUsesAccounts.length >= account.slots) {
                const section = new TextDisplayBuilder().setContent(`# No Account Slots Left\nYou have run out of account slots. Please wait 24 hours for your account slots to replenish.`);

                const container = new ContainerBuilder()
                    .setAccentColor(0xFF474D)
                    .addTextDisplayComponents(
                        section.data
                    );

                await interaction.followUp({
                    flags: 32768 | 64,
                    components: [container]
                });

                return true;
            }

            platformUsesAccounts.push(await hash(accountId));
            account.uses[platform] = platformUsesAccounts;
            account.total_uses += 1;

            await updateDB(interaction.user.id, { uses: account.uses, total_uses: account.total_uses });
        }
    }
}

async function validAccount(interaction, platform) {
    const roleID = whatRole(await interaction.guild.members.fetch(interaction.user.id));
    const userRole = Object.keys(queueRanksPositions).find(key => queueRanksPositions[key] === roleID) ?? null;
    const account = await checkAccount(interaction.user.id, userRole);
    if (!account) {
        const section = new TextDisplayBuilder().setContent(`# No Account Found\nYou do not have a ${name} Account. Please create one by doing \`/account\` and then configuring the main account for this platform.`);

        const container = new ContainerBuilder()
            .setAccentColor(0xFF474D)
            .addTextDisplayComponents(
                section.data
            );

        await interaction.reply({
            flags: 32768 | 64,
            components: [container]
        });

        return true;
    } else if (!account.main_accounts[platform] && config.require_mainaccounts) {
        const section = new TextDisplayBuilder().setContent(`# No Main Account Found for this Platform\nYou do not have a Main Account for this platform configured. Please configure one by doing it in the \`/account\` menu.`);

        const container = new ContainerBuilder()
            .setAccentColor(0xFF474D)
            .addTextDisplayComponents(
                section.data
            );

        await interaction.reply({
            flags: 32768 | 64,
            components: [container]
        });

        return true;
    } else if (!userRole) {
        const section = new TextDisplayBuilder().setContent(`# You do not have Access\nYou do not have access to the bot. Please open a ticket to buy Lifetime for £6 or activate your 3-day free trial if you haven't already.`);

        const container = new ContainerBuilder()
            .setAccentColor(0xFF474D)
            .addTextDisplayComponents(
                section.data
            );

        await interaction.reply({
            flags: 32768 | 64,
            components: [container]
        });

        return true;
    }
}

async function createAccount(interaction) {
    const master_password = interaction.fields.getTextInputValue('master_password');

    const userId = interaction.user.id;
    const roleID = whatRole(await interaction.guild.members.fetch(userId));
    const userRole = Object.keys(queueRanksPositions).find(key => queueRanksPositions[key] === roleID);

    const accountCreated = await addToDb(userId, await hash(master_password), userRole);

    if (!accountCreated) {
        const section = new TextDisplayBuilder().setContent(`# Account already Exists\nYou already have a ${name} account.`);

        const container = new ContainerBuilder()
            .setAccentColor(0xFF474D)
            .addTextDisplayComponents(
                section.data
            );

        await interaction.followUp({
            flags: 32768 | 64,
            components: [container]
        });
        return;
    }

    const section = new TextDisplayBuilder().setContent(`# Account Created\nYour ${name} account has been successfully created!`);

    const container = new ContainerBuilder()
        .setAccentColor(0x90EE90)
        .addTextDisplayComponents(
            section.data
        );

    await interaction.followUp({
        flags: 32768 | 64,
        components: [container]
    });
}

module.exports = { createAccount, validAccount, useUpSlot };