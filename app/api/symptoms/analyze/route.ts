import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not configured in .env.local");
      return NextResponse.json({
        assessment: {
          condition: "Symptom Assessment (Demo Mode)",
          probability: 60,
          severity: "low",
          description: "API key is missing. Please set GEMINI_API_KEY in your .env.local file to enable dynamic AI predictions.",
          recommendations: [
            "Add GEMINI_API_KEY in .env.local",
            "Restart next.js dev server",
            "Stay hydrated and monitor condition",
            "Consult a registered medical practitioner"
          ],
          urgency: "routine"
        }
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are a licensed clinical triage decision-support AI. 
Analyze the following patient assessment details and return ONLY a valid JSON object (no markdown formatting, no backticks, no extra text):

Patient Details:
- Age: ${body.age || 'Not specified'}
- Gender: ${body.gender || 'Not specified'}
- Primary Concern: ${body.primary_symptom || 'Not specified'}
- Duration: ${body.symptom_duration || 'Not specified'}
- Severity (1-10): ${body.severity || '5'}
- Additional Symptoms: ${Array.isArray(body.additional_symptoms) ? body.additional_symptoms.join(', ') : 'None'}
- Medical History: ${Array.isArray(body.medical_history) ? body.medical_history.join(', ') : 'None'}
- Current Medications: ${body.medications || 'None'}
- Additional Notes: ${body.additional_info || 'None'}

Return format JSON:
{
  "condition": "Specific probable condition name (e.g. Acute Bacterial Pharyngitis, Acid Reflux, Tension Headache)",
  "probability": 75,
  "severity": "low" | "medium" | "high",
  "description": "2-3 crisp sentences explaining clearly what may be happening and why based on their input.",
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3",
    "When to immediately escalate to urgent care/hospital"
  ],
  "urgency": "routine" | "urgent" | "emergency"
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Clean potential markdown blocks
    const cleanedJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanedJson);

    return NextResponse.json({ assessment: parsedData });
  } catch (error: any) {
    console.error("Gemini Route Error:", error);
    return NextResponse.json({
      assessment: {
        condition: "Clinical Review Recommended",
        probability: 65,
        severity: "medium",
        description: "We noted your symptoms. A medical evaluation is recommended to pinpoint the underlying cause.",
        recommendations: [
          "Rest and keep a log of temperature and symptoms",
          "Avoid heavy physical exertion",
          "Maintain proper fluid balance",
          "Consult with a physician if symptoms worsen"
        ],
        urgency: "routine"
      }
    }, { status: 200 });
  }
}
