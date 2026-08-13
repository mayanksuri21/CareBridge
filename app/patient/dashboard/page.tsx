"use client"

import Link from "next/link"
import { Activity, ArrowRight, CalendarDays, FileText, Stethoscope } from "lucide-react"

import { PatientPrescriptionsSection } from "@/components/patient/prescriptions-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PrintablePrescription } from "@/lib/generate-prescription-pdf"

const demoPrescriptions: PrintablePrescription[] = [
  {
    id: "RX-CB-2026-9921",
    created_at: "2026-08-13T09:30:00.000Z",
    doctor_name: "Dr. Sarah Jenkins, M.D.",
    diagnosis: "High fever, cough, and fatigue",
    medicines: [
      { name: "Paracetamol", dosage: "500 mg", frequency: "1-0-1", duration: "3 days" },
      { name: "Cetirizine", dosage: "10 mg", frequency: "0-0-1", duration: "5 days" },
    ],
    advice: "Stay hydrated, rest, and arrange a follow-up if symptoms persist.",
  },
]

export default function PatientDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div>
            <Link href="/" className="text-sm font-medium text-teal-400 hover:text-teal-300">CareBridge</Link>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back, Alex</h1>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-slate-200 hover:bg-slate-800 hover:text-white">
              <Link href="/patient/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" className="text-slate-200 hover:bg-slate-800 hover:text-white">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild className="bg-teal-600 hover:bg-teal-500">
              <Link href="/consultation/book">Book a Doctor</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="records" className="space-y-6">
          <TabsList className="h-auto w-full justify-start gap-2 bg-slate-900 p-2 sm:w-fit">
            <TabsTrigger value="records" className="gap-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              <FileText className="size-4" />Medical Records & Prescriptions
            </TabsTrigger>
            <TabsTrigger value="care" className="gap-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              <Activity className="size-4" />Find Care
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-4">
            <Card className="border-slate-800 bg-slate-900/60 text-white">
              <CardHeader>
                <CardTitle>My Prescriptions & Records</CardTitle>
                <CardDescription className="text-slate-400">Your latest digital prescriptions are ready for download and pharmacy use.</CardDescription>
              </CardHeader>
            </Card>
            <PatientPrescriptionsSection fallbackPrescriptions={demoPrescriptions} />
          </TabsContent>

          <TabsContent value="care" className="grid gap-4 md:grid-cols-2">
            <Card className="border-slate-800 bg-slate-900/60 text-white">
              <CardHeader>
                <Activity className="size-6 text-teal-400" />
                <CardTitle className="mt-3">AI Symptom Checker</CardTitle>
                <CardDescription className="text-slate-400">Describe how you feel and get structured guidance before your next consultation.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-teal-600 hover:bg-teal-500"><Link href="/symptoms">Start symptom check <ArrowRight /></Link></Button>
              </CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/60 text-white">
              <CardHeader>
                <Stethoscope className="size-6 text-sky-400" />
                <CardTitle className="mt-3">Find a Doctor</CardTitle>
                <CardDescription className="text-slate-400">Browse available specialists and book a convenient consultation time.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="border-slate-700 bg-transparent text-white hover:bg-slate-800 hover:text-white"><Link href="/consultation/book">Book consultation <CalendarDays /></Link></Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
