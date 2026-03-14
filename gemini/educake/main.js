require('dotenv').config();
const { GoogleGenAI, Type } = require("@google/genai");
const apiKey = process.env.GEMINI_API_KEY;

class geminiAnswers {
    constructor() {
        this.ai = new GoogleGenAI({ apiKey: apiKey });
    }

    async answerQuestion(questionObj, model) {

        try {

        const contents = [];

        // If image exists, include it
        if (questionObj.image) {
            const responseImage = await fetch(questionObj.image);
            const imageArrayBuffer = await responseImage.arrayBuffer();
            const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');

            contents.push({
                inlineData: {
                mimeType: 'image/jpeg',
                data: base64ImageData,
                altText: 'Question Image'
                },
            });
        }

        // Always include question text
        contents.push({ text: questionObj.question });

        let properties;

        if (questionObj.choices) {
           properties = {
            answer: {
                type: Type.STRING,
                enum: Object.values(questionObj.choices),
                description: "Pick the correct answer from the list."
            }
            };
        } else if (questionObj.type === 'number') {
            properties = {
            answer: {
                type: Type.NUMBER
            }
            };
        } else {
            properties = {
            answer: {
                type: Type.STRING,
                description: "Keep your answer concise and use key words. YOUR ANSWER MUST BE NO LONGER THAN THREE WORDS."
            }
            };
        }

        let response = await this.ai.models.generateContent({
            model: `gemini-${model}`,
            contents: contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: properties,
                    required: Object.keys(properties),
                    propertyOrdering: Object.keys(properties),
                }
            },
        });

        // Parse output
        let raw = response.candidates[0].content.parts[0].text.trim();

        // Remove ```json or ``` and trailing ```
        raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();

        let answerObj = JSON.parse(raw);

        if (questionObj.type === 'number') {
            answerObj.answer = String(answerObj.answer);
        }
        console.log('Answer response', answerObj.answer);
        answerObj.answer = answerObj.answer.replace(/'/g, "'\\''");
        return answerObj.answer;

        } catch(err) {
            let parsed = err;

            // If it's an Error object with JSON in .message
            if (err instanceof Error) {
                try {
                    parsed = JSON.parse(err.message);
                } catch {
                    parsed = err; // fallback
                }
            }

            // If it's a JSON string
            if (typeof err === "string") {
                try {
                    parsed = JSON.parse(err);
                } catch {
                    parsed = { error: { message: err } }; // wrap raw string
                }
            }

            if (parsed?.error?.code == 503) {
                return 503;
            } else {
                throw err;
            }
        }

    }
}

const geminiAnswer = new geminiAnswers();
module.exports = { geminiAnswer };