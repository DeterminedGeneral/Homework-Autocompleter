require('dotenv').config();
const { GoogleGenAI } = require("@google/genai");
const apiKeyGlobal = process.env.GEMINI_API_KEY;

async function answerQuestionAi(apiKey, extract, question, questionOptions, incorrectAnswers=[]) {
  if (!apiKey) {
    apiKey = apiKeyGlobal;
  }

  try {

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const chat = ai.chats.create({
    model: "gemini-2.5-flash-lite",
    history: [
      {
        role: "user",
        parts: [{ text: `You will answer the question at the very bottom of the message that is written under Q1-Q4. Each new line under the question is a new possible answer. Do not be afraid not answer 'Not in the Story'. The next message will be the extract and the following messages will be the questions. Reply to the extract by saying "I have acknowledged the extract and will use it for the next questions." Please provide ONLY the answer from the possibile answers word for word and nothing else, do you understand?` }],
      },
      {
        role: "model",
        parts: [{ text: "Yes, I understand. I will read the extract you provide and will use it to answer your questions. I will provide the full answer including the (Number). of the answer. I will absouletely include the number of the answer." }],
      },
      {
        role: "user",
        parts: [{ text: extract }],
      },
      {
        role: "model",
        parts: [{ text: "I have read and understood the extract and will use it to answer your questions." }],
      },
    ],
  });

  let questionFull = question;
  let counter = 0;
  const possibleQuestions = [];
  for (const option of questionOptions) {
    if ( !(incorrectAnswers.includes(option)) ) {
      counter += 1;
      questionFull += `\n${counter}. ${option}`;
      possibleQuestions.push(option);
    }
  }

  // console.log(`Question full\n${questionFull}`);
  // console.log(`Question options: ${questionOptions}`);

  const response = await chat.sendMessage({
    message: questionFull,
  });
  // console.log(response.text)
  let match = response.text.match(/\d/); // \d matches any digit

  if (match) {
    // console.log(match[0]); // Output: "4"
  } else {
    // console.log("No digit found.");
    match = [1];
  }
  // console.log(`Returning: ${possibleQuestions[match[0] - 1]}`);
  return possibleQuestions[match[0] - 1];

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

module.exports = { answerQuestionAi };