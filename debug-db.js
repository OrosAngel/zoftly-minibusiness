const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log("Fetching data with Service Role (Bypassing RLS)...");

    const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
    if (usersErr) console.error("Users error:", usersErr);

    const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
    if (profErr) console.error("Profiles error:", profErr);

    const { data: stores, error: storesErr } = await supabase.from('stores').select('*');
    if (storesErr) console.error("Stores error:", storesErr);

    console.log("--- USERS ---");
    console.log(users?.users?.map(u => ({ id: u.id, email: u.email })));

    console.log("\n--- PROFILES ---");
    console.log(profiles);

    console.log("\n--- STORES ---");
    console.log(stores);
}

debug();
