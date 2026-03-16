const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, StringSelectMenuOptionBuilder, StringSelectMenuBuilder } = require('discord.js');
const { checkAccounts, deleteAccounts, addAccount } = require('../database/saved_accounts');
const { checkAccount } = require('../database/accounts');
const hashCompare = require('../utils/hashCompare');
let { loginsSavedTemp } = require('../executeTasks');
const { executeTasks } = require('../executeTasks');
const { languagenut_model_executor } = require('../languagenut/main');
const { educake_model_executor } = require('../educake/main');
const { seneca_model_executor } = require('../seneca/main');
const { drfrost_model_executor } = require('../drfrost/main');
const { name } = require('../config.json');

async function handleSavedAccounts(interaction, action, sparx) {

    if (action === 'view') {
        const account = await checkAccount(interaction.user.id);

        // If saved accounts are disabled, or enabled-without-password (empty string), proceed immediately
        if (!account.master_password) {
            await interaction.deferReply({ flags: 64 });
            return await executeViewAccounts(interaction);
        }

        // master_password is present (hashed) -> require it via modal
        const modal = new ModalBuilder()
            .setCustomId('view_saved_accounts_'+sparx)
            .setTitle('Saved Accounts Login');

        const buttons = [];
        const schoolInput = new TextInputBuilder()
            .setCustomId('master_password')
            .setLabel("Master Password")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        buttons.push(schoolInput);
        for (const button of buttons) {
            modal.addComponents(new ActionRowBuilder().addComponents(button));
        }

        await interaction.showModal(modal);
    }
    else if (action === 'delete') {
        await deleteAccounts(interaction.user.id);
        const section = new TextDisplayBuilder().setContent(`# Accounts Deleted\nAll accounts saved by you have been deleted!`);

        // 3. Assemble everything into the main container
        const container = new ContainerBuilder()
            .setAccentColor(0xFF474D)
            .addTextDisplayComponents(
                section.data
            );

        await interaction.reply({ 
            flags: 32768 | 64,
            components: [container]
        });

    }
}

