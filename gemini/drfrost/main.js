require('dotenv').config();
const { GoogleGenAI, Type } = require("@google/genai");
const apiKey = process.env.GEMINI_API_KEY;
const getAxisScales = require('./scale');

class geminiAnswers {
    constructor() {
        this.ai = new GoogleGenAI({ apiKey: apiKey });
    }

    async answerQuestion(questionObj, model) {

        try {

        const contents = [];

        // If image exists, include it
        /*
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
        */

        // Always include question text
        let questionText = questionObj.content;
        console.log(questionObj.answer.type);
        let answerText = '';
        if (questionObj.answer.type !== 'desmos') {
            answerText = `${questionObj.answer.data.before} [INPUT ANSWER HERE] ${questionObj.answer.data.after}`;
        }
        questionText += `\n\n${answerText}`;
        contents.push({ text: questionText });

        let properties;
        let scales;
        console.log(questionObj.answer);
        if (questionObj.answer.type === 'numeric') {
            properties = {
            answer: {
                type: Type.NUMBER
            }
            };
        } else if (questionObj.answer.type === 'textual') {
            properties = {
            answer: {
                type: Type.STRING,
                description: 'provide JUST the answer!'
            }
            };
        } else if (questionObj.answer.type === 'multiplechoice') {
            properties = {
                answer: {
                    type: Type.ARRAY, items: { type: Type.STRING, enum: questionObj.answer.data.options }, maxItems: questionObj.answer.data.multiple ? questionObj.answer.data.options.length : 1,
                }
            };
        } else if (questionObj.answer.type === 'expression') {
            properties = {
            answer: {
                type: Type.STRING,
                description: 'Use LATEX and provide JUST the answer!'
            }
            };
        } else if (questionObj.answer.type === 'table') {
            let rowsString = '';
            let rowIndex = 0;
            for (const fixedVal of questionObj.answer.data.fixedVals) {
                console.log(fixedVal);
                rowsString += '\n';
                for (const val of fixedVal) {
                    if (val) {
                        rowsString += `${val};`;
                    } else {
                        rowsString += `[ANSWER INDEX ${rowIndex}];`;
                        rowIndex++;
                    }
                }
            }
            console.log(rowsString);
            let maxAndMin = rowIndex;
            properties = {
            answer: {
                type: Type.ARRAY, // or SchemaType.ARRAY if using the SDK enum
                description: rowsString,
                items: {
                type: Type.NUMBER, // or SchemaType.STRING
                },
                minItems: maxAndMin,
                maxItems: maxAndMin,
            }
            };
        } else if (questionObj.answer.type === 'desmos') {
            const pointsToMove = [];
            scales = getAxisScales(questionObj);
            console.log(scales);

            for (const point of questionObj.answer.data.initialPoints) {
                console.log(point);
                let moveAblePoint;
                if (point.dragMode === 'Y') {
                    moveAblePoint = {x: point.x * scales.xScale, y: Type.NUMBER};
                } else {
                    moveAblePoint = {x: Type.NUMBER, y: point.y * scales.yScale};
                }
                pointsToMove.push(moveAblePoint);
            }
            console.log(pointsToMove);
            // 1. Create a readable string description of your constraints
            // We convert the 'Type.NUMBER' placeholders into instructions like "CALCULATE_THIS"
            const constraints = pointsToMove.map(p => ({
            x: (p.x === Type.NUMBER || p.x === 'NUMBER') ? "CALCULATE_THIS" : p.x,
            y: (p.y === Type.NUMBER || p.y === 'NUMBER') ? "CALCULATE_THIS" : p.y,
            }));

            // 2. Convert that object to a string
            const constraintsString = JSON.stringify(constraints);

            // 3. Define the Schema
            properties = {
            answer: {
                type: Type.ARRAY,
                // INJECT THE CONSTRAINTS HERE:
                description: `A list of coordinates. You must strictly follow this template and only calculate the missing values: ${constraintsString}`,
                items: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                },
                required: ["x", "y"],
                },
                // Optional: Ensure the AI returns exactly the same number of items as your template
                minItems: pointsToMove.length,
                maxItems: pointsToMove.length,
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
        let raw = response.candidates[0].content.parts[0].text;

        let answerObj = JSON.parse(raw);

        if (questionObj.answer.type === 'numeric') {
            answerObj.answer = String(answerObj.answer);
        } else if (questionObj.answer.type === 'multiplechoice') {
            answerObj.answer = String(questionObj.answer.data.options.findIndex(item => item === answerObj.answer[0]) + 1);
        } else if (questionObj.answer.type === 'expression') {
            answerObj.answer = String(answerObj.answer.trim().replace(/\\+/g, '\\\\'));
        } else if (questionObj.answer.type === 'table') { 
            console.log(answerObj.answer);
            const answerInputArray = [];
            let index = 0;
            for (const fixedVal of questionObj.answer.data.fixedVals) {
                const answerArray = [];
                for (const val of fixedVal) {
                    if (val) {
                        answerArray.push('');
                    } else {
                        answerArray.push(`${answerObj.answer[index]}`);
                        index++;
                    }
                }
                answerInputArray.push(answerArray);
            }
            console.log(answerInputArray);
            answerObj.answer = answerInputArray;
        } else if (questionObj.answer.type === 'desmos') {
            for (let point of answerObj.answer) {
                point.x = String(point.x / scales.xScale);
                point.y = String(point.y / scales.yScale);
            }
            // divide by the scale
        }
        console.log('Answer response', answerObj.answer);
        return answerObj.answer;

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
module.exports = { geminiAnswer };