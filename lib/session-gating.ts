export function getSessionPhase(
  startTimeISO: string,
  paymentStatus: string
): 'not_yet' | 'payment_open' | 'ready' | 'expired' {
  const start = new Date(startTimeISO).getTime();
  const now = Date.now();
  const windowOpen = start - 15 * 60 * 1000;

  if (now < windowOpen) return 'not_yet';
  if (now >= start) {
    return paymentStatus === 'paid' ? 'ready' : 'expired';
  }
  return paymentStatus === 'paid' ? 'ready' : 'payment_open';
}

/**
 * Helper to extract an ISO start time string from various appointment formats.
 */
export function getAppointmentStartTimeISO(appt: any): string | null {
  if (!appt) return null;

  if (appt.schedule_slots?.start_time) {
    return new Date(appt.schedule_slots.start_time).toISOString();
  }
  if (appt.scheduled_at) {
    return new Date(appt.scheduled_at).toISOString();
  }

  const dStr = appt.appointment_date || appt.scheduled_date || appt.date || '';
  const tStr = appt.time_slot || appt.scheduled_time || appt.time || '';
  if (!dStr) return null;

  try {
    let parsedDate: Date | null = null;
    if (dStr.includes('-')) {
      const parts = dStr.split('-');
      if (parts[0].length === 4) {
        parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        parsedDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    } else if (dStr.includes('/')) {
      const parts = dStr.split('/');
      if (parts[2]?.length === 4) {
        parsedDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }

    if (parsedDate && !isNaN(parsedDate.getTime())) {
      let hours = 12, minutes = 0;
      if (tStr) {
        const timeParts = tStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeParts) {
          hours = parseInt(timeParts[1], 10);
          minutes = parseInt(timeParts[2], 10);
          const ampm = timeParts[3].toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        }
      }
      const scheduledDateTime = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), hours, minutes, 0, 0);
      return scheduledDateTime.toISOString();
    }
  } catch (e) {
    console.error("Error parsing appointment start time:", e);
  }

  return null;
}