async function executeViewAccounts(interaction) {
    const master_password = interaction.fields ? interaction.fields.getTextInputValue('master_password') : '';
    const account = await checkAccount(interaction.user.id);
    
    let passwordCorrect = false;
    if (account.master_password === null) {
        // Saved accounts disabled - allow immediately
        passwordCorrect = true;
    } else if (account.master_password === '') {
        // Saved accounts enabled but no password set - allow any input
        passwordCorrect = true;
    } else {
        // Saved accounts enabled with password - check if input matches
        if (await hashCompare(master_password, account.master_password)) passwordCorrect = true;
    }

    const accounts = passwordCorrect ? await checkAccounts(interaction.user.id, master_password) : false;

    if (accounts === false) {
        const section = new TextDisplayBuilder().setContent(`# Password was Incorrect\nThe password to your saved accounts was incorrect!`);

        // 3. Assemble everything into the main container
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
    } else if (accounts === null || !accounts.length) {
        const section = new TextDisplayBuilder().setContent(`# No Accounts Saved\nYou have no accounts saved!`);

        // 3. Assemble everything into the main container
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

    const sparxPlatform = interaction.customId.split('_')[3];
    const sparxList = ['reader', 'maths', 'science'];
    let stringSelectCustomId;

    if (sparxList.includes(sparxPlatform)) {
        stringSelectCustomId = 'loginSparxL_homework_'+sparxPlatform;
    } else if (sparxPlatform === 'languagenut') {
        stringSelectCustomId = 'languagenut_login_account';
    } else if (sparxPlatform === 'educake') {
        stringSelectCustomId = 'educake_login_account';
    } else if (sparxPlatform === 'seneca') {
        stringSelectCustomId = 'seneca_login_account';
    } else if (sparxPlatform === 'drfrost') {
        stringSelectCustomId = 'drfrost_login_account';
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(stringSelectCustomId)
        .setPlaceholder('Choose an account...');

    for (const account of accounts) {
        if (sparxList.includes(sparxPlatform) && account.app === 'sparx' || account.app === 'languagenut' && sparxPlatform === 'languagenut' || account.app === 'educake' && sparxPlatform === 'educake' || account.app === 'seneca' && sparxPlatform === 'seneca' || account.app === 'drfrost' && sparxPlatform === 'drfrost') {
        const option = new StringSelectMenuOptionBuilder()
            .setLabel(account.email)
            .setValue(account.email);
        
        select.addOptions(option);
        }
    }

    if (!select.options.length) {
        const section = new TextDisplayBuilder().setContent(`# No Accounts Saved\nYou have no accounts saved!`);

        // 3. Assemble everything into the main container
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

    const row = new ActionRowBuilder().addComponents(select);

    const section = new TextDisplayBuilder().setContent(`# Accounts\nAll saved accounts for the specific service requested are listed below!`);

    // 3. Assemble everything into the main container
    const container = new ContainerBuilder()
        .setAccentColor(0x7d7d7d)
        .addTextDisplayComponents(
            section.data
        ); // componentInteraction.values[0]

    const message_sent = await interaction.followUp({ 
        flags: 32768 | 64,
        components: [container, row]
    });

    const collector = message_sent.createMessageComponentCollector({
        time: 180_000
    });

    collector.on('collect', async (componentInteraction) => {
        if (!componentInteraction.customId.startsWith('loginSparxL_homework_') && componentInteraction.customId !== 'languagenut_login_account' && componentInteraction.customId !== 'educake_login_account' && componentInteraction.customId !== 'seneca_login_account' && componentInteraction.customId !== 'drfrost_login_account') return;
        await componentInteraction.deferUpdate();
        const account = accounts.find(value => value.email === componentInteraction.values[0]);
        componentInteraction.loginDetails = account;
        console.log(componentInteraction.customId);

        if (componentInteraction.customId.startsWith('loginSparxL_homework_')) {
            await executeTasks(componentInteraction);
        } else if (componentInteraction.customId === 'languagenut_login_account') {
            await languagenut_model_executor(componentInteraction);
        } else if (componentInteraction.customId === 'educake_login_account') {
            await educake_model_executor(componentInteraction);
        } else if (componentInteraction.customId === 'seneca_login_account') {
            await seneca_model_executor(componentInteraction);
        } else if (componentInteraction.customId === 'drfrost_login_account') {
            await drfrost_model_executor(componentInteraction);
        }
	});

}

async function saveAccount(interaction) {
    console.log(interaction.customId);
    const master_password = interaction.fields.getTextInputValue('master_password');
    const account = await checkAccount(interaction.user.id);

    let passwordCorrect = false;
    if (account.master_password === null) {
        if (!master_password) passwordCorrect = true;
    } else {
        if (await hashCompare(master_password, account.master_password)) passwordCorrect = true;
    }

    if (!passwordCorrect) {
        const section = new TextDisplayBuilder().setContent(`# Password was Incorrect\nThe password you entered was incorrect!`);
        const container = new ContainerBuilder().setAccentColor(0xFF474D).addTextDisplayComponents(section.data);
        await interaction.followUp({ flags: 32768 | 64, components: [container] });
        return;
    }

    let accounts = await checkAccounts(interaction.user.id, master_password) ?? [];
    if (accounts === false) {
        // This case should ideally not happen if hash check passed, unless data corruption
        const section = new TextDisplayBuilder().setContent(`# Error Decrypting Accounts\nCould not decrypt accounts despite correct password.`);
        const container = new ContainerBuilder().setAccentColor(0xFF474D).addTextDisplayComponents(section.data);
        await interaction.followUp({ flags: 32768 | 64, components: [container] });
        return;
    }
    let loginsSavedTempAccount = {};
    if (interaction.customId === 'save_account_languagenut') {
        accounts = accounts.filter(value => value.app === 'languagenut');
        const { userSessions } = require('../languagenut/main');
        loginsSavedTempAccount[interaction.user.id] = (userSessions.get(interaction.user.id)).login_details;
    } else if (interaction.customId === 'save_account_educake') {
        accounts = accounts.filter(value => value.app === 'educake');
        const { userSessions } = require('../educake/main');
        loginsSavedTempAccount[interaction.user.id] = userSessions[interaction.user.id].login;
    } else if (interaction.customId === 'save_account_seneca') {
        accounts = accounts.filter(value => value.app === 'seneca');
        const { userSessions } = require('../seneca/main');
        loginsSavedTempAccount[interaction.user.id] = userSessions[interaction.user.id].login;
    } else if (interaction.customId === 'save_account_drfrost') {
        accounts = accounts.filter(value => value.app === 'drfrost');
        const { userMenus } = require('../drfrost/main');
        loginsSavedTempAccount[interaction.user.id] = userMenus[interaction.user.id].loginDetails;
    }
    else {
        accounts = accounts.filter(value => value.app === 'sparx');
        loginsSavedTempAccount = loginsSavedTemp;
    }

    if (accounts.length >= 25) {
        const section = new TextDisplayBuilder().setContent(`# Account Max Reached\nYou cannot have more than 25 accounts saved!`);

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
    
    const emailExists = accounts.some(user => user.email === loginsSavedTempAccount[interaction.user.id].email);
    if (emailExists) {
        const section = new TextDisplayBuilder().setContent(`# Account already Saved\nThe account you tried to save is already saved to your accounts!`);

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

    const sparxList = ['reader', 'maths', 'science'];
    if (sparxList.includes(loginsSavedTempAccount[interaction.user.id].app)) loginsSavedTempAccount[interaction.user.id].app = 'sparx';
    await addAccount(interaction.user.id, loginsSavedTempAccount[interaction.user.id], master_password);

    const section = new TextDisplayBuilder().setContent(`# Account Saved\nYour account has been saved to ${name}!`);

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

module.exports = { handleSavedAccounts, executeViewAccounts, saveAccount };