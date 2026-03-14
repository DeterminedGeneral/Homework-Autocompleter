// Recursive function to extract question text// Recursive function to extract question text
const { GoogleGenAI } = require("@google/genai");
function extractText(obj, results = []) {
  if (typeof obj === "object" && obj !== null) {
    if ("text" in obj && typeof obj.text === "string") {
      results.push(obj.text);
    }
    if (obj.element === 'text-field') {
        results.push(`> [INPUT HERE REF:${obj.ref}]`);
    }

    for (const key in obj) {
      extractText(obj[key], results);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach(item => extractText(item, results));
  }
  return results;
}

function extractQuestionText(content) {
    if (!content) return '';
    let text = '';
    if (Array.isArray(content)) {
        for (const item of content) text += extractQuestionText(item);
        return text;
    }
    if (content.element === 'text') return content.text + ' ';
    if (content.type?.includes('question-text') || content.content) {
        text += extractQuestionText(content.content);
    }
    return text;
}

// Recursive function to extract answer parts
function extractAnswerParts(content) {
    if (!content) return [];
    let parts = [];
    if (Array.isArray(content)) {
        for (const item of content) parts = parts.concat(extractAnswerParts(item));
        return parts;
    }
    if (content.type?.includes('answer-part')) {
        const partText = extractQuestionText(content.content).trim();
        parts.push({ id: content.id, text: partText });
    } else if (content.content) {
        parts = parts.concat(extractAnswerParts(content.content));
    }
    return parts;
}

// Recursive function to extract images
function extractImages(content) {
    if (!content) return [];
    let images = [];
    if (Array.isArray(content)) {
        for (const item of content) images = images.concat(extractImages(item));
        return images;
    }
    if (content?.figure?.image) images.push({ url: content.figure.image});
    else if (content.content) images = images.concat(extractImages(content.content));
    return images;
}

// Extract slot-based answer options
function extractSlotCards(input) {
    const slotMapping = {};
    if (!input.slot_groups || !input.cards) return slotMapping;

    for (const groupKey in input.slot_groups) {
        const group = input.slot_groups[groupKey];
        const slotRefs = group.slot_refs;

        slotRefs.forEach(slotRef => {
            const cardRefs = input.card_groups[groupKey]?.card_refs || [];
            slotMapping[slotRef] = cardRefs.map(ref => ({
                ref,
                value: input.cards[ref].content.map(c => c.text).join(' ') || input.cards[ref].content.map(c => c.src).join(' '),
            }));
        });
    }
    return slotMapping;
}

// Extract multiple-choice options
function extractChoices(input) {
    if (!input.choices) return {};
    const choices = {};
    for (const ref in input.choices) {
        choices[ref] = input.choices[ref].content.map(c => c.text).join(' ');
        if (!choices[ref]) {
            choices[ref] = input.choices[ref].content.map(c => c.src).join(' ');
        }
    }
    return choices;
}

// Extract choice groups
function extractChoiceGroups(input, layoutContent) {
    if (!input.choice_groups) return [];
    const groups = [];
    for (const key in input.choice_groups) {
        const g = input.choice_groups[key];
        groups.push({
            id: key,
            minChoices: g.min_choices,
            maxChoices: g.max_choices,
            shuffle: g.shuffle,
            choiceRefs: g.choice_refs
        });
    }

    function extractRefPos(obj, results = []) {
        if (typeof obj === "object" && obj !== null) {
            // Check if obj has a 'ref' property
            if (obj.ref) {
                for (const [index, refArray] of allRefs.entries()) {
                    // refArray might be an array, check if it includes obj.ref
                    if (Array.isArray(refArray) && refArray.includes(obj.ref)) {
                        results.push(index);
                        break;
                    }
                }
            }

            // Recurse for all properties
            for (const key in obj) {
                extractRefPos(obj[key], results);
            }
        }
        return results;
    }

    // Example setup
    const allRefs = groups.map(group => group.choiceRefs);

    const results = extractRefPos(layoutContent);
    // Remove duplicates while keeping first occurrence
    let uniqueResults = [...new Set(results)];

    const groupedByOrder = uniqueResults.map(index => groups[index]);

    return groupedByOrder;
}

// Extract number fields
// Recursive function to extract number fields from layout
// Extract number fields with their preceding text
function extractNumberFieldsWithLabels(content, number_fields) {
    if (!content) return [];
    let fields = [];

    if (Array.isArray(content)) {
        for (let i = 0; i < content.length; i++) {
            const item = content[i];

            // If it's a number-field, capture the nearest text before it
            if (item.element === 'number-field' && item.ref) {
                let label = null;

                // Look back for the nearest text element
                if (i > 0 && content[i - 1].element === 'text') {
                    label = content[i - 1].text;
                }

                fields.push({ ref: item.ref, label, properties: number_fields[item.ref] });
            }

            // Recurse if this item has nested content
            if (item.content) {
                fields = fields.concat(extractNumberFieldsWithLabels(item.content, number_fields));
            }
        }
        return fields;
    }

    // Recurse single object
    if (content.content) {
        fields = fields.concat(extractNumberFieldsWithLabels(content.content, number_fields));
    }

    return fields;
}

function getTextRefs(elements) {
  let refs = [];

  function traverse(element) {
    if (!element) return;

    // If it's an array, traverse each item
    if (Array.isArray(element)) {
      element.forEach(traverse);
      return;
    }

    // Check for answer-part with text-field
    if (element.type && element.type.includes("answer-part")) {
      if (element.content) {
        element.content.forEach(c => {
          if (c.element === "text-field" && c.ref) {
            refs.push({ ref: c.ref, text_area: c.text_area ?? false});
          }
        });
      }
    }

    // Recurse into nested content
    if (element.content) {
      traverse(element.content);
    }
  }

  traverse(elements);
  return refs;
}

// Main parser function
function parseQuestion(json) {
    const layoutContent = json.layout.content;

    const questionText = extractText(layoutContent);
    const answerParts = extractAnswerParts(layoutContent);
    const images = extractImages(layoutContent);

    const slotCards = extractSlotCards(json.input);
    const choices = extractChoices(json.input);
    const choiceGroups = extractChoiceGroups(json.input, layoutContent);
    const numberFields = extractNumberFieldsWithLabels(json.layout.content, json.input.number_fields);
    const textFields = getTextRefs(layoutContent);

    return {
        questionText,
        answerParts,
        images,
        slotCards,
        choices,
        choiceGroups,
        numberFields,
        textFields
    };
}

function getQuestionObject(aiAnswered, activityName, token) {

    const components = Object.entries(aiAnswered).reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
    }, {});

    const answerObject = {
        "name": activityName,
        "action": {
            "oneofKind": "answer",
            "answer": {
                "components": components,
                "autoProgressStep": false
            }
        },
        "token": token
    };

    // console.log(answerObject.action.question.answer.components);
    return answerObject;
}

async function parser(apikey, data, model, activityName, token, supportMaterial) {
    const parsedData = parseQuestion(data);

    const { geminiAnswer, geminiAnswers } = require('../gemini/sparx_maths/main');
    let gemAns = geminiAnswer;
    if (apikey) {
        const newClass = new geminiAnswers();
        newClass.ai = new GoogleGenAI({ apiKey: apikey });
        gemAns = newClass;
    }
    const aiAnswered = await gemAns.answerQuestion(parsedData, model, "science", supportMaterial);

    if (typeof aiAnswered === 'number') return aiAnswered;

    const answerObject = getQuestionObject(aiAnswered, activityName, token);

    return answerObject;
}

module.exports = { parser, getQuestionObject };