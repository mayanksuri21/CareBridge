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
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, phone");

  console.log("=== ALL PROFILES ===");
  console.log(profiles);

  const { data: usersData, error: uErr } = await supabase.auth.admin.listUsers();
  console.log("=== ALL AUTH USERS ===");
  if (usersData?.users) {
    usersData.users.forEach(u => {
      console.log({
        id: u.id,
        email: u.email,
        meta_role: u.user_metadata?.role,
        created_at: u.created_at
      });
    });
  }
}

run();
