"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Application = { id: string; full_name: string; email: string | null; phone: string; date_of_birth: string; specialization: string; qualification: string; college_or_university: string; graduation_year: number; years_of_experience: number; current_hospital_or_clinic: string | null; professional_bio: string | null; address: string; city: string; state: string; registration_number: string; registration_authority: string; registration_date: string; status: "pending" | "approved" | "rejected"; submitted_at: string }
type VerificationDocument = { application_id: string; file_path: string; file_name: string; document_type: string }

export default function AdminDoctorVerificationsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [documents, setDocuments] = useState<VerificationDocument[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    const { data: isAdmin } = await supabase.rpc("is_verification_admin")
    if (!isAdmin) { router.replace("/"); return }
    const [{ data, error }, { data: documentData, error: documentError }] = await Promise.all([
      supabase.from("doctor_verification_applications").select("id, full_name, email, phone, date_of_birth, specialization, qualification, college_or_university, graduation_year, years_of_experience, current_hospital_or_clinic, professional_bio, address, city, state, registration_number, registration_authority, registration_date, status, submitted_at").eq("status", "pending").order("submitted_at", { ascending: true }),
      supabase.from("doctor_verification_documents").select("application_id, file_path, file_name, document_type"),
    ])
    if (error || documentError) setMessage(error?.message || documentError?.message || "Could not load applications")
    else { setApplications((data || []) as Application[]); setDocuments((documentData || []) as VerificationDocument[]) }
  }

  useEffect(() => { void load() }, [])
  const review = async (application: Application, status: "approved" | "rejected") => {
    const rejection_reason = reasons[application.id]?.trim() || null
    if (status === "rejected" && !rejection_reason) { setMessage("A rejection reason is required."); return }
    const { error } = await supabase.from("doctor_verification_applications").update({ status, rejection_reason }).eq("id", application.id)
    if (error) { setMessage(error.message); return }
    setMessage(`Application ${status}.`); await load()
  }
  const openDocument = async (path: string) => {
    const { data, error } = await supabase.storage.from("doctor-verification-documents").createSignedUrl(path, 60)
    if (error || !data?.signedUrl) { setMessage(error?.message || "Could not open document"); return }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  return <main className="container mx-auto max-w-5xl px-4 py-10"><h1 className="mb-6 text-2xl font-bold">Doctor verification review</h1>{message && <p className="mb-4 text-sm">{message}</p>}<div className="space-y-4">{applications.map((app) => <Card key={app.id}><CardHeader><CardTitle className="flex justify-between gap-4 text-lg"><span>{app.full_name} — {app.specialization}</span><span className="capitalize">{app.status}</span></CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-1 text-sm text-muted-foreground md:grid-cols-2"><p>Email: {app.email || "Not supplied"}</p><p>Phone: {app.phone}</p><p>Registration: {app.registration_number} ({app.registration_authority}), {app.registration_date}</p><p>Qualification: {app.qualification}, {app.college_or_university} ({app.graduation_year})</p><p>Experience: {app.years_of_experience} years</p><p>Practice: {app.current_hospital_or_clinic || "Not supplied"}</p><p>Address: {app.address}, {app.city}, {app.state}</p><p>Date of birth: {app.date_of_birth}</p><p className="md:col-span-2">Professional bio: {app.professional_bio || "Not supplied"}</p></div><p className="text-sm text-muted-foreground">Submitted {new Date(app.submitted_at).toLocaleString()}</p><div className="flex flex-wrap gap-2">{documents.filter((document) => document.application_id === app.id).map((document) => <Button key={document.file_path} variant="outline" size="sm" onClick={() => openDocument(document.file_path)}>View {document.document_type}: {document.file_name}</Button>)}</div>{app.status === "pending" && <><div className="space-y-2"><Label>Rejection reason (required only if rejecting)</Label><Input value={reasons[app.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [app.id]: event.target.value }))} /></div><div className="flex gap-2"><Button onClick={() => review(app, "approved")}>Approve</Button><Button variant="destructive" onClick={() => review(app, "rejected")}>Reject</Button></div></>}</CardContent></Card>)}</div></main>
}
