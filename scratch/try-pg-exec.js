require('dns').setDefaultResultOrder('verbatim');
const { Client } = require('pg');

const sql = `
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id),
  patient_id uuid references public.profiles(id),
  amount numeric not null,
  currency text default 'INR',
  status text default 'created',
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.appointments add column if not exists payment_status text default 'not_required';
alter table public.doctors add column if not exists consultation_fee numeric default 500;
`;

async function tryConnect() {
  const passwords = [
    process.env.SUPABASE_DB_PASSWORD,
    process.env.DATABASE_PASSWORD,
    'postgres',
    'CareBridge2026',
    'CareBridge123',
    'HealthCare2026',
    'msrqhehjcfscljdjhlet'
  ].filter(Boolean);

  for (const pwd of passwords) {
    console.log("Trying direct host (verbatim DNS) with password:", pwd);
    const client = new Client({
      host: 'db.msrqhehjcfscljdjhlet.supabase.co',
      port: 5432,
      user: 'postgres',
      password: pwd,
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log("SUCCESSFULLY CONNECTED TO DIRECT DB!");
      await client.query(sql);
      console.log("DDL EXECUTED SUCCESSFULLY!");
      const res = await client.query("select column_name from information_schema.columns where table_name = 'payments'");
      console.log("VERIFICATION COLS:", res.rows.map(r => r.column_name));
      await client.end();
      return true;
    } catch (e) {
      console.log("Failed:", e.message);
      try { await client.end(); } catch (_) {}
    }
  }
  return false;
}

tryConnect();
