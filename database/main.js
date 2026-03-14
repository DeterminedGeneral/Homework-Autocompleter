require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASEURL;
const supabaseKey = process.env.SUPABASEKEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addToDb(id, correct_answer, incorrect_answers=[]) {
    const { data } = await supabase
        .from('sparx_reader')
        .select('*')
        .eq('id', id)
        .single();
        
    if (!data) {
        // console.log('No row exists');
        await supabase
        .from('sparx_reader')
        .insert([
            { id: id, correct_answer: correct_answer, incorrect_answers: incorrect_answers },
        ]);

        // console.log(error);
        // console.log('Inserted question:', id);
    } else {
        // console.log('row exists');
        // console.log(data);
        let incorrectAnswers = data.incorrect_answers || [];
        // console.log(incorrectAnswers);

        for (const answer of incorrect_answers) {
            if (!incorrectAnswers.includes(answer)) {
                incorrectAnswers.push(answer);
            }
        }

        // console.log(incorrectAnswers);

        await supabase
        .from('sparx_reader')
        .update({ correct_answer: correct_answer, incorrect_answers: incorrectAnswers })
        .eq('id', id);

        // console.log(error);

        // console.log("Partial update success");
    }
}


async function checkAnswer(id) {
    const { data } = await supabase
        .from('sparx_reader')
        .select('*')      // select all columns
        .eq('id', id)      // filter where id = 1
        .single();        // get a single row instead of an array

    if (data) {
        if (data.correct_answer) {
            // console.log("Answer exists and is correct", data.correct_answer);
            return data.correct_answer;
        } else {
            // console.log("Correct answer is not present");
            // console.log(data.incorrect_answers);
            return data.incorrect_answers;
        }
    } else {
        // console.log("Row is not present!");
        return null;
    }
}

// addToDb(3, null, ["haha"]);
// checkAnswer('02f8a2b1-82ec-4244-a498-8ab911edb9ab')

module.exports = { addToDb, checkAnswer};