const aiModels = require('../aiModelsRanking.json');

function isHigherModel(modelTest, lastModelTried) {
    const normalize = (m) => m.startsWith('gemini-') ? m : `gemini-${m}`;
    
    const testIndex = aiModels.indexOf(normalize(modelTest));
    const lastIndex = aiModels.indexOf(normalize(lastModelTried));
    if (testIndex === -1 || testIndex === -1) {
        throw new Error('No model found');
    }
    return lastIndex < testIndex;
}

module.exports = isHigherModel;