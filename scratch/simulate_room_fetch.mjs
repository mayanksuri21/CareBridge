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
  const doctorId = "aa525a34-507a-4091-83fa-8e183f0d4c23";

  // Get latest appointment
  const { data: appt, error: aErr } = await supabase
    .from("appointments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  console.log("=== LATEST APPOINTMENT ===");
  console.log("Appointment ID:", appt?.id);
  console.log("Appointment doctor_id:", appt?.doctor_id);
  console.log("Doctor ID to match:", doctorId);
  console.log("Does doctor_id match?:", appt?.doctor_id === doctorId);
  console.log("Appointment status:", appt?.status);
  console.log("Appointment reason:", appt?.reason);

  // Get doctor profile
  const { data: prof, error: pErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", doctorId)
    .single();

  console.log("=== DOCTOR PROFILE ===");
  console.log("profiles.role:", prof?.role);

  // Simulate room isDoctor calculation:
  const isDoctorById = Boolean(doctorId && appt && appt.doctor_id && doctorId === appt.doctor_id);
  const isDoctorRole = prof?.role === 'doctor';
  const isDoctor = Boolean(isDoctorById || isDoctorRole);

  console.log("=== SIMULATED ISDOCTOR CALCULATION ===");
  console.log({ isDoctorById, isDoctorRole, isDoctor });
}

run();
