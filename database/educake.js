require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASEURL;
const supabaseKey = process.env.SUPABASEKEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addToDbEducake(id, answer, triedAdvanced) {
    const data = await checkAnswer(id);
        
    if (data === null) {
        // console.log('No row exists');
        await supabase
        .from('educake')
        .insert([
            { id, answer, triedAdvanced },
        ]);

        // console.log(error);
        // console.log('Inserted question:', id);
    } else if (data === false || data === true) {

        await supabase
        .from('educake')
        .update({ id, answer, triedAdvanced })
        .eq('id', id);

        // console.log(error);

        // console.log("Partial update success");
    }
}


async function checkAnswer(id) {
    const { data } = await supabase
        .from('educake')
        .select('*')      // select all columns
        .eq('id', id)      // filter where id = 1
        .single();        // get a single row instead of an array

    if (data) {
        if (data.answer) {
            // console.log("Answer exists and is correct", data.correct_answer);
            return data.answer;
        } else {
            // console.log("Correct answer is not present");
            // console.log(data.incorrect_answers);
            return data.triedAdvanced;
        }
    } else {
        // console.log("Row is not present!");
        return null;
    }
}

/*
(async () => {

    await addToDb(3, 'fuck you', true);
    const dbResponse = await checkAnswer(3);
    console.log(dbResponse);

})();
*/

module.exports = { addToDbEducake, checkAnswer};