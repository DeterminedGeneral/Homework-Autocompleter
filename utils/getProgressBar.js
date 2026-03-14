const { emojis } = require('../config.json');

function getProgressBar(totalCorrect, total) {

    let greenBarsNum = Math.round((totalCorrect / total) * 10);
    if (greenBarsNum > 10) greenBarsNum = 10;

    let progressBar = "";

    for (let i = 0; i < 10; i++) {
        if (i === 0) {
            // left edge
            progressBar += (greenBarsNum > 0) ? emojis.left_full : emojis.left_empty;
        } else if (i === 9) {
            // right edge
            progressBar += (greenBarsNum > 9) ? emojis.right_full : emojis.right_empty;
        } else {
            // middle
            progressBar += (i < greenBarsNum) ? emojis.mid_full : emojis.mid_empty;
        }
    }

    return progressBar;
}

module.exports = getProgressBar;