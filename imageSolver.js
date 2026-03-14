const config = require('./config.json');
const { GoogleGenAI, Type } = require("@google/genai");
const { MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const IMAGE_SOLVER_CHANNEL_ID = config.image_solver;
const apiKey = process.env.GEMINI_API_KEY;

async function aiAnswer(ai, image, model) {
const response = await ai.models.generateContent({
  model: `gemini-2.5-${model}`,
  contents: [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: image, // must be base64 ONLY (no data:image/... prefix)
          },
        },
        {
          text: "Solve the problem stated in this image.",
        },
      ],
    },
  ],
  config: {
    systemInstruction:
      "Do not use any formatting other than what discord allows and make the explanation pretty",
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        answer: { type: Type.STRING },
        explanation: { type: Type.STRING },
      },
      required: ["answer", "explanation"],
      propertyOrdering: ["answer", "explanation"],
    },
  },
});

    const answerObj = JSON.parse(response.candidates[0].content.parts[0].text);

    return answerObj;
}

async function imageSolver(image, message, message_sent, mode = 'flash') {
    const seperator = new SeparatorBuilder({
        spacing: SeparatorSpacingSize.Small
    });
    const title = `Gemini 2.5 ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
    try {

    const waitingSection = new TextDisplayBuilder().setContent(`## ${title}\nWaiting for <t:${Math.floor(Date.now() / 1000)}:R>`);

    const waitingContainer = new ContainerBuilder()
        .setAccentColor(0x3574cf)
        .addTextDisplayComponents(
            waitingSection
        );

    if (mode === 'flash') {
        message_sent = await message.reply({ components: [waitingContainer], flags: MessageFlags.IsComponentsV2 });
    } else {
        await message_sent.edit({ components: [waitingContainer] });
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
    const answerObj = await aiAnswer(ai, image, mode);

    const section = new TextDisplayBuilder().setContent(`## ${title}\n${answerObj.answer}`);

    const correctBtn = new ButtonBuilder()
        .setCustomId(`correct-${mode}`) // Unique ID for interaction
        .setLabel('Correct')
        .setEmoji(config.correct) // Label for the button
        .setStyle(ButtonStyle.Success); // Style of the button (Primary, Secondary, Success, Danger, Link)

    const retryBtn = new ButtonBuilder()
        .setCustomId(`retry-${mode}`) // Unique ID for interaction
        .setLabel('Retry') // Label for the button
        .setEmoji(config.retry) // Emoji for the button
        .setStyle(ButtonStyle.Danger); // Style of the button (Primary, Secondary, Success, Danger, Link)

    const explanationBtn = new ButtonBuilder()
        .setCustomId(`explanation-${mode}`) // Unique ID for interaction
        .setLabel('Explanation') // Label for the button
        .setEmoji(config.explanation) // Emoji for the button
        .setStyle(ButtonStyle.Primary); // Style of the button (Primary, Secondary, Success, Danger, Link)

    const buttonRow = new ActionRowBuilder().addComponents(correctBtn, retryBtn, explanationBtn);

    const answerContainer = new ContainerBuilder()
        .setAccentColor(0x3574cf)
        .addTextDisplayComponents(
            section.data
        )
        .addSeparatorComponents(
            seperator
        )
        .addActionRowComponents(
            buttonRow
        );

    const collector = message_sent.createMessageComponentCollector({
        componentType: ComponentType.Button
    });

    await message_sent.edit({ components: [answerContainer] });
    const originalPoster = message.author.id;

    let onAnswer = true;

    collector.on('collect', async(interaction) => {
        if (mode === 'flash') {
            await interaction.deferUpdate();
        }

        if (interaction.user.id !== originalPoster) {
            return;
        }

        // console.log(`Mode recieved ${mode}`);

        if (interaction.customId === `correct-${mode}`) {
            answerContainer.setAccentColor(0x51A687);

            for (const component of buttonRow.components) {
                component.setDisabled(true);
            }

            await message_sent.edit({ components: [answerContainer] });
        } else if (interaction.customId === `retry-${mode}`) {
            if (mode === 'flash') {
                await imageSolver(image, message, message_sent, 'pro');
                return;
            } 
            answerContainer.setAccentColor(0xFF474D);

            for (const component of buttonRow.components) {
                component.setDisabled(true);
            }

            await message_sent.edit({ components: [answerContainer] });

        } else if (interaction.customId === `explanation-${mode}`) {
            if (!onAnswer) {
                await message_sent.edit({ components: [answerContainer] });
                onAnswer = true;
                return;
            }
            onAnswer = false;
            const explanationSection = new TextDisplayBuilder().setContent(`## ${title}\n${answerObj.explanation}\n-# click on the explanation button again to go back to the answer`);
            const explanationContainer = new ContainerBuilder()
            .setAccentColor(0xFDD808)
            .addTextDisplayComponents(
                explanationSection.data
            )
            .addSeparatorComponents(
                seperator
            )
            .addActionRowComponents(
                buttonRow
            );

            await message_sent.edit({ components: [explanationContainer] });
        }

    });

    } catch(err) {
        console.log(err);

        const errorSection = new TextDisplayBuilder().setContent(`## Error occured with ${title}\nAn error has occured with the request. Please try again later.`);

        const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF474D)
            .addTextDisplayComponents(
                errorSection
            );

        await message_sent.edit({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 });
    }

}

async function imageSolverHandler(message) {
    // Ignore messages from other channels
    if (
        (Array.isArray(IMAGE_SOLVER_CHANNEL_ID) && !IMAGE_SOLVER_CHANNEL_ID.includes(message.channel.id)) ||
        (!Array.isArray(IMAGE_SOLVER_CHANNEL_ID) && message.channel.id !== IMAGE_SOLVER_CHANNEL_ID)
    ) return;

    // Ignore messages from bots (optional)
    if (message.author.bot) return;
    // Get all image attachments
    const imageAttachments = message.attachments.filter(attachment =>
    attachment.contentType?.startsWith('image/')
    );

    if (imageAttachments.size > 0) {
    for (const attachment of imageAttachments.values()) {
        const responseImage = await fetch(attachment.url);
        const imageArrayBuffer = await responseImage.arrayBuffer();
        const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');

        await imageSolver(base64ImageData, message);
    }

    return;
    }
}

module.exports = imageSolverHandler;