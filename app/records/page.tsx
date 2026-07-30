"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  FileText,
  Download,
  Search,
  Calendar,
  User,
  Stethoscope,
  Pill,
  Activity,
  Heart,
  Thermometer,
  Weight,
  Eye,
  EyeOff,
} from "lucide-react"
import Link from "next/link"

export default function HealthRecordsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false)

  const consultationRecords = [
    {
      id: "1",
      date: "2024-01-15",
      doctor: "Dr. Rajesh Kumar",
      specialty: "General Medicine",
      diagnosis: "Common Cold",
      prescription: "Paracetamol 500mg, Rest",
      notes: "Patient reported fever and cough. Advised rest and hydration.",
      status: "completed",
    },
    {
      id: "2",
      date: "2024-01-08",
      doctor: "Dr. Priya Sharma",
      specialty: "Pediatrics",
      diagnosis: "Routine Checkup",
      prescription: "Vitamin D supplements",
      notes: "Regular health checkup. All vitals normal.",
      status: "completed",
    },
    {
      id: "3",
      date: "2024-01-02",
      doctor: "Dr. Sunita Kaur",
      specialty: "Gynecology",
      diagnosis: "Hypertension Follow-up",
      prescription: "Amlodipine 5mg daily",
      notes: "Blood pressure monitoring required. Follow-up in 2 weeks.",
      status: "follow-up-required",
    },
  ]

  const labResults = [
    {
      id: "1",
      date: "2024-01-10",
      testName: "Complete Blood Count (CBC)",
      results: {
        hemoglobin: "12.5 g/dL",
        wbc: "7,200/μL",
        platelets: "250,000/μL",
      },
      status: "normal",
      doctor: "Dr. Rajesh Kumar",
    },
    {
      id: "2",
      date: "2024-01-05",
      testName: "Blood Sugar (Fasting)",
      results: {
        glucose: "95 mg/dL",
      },
      status: "normal",
      doctor: "Dr. Sunita Kaur",
    },
    {
      id: "3",
      date: "2023-12-20",
      testName: "Lipid Profile",
      results: {
        cholesterol: "180 mg/dL",
        hdl: "45 mg/dL",
        ldl: "120 mg/dL",
        triglycerides: "150 mg/dL",
      },
      status: "borderline",
      doctor: "Dr. Rajesh Kumar",
    },
  ]

  const vitalSigns = [
    { date: "2024-01-15", bp: "120/80", pulse: "72", temp: "98.6°F", weight: "65 kg", height: "165 cm" },
    { date: "2024-01-08", bp: "118/78", pulse: "70", temp: "98.4°F", weight: "64.5 kg", height: "165 cm" },
    { date: "2024-01-02", bp: "125/82", pulse: "75", temp: "98.7°F", weight: "65.2 kg", height: "165 cm" },
  ]

  const prescriptions = [
    {
      id: "1",
      date: "2024-01-15",
      doctor: "Dr. Rajesh Kumar",
      medications: [
        { name: "Paracetamol", dosage: "500mg", frequency: "3 times daily", duration: "5 days" },
        { name: "Cough Syrup", dosage: "10ml", frequency: "2 times daily", duration: "7 days" },
      ],
      status: "active",
    },
    {
      id: "2",
      date: "2024-01-02",
      doctor: "Dr. Sunita Kaur",
      medications: [{ name: "Amlodipine", dosage: "5mg", frequency: "Once daily", duration: "30 days" }],
      status: "active",
    },
    {
      id: "3",
      date: "2023-12-15",
      doctor: "Dr. Priya Sharma",
      medications: [{ name: "Vitamin D3", dosage: "1000 IU", frequency: "Once daily", duration: "90 days" }],
      status: "completed",
    },
  ]

  const filteredConsultations = consultationRecords.filter(
    (record) =>
      record.doctor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.specialty.toLowerCase().includes(searchTerm.toLowerCase()),
  )

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
              <FileText className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Health Records</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{showSensitiveInfo ? "Rajesh Singh" : "R***h S***h"}</CardTitle>
                    <CardDescription className="text-base">
                      Patient ID: {showSensitiveInfo ? "HC001234" : "HC***234"} | Age: 35 | Male
                    </CardDescription>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                      <span>Village: Nabha</span>
                      <span>Phone: {showSensitiveInfo ? "+91 98765 43210" : "+91 ***65 ***10"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
                    className="flex items-center space-x-2"
                  >
                    {showSensitiveInfo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span>{showSensitiveInfo ? "Hide" : "Show"} Details</span>
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export Records
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search records by doctor, diagnosis, or specialty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Tabs defaultValue="consultations" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="consultations" className="flex items-center space-x-2">
                <Stethoscope className="w-4 h-4" />
                <span>Consultations</span>
              </TabsTrigger>
              <TabsTrigger value="lab-results" className="flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Lab Results</span>
              </TabsTrigger>
              <TabsTrigger value="prescriptions" className="flex items-center space-x-2">
                <Pill className="w-4 h-4" />
                <span>Prescriptions</span>
              </TabsTrigger>
              <TabsTrigger value="vitals" className="flex items-center space-x-2">
                <Heart className="w-4 h-4" />
                <span>Vital Signs</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="consultations" className="space-y-4">
              {filteredConsultations.map((record) => (
                <Card key={record.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Stethoscope className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{record.diagnosis}</CardTitle>
                          <CardDescription>
                            {record.doctor} • {record.specialty}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center text-sm text-muted-foreground mb-1">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(record.date).toLocaleDateString()}
                        </div>
                        <Badge
                          variant={record.status === "completed" ? "secondary" : "outline"}
                          className={record.status === "follow-up-required" ? "border-amber-500 text-amber-700" : ""}
                        >
                          {record.status === "completed" ? "Completed" : "Follow-up Required"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Prescription</h4>
                        <p className="text-sm text-muted-foreground">{record.prescription}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground">{record.notes}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="lab-results" className="space-y-4">
              {labResults.map((result) => (
                <Card key={result.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
                          <Activity className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{result.testName}</CardTitle>
                          <CardDescription>Ordered by {result.doctor}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center text-sm text-muted-foreground mb-1">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(result.date).toLocaleDateString()}
                        </div>
                        <Badge
                          variant={result.status === "normal" ? "secondary" : "outline"}
                          className={
                            result.status === "borderline"
                              ? "border-amber-500 text-amber-700"
                              : result.status === "abnormal"
                                ? "border-red-500 text-red-700"
                                : ""
                          }
                        >
                          {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(result.results).map(([key, value]) => (
                        <div key={key} className="text-center p-3 bg-muted/30 rounded-lg">
                          <div className="text-sm font-medium text-foreground capitalize">
                            {key.replace(/([A-Z])/g, " $1")}
                          </div>
                          <div className="text-lg font-bold text-primary mt-1">{value}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="prescriptions" className="space-y-4">
              {prescriptions.map((prescription) => (
                <Card key={prescription.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                          <Pill className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Prescription</CardTitle>
                          <CardDescription>Prescribed by {prescription.doctor}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center text-sm text-muted-foreground mb-1">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(prescription.date).toLocaleDateString()}
                        </div>
                        <Badge variant={prescription.status === "active" ? "secondary" : "outline"}>
                          {prescription.status.charAt(0).toUpperCase() + prescription.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {prescription.medications.map((med, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div>
                            <div className="font-medium text-foreground">{med.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {med.dosage} • {med.frequency}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">{med.duration}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="vitals" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vitalSigns.map((vital, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center">
                          <Heart className="w-5 h-5 text-primary mr-2" />
                          Vital Signs
                        </CardTitle>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(vital.date).toLocaleDateString()}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Heart className="w-4 h-4 text-red-500" />
                            <span className="text-sm">Blood Pressure</span>
                          </div>
                          <span className="font-medium">{vital.bp} mmHg</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Activity className="w-4 h-4 text-blue-500" />
                            <span className="text-sm">Pulse</span>
                          </div>
                          <span className="font-medium">{vital.pulse} bpm</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Thermometer className="w-4 h-4 text-orange-500" />
                            <span className="text-sm">Temperature</span>
                          </div>
                          <span className="font-medium">{vital.temp}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Weight className="w-4 h-4 text-green-500" />
                            <span className="text-sm">Weight</span>
                          </div>
                          <span className="font-medium">{vital.weight}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
