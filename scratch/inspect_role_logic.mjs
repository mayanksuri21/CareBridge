import fs from "fs";

const content = fs.readFileSync("app/consultation/[appointmentId]/page.tsx", "utf8");
const lines = content.split("\n");

console.log("=== ROLE & LOADING LOGIC IN CONSULTATION PAGE ===");
lines.forEach((line, index) => {
  const lineNum = index + 1;
  if (
    line.includes("setLoadingUser") ||
    line.includes("setLoadingAppt") ||
    line.includes("isDoctor") ||
    line.includes("userRole") ||
    line.includes("fetchUserAndRole") ||
    line.includes("loadAppointment")
  ) {
    console.log(`Line ${lineNum}: ${line.trim()}`);
  }
});
