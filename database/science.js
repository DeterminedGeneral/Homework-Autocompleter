require('dotenv').config();;
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASEURL;
const supabaseKey = process.env.SUPABASEKEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addToDb(question, answer) {
    const { error } = await supabase
    .from('sparx_science')
    .insert([
        { question: question, answer: answer},
    ]);

    console.log(error);
    console.log("Added to DB");
}


async function checkAnswer(question) {
    const { data } = await supabase
        .from('sparx_science')
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

async function deleteAnswer(question) {
    const { error } = await supabase
        .from('sparx_science')
        .delete()
        .eq('question', question);

    if (error) {
        console.error("Error deleting row:", error);
        return false;
    } else {
        console.log("Row deleted successfully!");
        return true;
    }
}

// addToDb("1+1", {"bozo": "ank"});
// checkAnswer('1+1')

module.exports = { addToDb, checkAnswer, deleteAnswer};