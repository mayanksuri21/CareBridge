"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
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

const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export default function SymptomsPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [isAssessing, setIsAssessing] = useState(false)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  
  // History log tracking states
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const loadHistory = () => {
    try {
      const cached = localStorage.getItem("patient_symptom_history")
      if (cached) {
        setHistory(JSON.parse(cached))
      } else {
        setHistory([])
      }
    } catch (_) {
      setHistory([])
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

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
        "None of the above",
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

  const performAssessment = async () => {
    setIsAssessing(true)

    try {
      const res = await fetch("/api/symptoms/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      })
      if (!res.ok) throw new Error("AI assessment failed")
      const payload = await res.json()
      const mockAssessment = payload.assessment

      setAssessment(mockAssessment)

      // Save assessments with timestamp into localStorage
      try {
        const cached = localStorage.getItem("patient_symptom_history")
        let historyList = []
        if (cached) {
          historyList = JSON.parse(cached)
          if (!Array.isArray(historyList)) historyList = []
        }
        historyList.unshift({
          condition: mockAssessment.condition,
          urgency: mockAssessment.urgency,
          description: mockAssessment.description,
          timestamp: new Date().toISOString()
        })
        localStorage.setItem("patient_symptom_history", JSON.stringify(historyList))
        loadHistory() // Sync local list
      } catch (err) {
        console.error("Failed to save assessment to history log:", err)
      }
    } catch (err: any) {
      console.error(err)
      // Fallback in case of endpoint error
      const fallbackAssessment: Assessment = {
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
      setAssessment(fallbackAssessment)
    } finally {
      setIsAssessing(false)
    }
  }

  const resetAssessment = () => {
    setCurrentStep(0)
    setAnswers({})
    setAssessment(null)
    setIsAssessing(false)
    setShowHistory(false)
  }

  const isNextDisabled = () => {
    const currentQuestion = questions[currentStep]
    if (!currentQuestion.required) return false

    const val = answers[currentQuestion.id]
    if (val === undefined || val === null) return true
    if (typeof val === "string" && val.trim() === "") return true
    if (Array.isArray(val) && val.length === 0) return true

    // Require description text if Question 3 "Other" symptom is chosen
    if (currentQuestion.id === "primary_symptom" && val === "Other") {
      const otherVal = answers.primary_symptom_other
      if (!otherVal || typeof otherVal !== "string" || otherVal.trim() === "") return true
    }

    return false
  }

  if (isAssessing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Brain className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold">Analyzing Your Symptoms</h3>
              <p className="text-muted-foreground text-sm">
                Our AI is processing your information to provide personalized health insights...
              </p>
              <Progress value={66} className="w-full" />
              <p className="text-xs text-muted-foreground">This may take a few moments</p>
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
              className={`border-l-4 ${assessment.urgency === "emergency"
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
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${assessment.urgency === "emergency"
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
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">Book Consultation</h3>
                    <p className="text-sm text-muted-foreground">Schedule a video call with a doctor</p>
                    <Link href="/consultation" className="block w-full">
                      <Button className="w-full">Book Now</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto">
                      <Activity className="w-6 h-6 text-secondary" />
                    </div>
                    <h3 className="font-semibold">Track Symptoms</h3>
                    <p className="text-sm text-muted-foreground">Monitor your condition over time</p>
                    <Button
                      variant="outline"
                      className="w-full bg-transparent font-medium"
                      onClick={() => {
                        loadHistory()
                        setShowHistory(!showHistory)
                      }}
                    >
                      {showHistory ? "Hide History Log" : "Track Symptoms"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
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

            {/* Assessment History Log Section */}
            {showHistory && (
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-500" />
                    Symptom Checker History Log
                  </CardTitle>
                  <CardDescription>
                    Your past symptom assessments saved locally on this device.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assessment history found.</p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                      {history.map((entry: any, index: number) => (
                        <div key={index} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{new Date(entry.timestamp).toLocaleString()}</span>
                            <Badge variant="outline" className="capitalize text-[10px]">
                              {entry.urgency}
                            </Badge>
                          </div>
                          <span className="text-sm font-semibold text-foreground">{entry.condition}</span>
                          <p className="text-xs text-muted-foreground line-clamp-2">{entry.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="w-full text-xs">
                    Close History Log
                  </Button>
                </CardContent>
              </Card>
            )}

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
                      <div className="flex flex-wrap gap-2">
                        <Button variant="destructive" size="sm" asChild>
                          <a href="tel:108">
                            <Phone className="w-4 h-4 mr-2" />
                            Call 108 (Emergency)
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-800 hover:bg-red-100 bg-transparent"
                          asChild
                        >
                          <a href="tel:+919876500000">
                            <Phone className="w-4 h-4 mr-2" />
                            Local Care Center: +91 98765 00000
                          </a>
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
                <div className="grid gap-3">
                  {currentQuestion.options?.map((option) => {
                    const isSelected = answers[currentQuestion.id] === option
                    return (
                      <div
                        key={option}
                        onClick={() => handleAnswer(currentQuestion.id, option)}
                        className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-950/40 text-emerald-300"
                            : "border-border hover:bg-muted/40 text-foreground"
                        }`}
                      >
                        <span className="text-sm font-medium">{option}</span>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                        )}
                      </div>
                    )
                  })}

                  {/* Render conditional description area for "Other" option in Question 3 */}
                  {currentQuestion.id === "primary_symptom" && answers[currentQuestion.id] === "Other" && (
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="other_details" className="text-xs font-semibold text-muted-foreground">
                        Please describe your specific symptoms in detail
                      </Label>
                      <Textarea
                        id="other_details"
                        placeholder="Please describe your specific symptoms in detail..."
                        value={answers.primary_symptom_other || ""}
                        onChange={(e) => handleAnswer("primary_symptom_other", e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>
                  )}
                </div>
              )}

              {currentQuestion.type === "checkbox" && (
                <div className="grid gap-3">
                  {currentQuestion.options?.map((option) => {
                    const selectedList = answers[currentQuestion.id] || []
                    const isSelected = selectedList.includes(option)
                    return (
                      <div
                        key={option}
                        onClick={() => {
                          let nextList
                          if (isSelected) {
                            nextList = selectedList.filter((item: string) => item !== option)
                          } else {
                            if (option === "None of the above") {
                              nextList = [option]
                            } else {
                              nextList = [
                                ...selectedList.filter((item: string) => item !== "None of the above"),
                                option,
                              ]
                            }
                          }
                          handleAnswer(currentQuestion.id, nextList)
                        }}
                        className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-950/40 text-emerald-300"
                            : "border-border hover:bg-muted/40 text-foreground"
                        }`}
                      >
                        <span className="text-sm font-medium">{option}</span>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                        )}
                      </div>
                    )
                  })}
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
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <Button
                        key={num}
                        type="button"
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
            <Button onClick={nextStep} disabled={isNextDisabled()}>
              {currentStep === questions.length - 1 ? "Get Assessment" : "Next"}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}