const Razorpay = require('razorpay');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

console.log("=== CHECKING RAZORPAY KEYS ===");
console.log("RAZORPAY_KEY_ID:", env.RAZORPAY_KEY_ID);
console.log("RAZORPAY_KEY_SECRET:", env.RAZORPAY_KEY_SECRET);
console.log("NEXT_PUBLIC_RAZORPAY_KEY_ID:", env.NEXT_PUBLIC_RAZORPAY_KEY_ID);

const rzp = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

async function run() {
  try {
    const order = await rzp.orders.create({
      amount: 50000,
      currency: "INR",
      receipt: "receipt_1"
    });
    console.log("Order created successfully:", order);
  } catch (err) {
    console.error("Order creation failed error object:", JSON.stringify(err, null, 2));
  }
}

run();
