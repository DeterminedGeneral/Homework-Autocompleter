require('dotenv').config();;
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASEURL;
const supabaseKey = process.env.SUPABASEKEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addToDb(question, answer) {
    const { error } = await supabase
    .from('sparx_maths')
    .insert([
        { question: question, answer: answer},
    ]);

    console.log(error);
    console.log("Added to Maths DB");
}


async function checkAnswer(question) {
    const { data } = await supabase
        .from('sparx_maths')
        .select('*')      // select all columns
        .eq('question', question)      // filter where id = 1
        .single();        // get a single row instead of an array

    if (data) {
        console.log("Answer exists", data.answer);
        return data.answer;
    } else {
        console.log("Row is not present!");
        return null;
    }
}

async function getWorkingOut(question) {
    const { data } = await supabase
        .from('sparx_maths')
        .select('*')      // select all columns
        .eq('question', question)      // filter where id = 1
        .single();        // get a single row instead of an array

    if (data) {
        console.log("working_out exists", data.working_out);
        return data.working_out;
    } else {
        console.log("Row is not present!");
        return null;
    }
}

async function addWorkingOut(question, working_out) {
    const { error } = await supabase
    .from('sparx_maths')
    .update({ working_out })
    .eq('question', question);

    console.log(error);
    
}

// addToDb("1+1", ["2"]);
// checkAnswer('12')

module.exports = { addToDb, checkAnswer, getWorkingOut, addWorkingOut};