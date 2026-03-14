require('dotenv').config();;
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASEURL;
const supabaseKey = process.env.SUPABASEKEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addToDb(question, params, answer) {
    const { error } = await supabase
    .from('drfrost')
    .insert([
        { question: question, params: params ?? [], answer: answer},
    ]);

    console.log(error);
    console.log("Added to DB");
}


async function checkAnswer(question, params) {
    const safeParams = params ?? [];

    // 1. Ask Supabase for ANY entry with this Question HTML
    // We remove .eq('params') because it is too strict/finicky in SQL
    const { data, error } = await supabase
        .from('drfrost')
        .select('*')
        .eq('question', question);

    if (error || !data || data.length === 0) {
        return null;
    }

    // 2. Loop through the results in JavaScript to find the matching params
    // JSON.stringify is a reliable way to compare simple arrays like [1, 0, 2...]
    const match = data.find(row => JSON.stringify(row.params) === JSON.stringify(safeParams));

    if (match) {
        console.log("Answer exists via JS check", match.answer);
        return match.answer;
    } else {
        console.log("Question found, but params didn't match.");
        return null;
    }
}

async function deleteAnswer(question) {
    const { error } = await supabase
        .from('drfrost')
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