# Introduction
This project made to help students automatically complete their homework with the use of ai and requests while avoiding detection. You may use the code and database for whatever use case but providing credit back to this original project is preferable. 

The installation guide below is a step by step guide on how to setup the bot on your own computer. The bot may or may not work on a cloud server due to cloudflare.

**If you are only planning to use the bot for personal use, you can use the bot for free at the discord server!**

## Discord Server
https://discord.gg/9WRbuqqxjP
DM churrogamer (Discord ID: 1187435043493257256) if the link ever becomes invalid

## Installation
The guide assumes you have Node JS, Python and (preferably) VS Code installed, are able to use the command line, and the can get IDs of things in discord easily (enable developer mode in the settings).

### Creating the Discord Bot

1. Go to https://discord.com/developers/applications and create a new application.
2. In that new application, go to `Bot` and enable all the intents listed there (Presence, Server Members, Message Content).
3. Go to `OAuth2` and for the URL Generator: `bot -> Administrator` and copy and paste the generated link into your browser.
4. Now add the bot to the server you wish.

### Setting up the Database

1. Download and Exract https://drive.google.com/file/d/1CJkInqI50boy9Fn5ea-ZzYnCMNoeN5jC/view?usp=sharing and open it up in VS Code. Run `npm install`
2. Go to https://supabase.com/, create a new organisation and create a database.
3. Copy and paste the schema.txt into the `SQL Editor` and the run the command for each schema.
4. Create a new file named `.env` and fill it out. The Project ID can be found in `Project Settings` under general settings. The key can be found in `Project Settings -> API Keys` with it being the publishable key.
5. Run `node index` in the terminal

### Installing and Configuring the Discord Bot

1. Create a new folder (you can name it whatever you like) and open it up in VS Code, go to `Terminal -> New Terminal` (Top left) and run the following commands:
```bash
git clone https://github.com/DeterminedGeneral/Homework-Autocompleter.git .
npm install
```
2. Create a new file named `.env` and `.config` and fill it out. Use the ID of the role/channel instead of the name
3. Run `node index` in the terminal and the bot should now work

### Updating the Discord Bot

Once a new update has been rolled out to the bot. You can run `git pull origin main` in the folder of the discord bot to easily get the new changes. Make sure to check if the .example of any of the files has changed and update them accordingly!