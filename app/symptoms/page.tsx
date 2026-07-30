"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  Brain,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Phone,
} from "lucide-react"
import Link from "next/link"

interface Question {
  id: string
  type: "multiple-choice" | "checkbox" | "text" | "scale"
  question: string
  options?: string[]
  required: boolean
}

interface Assessment {
  condition: string
  probability: number
  severity: "low" | "medium" | "high"
  description: string
  recommendations: string[]
  urgency: "routine" | "urgent" | "emergency"
}

export default function SymptomsPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [isAssessing, setIsAssessing] = useState(false)
  const [assessment, setAssessment] = useState<Assessment | null>(null)

  const questions: Question[] = [
    {
      id: "age",
      type: "multiple-choice",
      question: "What is your age group?",
      options: ["Under 18", "18-30", "31-50", "51-65", "Over 65"],
      required: true,
    },
    {
      id: "gender",
      type: "multiple-choice",
      question: "What is your gender?",
      options: ["Male", "Female", "Other", "Prefer not to say"],
      required: true,
    },
    {
      id: "primary_symptom",
      type: "multiple-choice",
      question: "What is your main concern today?",
      options: [
        "Fever or chills",
        "Cough or breathing problems",
        "Stomach pain or nausea",
        "Headache or dizziness",
        "Body aches or joint pain",
        "Skin rash or irritation",
        "Other",
      ],
      required: true,
    },
    {
      id: "symptom_duration",
      type: "multiple-choice",
      question: "How long have you been experiencing these symptoms?",
      options: ["Less than 1 day", "1-3 days", "4-7 days", "1-2 weeks", "More than 2 weeks"],
      required: true,
    },
    {
      id: "severity",
      type: "scale",
      question: "On a scale of 1-10, how would you rate your discomfort?",
      required: true,
    },
    {
      id: "additional_symptoms",
      type: "checkbox",
      question: "Are you experiencing any of these additional symptoms?",
      options: [
        "Fever (temperature above 100.4°F)",
        "Difficulty breathing",
        "Chest pain",
        "Severe headache",
        "Vomiting",
        "Diarrhea",
        "Fatigue",
        "Loss of appetite",
      ],
      required: false,
    },
    {
      id: "medical_history",
      type: "checkbox",
      question: "Do you have any of these medical conditions?",
      options: [
        "Diabetes",
        "High blood pressure",
        "Heart disease",
        "Asthma",
        "Kidney disease",
        "Liver disease",
        "Cancer",
        "None of the above",
      ],
      required: false,
    },
    {
      id: "medications",
      type: "text",
      question: "Are you currently taking any medications? (Please list them or write 'None')",
      required: true,
    },
    {
      id: "additional_info",
      type: "text",
      question: "Is there anything else you'd like to mention about your symptoms?",
      required: false,
    },
  ]

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const nextStep = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      performAssessment()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const performAssessment = () => {
    setIsAssessing(true)

    setTimeout(() => {

      const primarySymptom = answers.primary_symptom
      const severity = Number.parseInt(answers.severity) || 5
      const additionalSymptoms = answers.additional_symptoms || []

      let mockAssessment: Assessment

      if (primarySymptom === "Fever or chills" && additionalSymptoms.includes("Difficulty breathing")) {
        mockAssessment = {
          condition: "Possible Respiratory Infection",
          probability: 75,
          severity: "medium",
          description:
            "Based on your symptoms, you may have a respiratory infection. The combination of fever and breathing difficulties requires medical attention.",
          recommendations: [
            "Schedule a consultation with a doctor within 24 hours",
            "Monitor your temperature regularly",
            "Stay hydrated and get plenty of rest",
            "Avoid contact with others to prevent spread",
          ],
          urgency: "urgent",
        }
      } else if (primarySymptom === "Cough or breathing problems") {
        mockAssessment = {
          condition: "Upper Respiratory Symptoms",
          probability: 65,
          severity: "low",
          description:
            "Your symptoms suggest a common upper respiratory condition. Most cases resolve with proper care and rest.",
          recommendations: [
            "Rest and stay hydrated",
            "Consider over-the-counter cough medicine",
            "Use a humidifier or breathe steam",
            "Consult a doctor if symptoms worsen or persist beyond 7 days",
          ],
          urgency: "routine",
        }
      } else if (severity >= 8 || additionalSymptoms.includes("Chest pain")) {
        mockAssessment = {
          condition: "High Severity Symptoms",
          probability: 85,
          severity: "high",
          description:
            "Your symptoms indicate a condition that requires immediate medical attention. Please seek care promptly.",
          recommendations: [
            "Seek immediate medical attention",
            "Contact emergency services if symptoms worsen",
            "Do not delay medical care",
            "Have someone accompany you to the hospital if possible",
          ],
          urgency: "emergency",
        }
      } else {
        mockAssessment = {
          condition: "General Symptoms",
          probability: 50,
          severity: "low",
          description:
            "Your symptoms are common and may resolve with self-care. However, monitor your condition closely.",
          recommendations: [
            "Rest and stay hydrated",
            "Monitor symptoms for changes",
            "Consider over-the-counter remedies as appropriate",
            "Consult a doctor if symptoms persist or worsen",
          ],
          urgency: "routine",
        }
      }

      setAssessment(mockAssessment)
      setIsAssessing(false)
    }, 3000)
  }

  const resetAssessment = () => {
    setCurrentStep(0)
    setAnswers({})
    setAssessment(null)
    setIsAssessing(false)
  }

  if (isAssessing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Brain className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold">Analyzing Your Symptoms</h3>
              <p className="text-muted-foreground">
                Our AI is processing your information to provide personalized health insights...
              </p>
              <Progress value={66} className="w-full" />
              <p className="text-sm text-muted-foreground">This may take a few moments</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (assessment) {
    return (
      <div className="min-h-screen bg-background">
        
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <Brain className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-bold text-foreground">Assessment Results</h1>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            
            <Card
              className={`border-l-4 ${
                assessment.urgency === "emergency"
                  ? "border-l-red-500"
                  : assessment.urgency === "urgent"
                    ? "border-l-amber-500"
                    : "border-l-green-500"
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        assessment.urgency === "emergency"
                          ? "bg-red-100"
                          : assessment.urgency === "urgent"
                            ? "bg-amber-100"
                            : "bg-green-100"
                      }`}
                    >
                      {assessment.urgency === "emergency" ? (
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                      ) : assessment.urgency === "urgent" ? (
                        <Clock className="w-6 h-6 text-amber-600" />
                      ) : (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{assessment.condition}</CardTitle>
                      <CardDescription>Confidence: {assessment.probability}%</CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={
                      assessment.urgency === "emergency"
                        ? "destructive"
                        : assessment.urgency === "urgent"
                          ? "outline"
                          : "secondary"
                    }
                    className={assessment.urgency === "urgent" ? "border-amber-500 text-amber-700" : ""}
                  >
                    {assessment.urgency.charAt(0).toUpperCase() + assessment.urgency.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{assessment.description}</p>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Recommended Actions:</h4>
                    <ul className="space-y-2">
                      {assessment.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">Book Consultation</h3>
                    <p className="text-sm text-muted-foreground">Schedule a video call with a doctor</p>
                    <Link href="/consultation">
                      <Button className="w-full">Book Now</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto">
                      <Activity className="w-6 h-6 text-secondary" />
                    </div>
                    <h3 className="font-semibold">Track Symptoms</h3>
                    <p className="text-sm text-muted-foreground">Monitor your condition over time</p>
                    <Button variant="outline" className="w-full bg-transparent">
                      Start Tracking
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                      <Brain className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="font-semibold">New Assessment</h3>
                    <p className="text-sm text-muted-foreground">Start another symptom check</p>
                    <Button variant="outline" onClick={resetAssessment} className="w-full bg-transparent">
                      Start Over
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {assessment.urgency === "emergency" && (
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-800 mb-1">Emergency Situation</h3>
                      <p className="text-sm text-red-700 mb-3">
                        Your symptoms require immediate medical attention. Please contact emergency services or visit
                        the nearest hospital.
                      </p>
                      <div className="flex space-x-2">
                        <Button variant="destructive" size="sm">
                          <Phone className="w-4 h-4 mr-2" />
                          Call 108 (Emergency)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-800 hover:bg-red-100 bg-transparent"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Nabha Hospital: +91 98765 00000
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <h4 className="font-semibold text-foreground">Important Disclaimer</h4>
                  <p className="text-sm text-muted-foreground">
                    This AI assessment is for informational purposes only and should not replace professional medical
                    advice. Always consult with qualified healthcare providers for proper diagnosis and treatment.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentStep]
  const progress = ((currentStep + 1) / questions.length) * 100

  return (
    <div className="min-h-screen bg-background">
      
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">AI Symptom Checker</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Question {currentStep + 1} of {questions.length}
              </span>
              <span className="text-sm text-muted-foreground">{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{currentQuestion.question}</CardTitle>
              {currentQuestion.required && <CardDescription>This question is required</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              
              {currentQuestion.type === "multiple-choice" && (
                <RadioGroup
                  value={answers[currentQuestion.id] || ""}
                  onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
                >
                  {currentQuestion.options?.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={option} />
                      <Label htmlFor={option} className="cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {currentQuestion.type === "checkbox" && (
                <div className="space-y-3">
                  {currentQuestion.options?.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={option}
                        checked={(answers[currentQuestion.id] || []).includes(option)}
                        onCheckedChange={(checked) => {
                          const current = answers[currentQuestion.id] || []
                          if (checked) {
                            handleAnswer(currentQuestion.id, [...current, option])
                          } else {
                            handleAnswer(
                              currentQuestion.id,
                              current.filter((item: string) => item !== option),
                            )
                          }
                        }}
                      />
                      <Label htmlFor={option} className="cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              )}

              {currentQuestion.type === "text" && (
                <Textarea
                  placeholder="Please provide details..."
                  value={answers[currentQuestion.id] || ""}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  className="min-h-[100px]"
                />
              )}

              {currentQuestion.type === "scale" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>1 - Mild</span>
                    <span>10 - Severe</span>
                  </div>
                  <div className="grid grid-cols-10 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <Button
                        key={num}
                        variant={answers[currentQuestion.id] === num.toString() ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleAnswer(currentQuestion.id, num.toString())}
                        className="aspect-square"
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between mt-8">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 0} className="bg-transparent">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={nextStep}
              disabled={
                currentQuestion.required &&
                (!answers[currentQuestion.id] ||
                  (Array.isArray(answers[currentQuestion.id]) && answers[currentQuestion.id].length === 0))
              }
            >
              {currentStep === questions.length - 1 ? "Get Assessment" : "Next"}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
