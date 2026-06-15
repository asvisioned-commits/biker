const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://tjwdejytsfzfwnfhugxe.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqd2Rlanl0c2Z6ZnduZmh1Z3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTM5NTAsImV4cCI6MjA5NDMyOTk1MH0.VMjqIlkIG6ZYXVGExQdQTSQPuzUUNDX6NVNaZ6Prxz0";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
  console.log("Querying Supabase Profiles...");
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, active_role')
    .limit(10);

  if (error) {
    console.error("Error fetching profiles:", error);
    process.exit(1);
  }

  console.log("Available profiles:");
  console.log(JSON.stringify(data, null, 2));
}

checkProfiles();
