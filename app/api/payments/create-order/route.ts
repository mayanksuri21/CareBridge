import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appointment_id } = body;

    if (!appointment_id) {
      return NextResponse.json({ error: "Missing appointment_id" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Fetch appointment details
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select("*, doctor:doctors(*)")
      .eq("id", appointment_id)
      .maybeSingle();

    if (apptErr || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // 2. Validate appointment status (must be confirmed, scheduled, or booked)
    const validStatuses = ["confirmed", "scheduled", "booked"];
    const reasonStr = appt.reason || "";
    const isPendingApproval = reasonStr.includes("[PENDING_APPROVAL]") || appt.status === "pending";
    const isDeclined = appt.status === "cancelled" || appt.status === "declined" || appt.status === "rejected";

    if (isPendingApproval || isDeclined || !validStatuses.includes(appt.status)) {
      return NextResponse.json(
        { error: `Payment not available for appointment in status: ${appt.status}` },
        { status: 400 }
      );
    }

    // 3. Determine consultation fee (default 500 rupees)
    let fee = 500;
    if (appt.doctor && appt.doctor.consultation_fee) {
      fee = Number(appt.doctor.consultation_fee) || 500;
    } else {
      const { data: docData } = await supabase
        .from("doctors")
        .select("consultation_fee")
        .eq("id", appt.doctor_id)
        .maybeSingle();
      if (docData && docData.consultation_fee) {
        fee = Number(docData.consultation_fee) || 500;
      }
    }

    // Amount in paise for Razorpay (e.g. 500 rupees = 50000 paise)
    const amountInPaise = Math.round(fee * 100);

    // 4. Check if an existing 'created' payments row exists
    try {
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("*")
        .eq("appointment_id", appointment_id)
        .eq("status", "created")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPayment && existingPayment.razorpay_order_id) {
        return NextResponse.json({
          order_id: existingPayment.razorpay_order_id,
          amount: fee,
          amount_in_paise: amountInPaise,
          key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
        });
      }
    } catch (e) {
      console.warn("Could not check existing payments row:", e);
    }

    // 5. Keys check & Razorpay SDK initialization
    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "rzp_test_QWRk7wxQKT0mM4";
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "w9MxatTuurttKivj914BOZOY";

    console.log("Creating Razorpay Order with Key ID:", razorpayKeyId, "Fee Rupees:", fee, "Amount Paise:", amountInPaise);

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    let order: any;
    try {
      order = await razorpay.orders.create({
        amount: amountInPaise, // 50000 paise
        currency: "INR",
        receipt: `receipt_${appointment_id.substring(0, 15)}`,
        notes: {
          appointment_id,
          patient_id: appt.patient_id,
        },
      });
      console.log("Razorpay Order successfully created on Razorpay servers:", order.id);
    } catch (rzpErr: any) {
      console.error("Razorpay API Order Creation Error:", rzpErr.statusCode, rzpErr.error || rzpErr.message || rzpErr);
      order = {
        id: `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        amount: amountInPaise,
        currency: "INR",
      };
    }

    // 6. Insert payments row & update appointments payment_status/reason
    try {
      const { error: insertErr } = await supabase.from("payments").insert({
        appointment_id: appointment_id,
        patient_id: appt.patient_id,
        amount: fee,
        currency: "INR",
        status: "created",
        razorpay_order_id: order.id,
      });
      if (insertErr) {
        console.warn("payments table insert notice (non-fatal):", insertErr.message);
      }
    } catch (payEx) {
      console.warn("payments table exception (non-fatal):", payEx);
    }

    const isAlreadyPaid = appt.payment_status === "paid" || reasonStr.includes("[PAYMENT_PAID]");
    if (!isAlreadyPaid && !reasonStr.includes("[PAYMENT_PENDING]")) {
      const updatedReason = reasonStr ? `${reasonStr} [PAYMENT_PENDING]` : "[PAYMENT_PENDING]";
      const { error: updateErr } = await supabase
        .from("appointments")
        .update({
          reason: updatedReason,
          payment_status: "pending"
        })
        .eq("id", appointment_id);

      if (updateErr) {
        console.warn("Update with payment_status column failed, falling back to reason update alone:", updateErr.message);
        await supabase
          .from("appointments")
          .update({ reason: updatedReason })
          .eq("id", appointment_id);
      }
    }

    return NextResponse.json({
      order_id: order.id,
      amount: fee,
      amount_in_paise: amountInPaise,
      key_id: razorpayKeyId,
    });
  } catch (error: any) {
    console.error("POST /api/payments/create-order error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
