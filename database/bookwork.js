require('dotenv').config();;
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASEURL;
const supabaseKey = process.env.SUPABASEKEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addToDbBookwork(package_id, bookworks) {

    const existingBookwork = await getBookworks(package_id); // package_id; timestamp; answers

    const updatedBookworks = JSON.parse(existingBookwork.bookworks);

    // Step 1: Merge objects (obj1 takes precedence if keys overlap)
    const mergedObj = { ...bookworks, ...updatedBookworks }; // obj1 overwrites obj2 on duplicates

    // Step 2: Sort keys
    const sortedKeys = Object.keys(mergedObj).sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)[0], 10);
    const numB = parseInt(b.match(/\d+/)[0], 10);

    const charA = a.match(/[A-Z]+/)[0];
    const charB = b.match(/[A-Z]+/)[0];

    if (numA !== numB) return numA - numB;
    return charA.localeCompare(charB);
    });

    // Step 3: Build sorted object
    const finalObj = {};
    sortedKeys.forEach(key => {
    finalObj[key] = mergedObj[key];
    });

    console.log(finalObj);

    if (!existingBookwork.timestamp) {
        console.log('about to add');
        console.log(package_id);
        const { error } = await supabase
        .from('bookworks')
        .insert([
            { package_id: package_id, bookworks: JSON.stringify(finalObj), timestamp: new Date()},
        ]);

        console.log(error);
        console.log("Added to DB");
    } else {
        console.log('about to update');
        console.log(package_id);
        const { error } = await supabase
        .from('bookworks')
        .update([
            { package_id: package_id, bookworks: JSON.stringify(finalObj), timestamp: new Date()},
        ])
        .eq('package_id', package_id);

        console.log(error);
        console.log("updated DB");
    }
}


async function getBookworks(package_id) {
    const { data } = await supabase
        .from('bookworks')
        .select('*')      // select all columns
        .eq('package_id', package_id)      // filter where id = 1
        .single();        // get a single row instead of an array

    if (data) {
        console.log("Answer exists", data.bookworks);
        return data;
    } else {
        console.log("Row is not present!");
        return { bookworks: '{}', timestamp: null};
    }
}

/*
addToDb("1", {
    "1A": "2", 
    "1B": "8", 
    "1D": "24",
    "1C": "42",
    "2A": "23",
    "2B": "05"
});
*/
// checkAnswer('1+1')

module.exports = { addToDbBookwork, getBookworks };