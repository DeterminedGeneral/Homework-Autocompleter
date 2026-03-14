require('dotenv').config();;
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASEURL;
const supabaseKey = process.env.SUPABASEKEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// aes256-gcm.js (Node.js)
const crypto = require("crypto");

// Packs: [salt(16) | iv(12) | tag(16) | ciphertext] -> base64
function encrypt(plaintext, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12); // GCM nonce size
  const key = crypto.scryptSync(password, salt, 32); // 32 bytes = AES-256 key

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, ciphertext]).toString("base64");
}

function decrypt(payloadB64, password) {
  try {
    const data = Buffer.from(payloadB64, "base64");
    const salt = data.subarray(0, 16);
    const iv   = data.subarray(16, 28);
    const tag  = data.subarray(28, 44);
    const ciphertext = data.subarray(44);

    const key = crypto.scryptSync(password, salt, 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    // If decryption fails (wrong password or corrupted data)
    return null; // or throw a custom error
  }
}

async function deleteAccounts(discord_id) {
    const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('discord_id', discord_id);

    if (error) {
        console.log('Error deleting row:', error);
    } else {
        console.log('Row deleted successfully!');
    }
}

async function updateSavedAccounts(discord_id, newAccounts, master_password) {
    const loginEncrypted = encrypt(JSON.stringify(newAccounts), master_password);

    const { error } = await supabase
    .from('accounts')
    .update({ saved_accounts: loginEncrypted }) // INSERT STUFF HERE
    .eq('discord_id', discord_id);

    console.log("Saved accounts updated!!");
    console.log(error);
}

async function addAccount(discord_id, login_details, master_password) {

    const existingAccounts = await checkAccounts(discord_id, master_password);

    if (existingAccounts === false) return false;

    if (existingAccounts) {
        existingAccounts.push(login_details);
        const loginEncrypted = encrypt(JSON.stringify(existingAccounts), master_password);

        const { error } = await supabase
        .from('accounts')
        .update({ saved_accounts: loginEncrypted }) // INSERT STUFF HERE
        .eq('discord_id', discord_id);

        console.log("Saved accounts updated");
        console.log(error);

    } else {
        const loginEncrypted = encrypt(JSON.stringify([login_details]), master_password);

        const { error } = await supabase
        .from('accounts')
        .update([
            { saved_accounts: loginEncrypted}, // INSERT STUFF HERE
        ])
        .eq('discord_id', discord_id);

        console.log(error);
        console.log("Saved acccount Added to DB");
    }
    return true;
}


async function checkAccounts(discord_id, master_password) {
    const { data } = await supabase
        .from('accounts')
        .select('*')      // select all columns
        .eq('discord_id', discord_id)      // filter where id = 1
        .single();        // get a single row instead of an array

    if (data.saved_accounts) {
        const decryptedData = decrypt(data.saved_accounts, master_password);
        if (!decryptedData) {
            return false;
        }
        return JSON.parse(decryptedData);
    } else {
        console.log("Account is not present saved!");
        return null;
    }
}

module.exports = { addAccount, checkAccounts, deleteAccounts, updateSavedAccounts};