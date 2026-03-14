require('dotenv').config();
const { GoogleGenAI, Type } = require("@google/genai");
const Image_Requesticator = require('./requesticator');
const apiKey = process.env.GEMINI_API_KEY;

function isUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

class geminiAnswers {
    constructor() {
        this.ai = new GoogleGenAI({ apiKey: apiKey });
        this.requesticator = new Image_Requesticator();
    }

    async answerQuestion(questionObj, model, sparx="maths", supportMaterial) {

        try {

        const contents = [];

        // If image exists, include it
        if (questionObj['images'].length) {
            const imageUrl = `https://cdn.sparx-learning.com/${questionObj['images'][0].url}`;
            const responseImage = await this.requesticator.sendRequest(imageUrl);
            console.log(responseImage.data);
            const base64ImageData = Buffer.from(responseImage.data).toString('base64');

            contents.push({
                inlineData: {
                mimeType: 'image/jpeg',
                data: base64ImageData,
                altText: 'Question Image'
                },
            });
        }

        // Always include question text
        let totalText = "";
        let systemInstruction = '';
        for (const text of questionObj['questionText']) {
            totalText += `${text}\n`;
        }
        if (supportMaterial) {
            totalText += `Support Material: ${supportMaterial}`;
            systemInstruction = 'PLEASE USE THE SUPPORT MATERIAL;';
        }
        contents.push({ text: totalText });

        const properties = {};
        const findCardRef = [];

        const cardToRefs = {};
        for (const choiceGroup of questionObj.choiceGroups) {
            cardToRefs[choiceGroup.id] = [];
            for (const ref of choiceGroup.choiceRefs) {
                cardToRefs[choiceGroup.id].push(questionObj.choices[ref]);
            }
        }

        let index = 0;

        for (const [key, value] of Object.entries(cardToRefs)) {
            for (const valueID of Object.values(value)) {
                if (isUUID(valueID)) {
                    systemInstruction = "Determine the positions of the images for the array based on their alt text descriptions. Do not rely on the order of the images in the array that is provided.";
                    
                    const imageUrl = `https://cdn.sparx-learning.com/${valueID}`;
                    const responseImage = await this.requesticator.sendRequest(imageUrl);
                    const base64ImageData = Buffer.from(responseImage.data).toString('base64');

                    contents.push({
                        inlineData: {
                        mimeType: 'image/jpeg',
                        data: base64ImageData,
                        altText: `This is the id of the image: ${valueID}`
                        },
                    });
                
                }
            }
            properties[key] = {type: Type.ARRAY, items: { type: Type.STRING, enum: value }, minItems: questionObj.choiceGroups[index].minChoices, maxItems: questionObj.choiceGroups[index].maxChoices};
            index++;
        }
        // properties['choices'] = {type: Type.ARRAY, items: { type: Type.STRING, enum: Object.values(questionObj.choices) }, minItems: questionObj.choiceGroups[0].minChoices, maxItems: questionObj.choiceGroups[0].maxChoices};

        for (const [index, [key, card]] of Object.entries(questionObj.slotCards).entries()) {
            const cardValues = [];
            findCardRef.push({});
            for (const item of card) {
                const valueID = item.value;
                if (isUUID(valueID)) {
                    systemInstruction = "Determine the positions of the images for the array based on their alt text descriptions. Do not rely on the order of the images in the array that is provided.";
                    const imageUrl = `https://cdn.sparx-learning.com/${valueID}`;
                    const responseImage = await this.requesticator.sendRequest(imageUrl);
                    const base64ImageData = Buffer.from(responseImage.data).toString('base64');

                    contents.push({
                        inlineData: {
                        mimeType: 'image/jpeg',
                        data: base64ImageData,
                        altText: `This is the id of the image: ${valueID}`
                        },
                    });
                }
                cardValues.push(item.value);
                findCardRef[index][item.value] = item.ref;
            }
            // console.log(cardValues);
            if (cardValues.includes('have')) {
                properties[key] = {type: Type.STRING, description: 'Always choose "have" over "have not"', enum: cardValues};
            } else {
                properties[key] = {type: Type.STRING, enum: cardValues};
            }
        }

        // console.log("Properties before");
        // console.log(properties);
        questionObj.textFields.forEach(field => {
            const description = field.text_area ? 'Use keywords in your answer and limit it to a paragraph' : 'Your answer should be no longer than a word or a few words';
            properties[field.ref] = {
                type: Type.STRING,
                description: description
            };
        });

        questionObj.numberFields.forEach(field => {
            properties[field.ref] = {
                type: Type.NUMBER,
                description: field.label
            };
        });

        if (sparx === 'maths') {
            properties['BearingAsAnswer'] = {
                type: Type.BOOLEAN,
                description: 'If the question wants you to give the answer as a bearing then set this as true.'
            };
            properties['WORKING OUT'] = {
                type: Type.STRING,
                description: 'Please provide working out for the question. PLEASE be concise. Use LATEX however always use a ; to notate a new line'
            };
        }

        if (sparx === 'science') {
            systemInstruction += ' DO NOT USE LATEX FOR YOUR ANSWER';
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
                },
                systemInstruction: systemInstruction
            },
        });

        // Parse output
        const answerObj = JSON.parse(response.candidates[0].content.parts[0].text);

        // Convert all values to strings (if needed)
        // console.log(findCardRef);
        for (const [index, [ref, value]] of Object.entries(answerObj).entries()) {
            if (ref.includes('choice_group')) {
                // console.log(value[0]);
                for (const valueID of value) {
                    const key = Object.keys(questionObj.choices).find(key => questionObj.choices[key] === valueID);
                    // console.log(key);
                    answerObj[key] = valueID;
                    delete answerObj[ref];
                }
            } else if (findCardRef[index] && value in findCardRef[index]) {
                answerObj[ref] = String(findCardRef[index][value]);
            } else {
                for (const numberField of questionObj.numberFields) {
                    if (numberField.ref === ref) {
                        if (numberField?.properties?.sign === 'positive') {
                            answerObj[ref] = Math.abs(answerObj[ref]);
                        }
                        if (answerObj.BearingAsAnswer === true) {
                            answerObj[ref] = String(answerObj[ref]).padStart(3, '0');
                        }
                    }
                }

                if (sparx === 'science') {
                    const objectRef = questionObj.choiceGroups.find(key => key.id === ref);
                    if (!objectRef) {
                        answerObj[ref] = String(answerObj[ref]);
                    } else {
                        const answerChoicesRefs = {};
                        for (const choiceRef of objectRef.choiceRefs) {
                            answerChoicesRefs[questionObj.choices[choiceRef]] = choiceRef;
                        }
                        for (const i in value) {
                            answerObj[answerChoicesRefs[value[i]]] = value[i];
                        }
                        delete answerObj[ref];
                    }
                } else {
                    answerObj[ref] = String(answerObj[ref]);
                }
            }
        }

        return answerObj;

        } catch(err) {
            const handlableErrorCodes = [503, 429];
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

            const code = parsed?.error?.code;
            if (handlableErrorCodes.includes(code)) {
                return code;
            } else {
                throw err;
            }
        }

    }
}

const geminiAnswer = new geminiAnswers();
module.exports = { geminiAnswer, geminiAnswers };