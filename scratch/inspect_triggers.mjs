import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const [k, v] = line.split("=");
  if (k && v) env[k.trim()] = v.trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  // Query Supabase RPC or system tables if accessible
  const { data, error } = await supabase.rpc('get_triggers');
  if (error) {
    console.log("RPC get_triggers error:", error.message);
  } else {
    console.log("Triggers:", data);
  }
}

run();
