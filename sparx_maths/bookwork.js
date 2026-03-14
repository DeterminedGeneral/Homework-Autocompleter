function findCommonAnswer(data, previousAnswers = []) {
    const options = data?.payload?.wac?.options || [];

    // Map values to their full data
    const valueMap = new Map();
    for (const opt of options) {
        const components = opt?.wacedAnswer?.components || [];
        const value = components.map(c => c.value).join(','); // if multiple components, join them
        valueMap.set(value, {
            value,
            filledAnswerTemplate: opt.filledAnswerTemplate,
            components
        });
    }

    if (!previousAnswers.length) {
        return Array.from(valueMap.values());
    }

    // Intersection with previous answers
    const concurrentValues = [];
    for (const value of valueMap.keys()) {
        if (previousAnswers.some(ans => ans.value === value)) {
            concurrentValues.push(valueMap.get(value));
        }
    }

    return concurrentValues;
}

function getBookworkCheckAnswer(data, commonAnswersPrevious) {
    commonAnswersPrevious = findCommonAnswer(data, commonAnswersPrevious);
    return commonAnswersPrevious;
}

module.exports = { getBookworkCheckAnswer };