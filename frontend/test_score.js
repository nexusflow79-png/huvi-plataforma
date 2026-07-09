require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
sb.from('opportunities').select('id, contact_name, score').limit(5).then(res => console.log(JSON.stringify(res.data, null, 2)));
