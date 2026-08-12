"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Clock3, FileText, XCircle } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type Application = { id: string; status: "pending" | "approved" | "rejected"; rejection_reason: string | null; submitted_at: string; full_name: string; specialization: string; qualification: string; registration_number: string }

const initialForm = {
  full_name: "", date_of_birth: "", gender: "", phone: "", address: "", city: "", state: "",
  qualification: "", specialization: "", college_or_university: "", graduation_year: "", years_of_experience: "",
  current_hospital_or_clinic: "", professional_bio: "", registration_number: "", registration_authority: "", registration_date: "",
}

export default function DoctorVerificationPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [application, setApplication] = useState<Application | null>(null)
  const [files, setFiles] = useState<FileList | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }
      const [{ data: profile }, { data: existing }] = await Promise.all([
        supabase.from("profiles").select("name, phone, address, specialty, role").eq("id", user.id).single(),
        supabase.from("doctor_verification_applications").select("*").eq("doctor_id", user.id).maybeSingle(),
      ])
      if (profile?.role !== "doctor") { router.replace("/"); return }
      const savedDraft = sessionStorage.getItem("carebridge_doctor_draft")
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft) as Partial<typeof initialForm> & { about?: string }
          setForm((current) => ({ ...current, ...draft, professional_bio: draft.about || current.professional_bio }))
        } catch { /* invalid local draft */ }
      }
      setForm((current) => ({ ...current, full_name: profile.name || current.full_name, phone: profile.phone || current.phone, address: profile.address || current.address, specialization: profile.specialty || current.specialization }))
      if (existing) {
        if (existing.status === "pending") { router.replace("/doctor/verification-pending"); return }
        if (existing.status === "rejected") { router.replace("/doctor/verification-rejected"); return }
        if (existing.status === "approved") { router.replace("/doctor/dashboard"); return }
        setForm((current) => ({ ...current, full_name: existing.full_name, date_of_birth: existing.date_of_birth, phone: existing.phone, address: existing.address, city: existing.city, state: existing.state, qualification: existing.qualification, specialization: existing.specialization, college_or_university: existing.college_or_university, graduation_year: String(existing.graduation_year), years_of_experience: String(existing.years_of_experience), current_hospital_or_clinic: existing.current_hospital_or_clinic || "", registration_number: existing.registration_number, registration_authority: existing.registration_authority, registration_date: existing.registration_date }))
      }
      setApplication(existing as Application | null)
      setLoading(false)
    }
    load()
  }, [router, supabase])

  const set = (key: keyof typeof initialForm, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!files || files.length < 3) { setMessage("Upload your licence, qualification certificate, and government ID before submitting."); return }
    setSaving(true); setMessage(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace("/login"); return }
    const payload = { ...form, medical_college: form.college_or_university, medical_license_number: form.registration_number, registration_council: form.registration_authority, clinic_hospital_name: form.current_hospital_or_clinic, clinic_hospital_address: form.address, email: user.email || null, doctor_id: user.id, status: "pending", rejection_reason: null, reviewed_by: null, reviewed_at: null, submitted_at: new Date().toISOString(), graduation_year: Number(form.graduation_year), years_of_experience: Number(form.years_of_experience) }
    const { data: created, error } = await supabase.from("doctor_verification_applications").upsert(payload, { onConflict: "doctor_id" }).select("id, status, rejection_reason, submitted_at").single()
    if (error || !created) { setMessage(error?.message || "Could not save your application."); setSaving(false); return }

    const documentPaths: Record<string, string> = {}
    for (const [index, file] of Array.from(files).entries()) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from("doctor-verification-documents").upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) { setMessage(`Application saved, but ${file.name} could not upload: ${uploadError.message}`); setSaving(false); return }
      const documentType = (["medical_registration", "qualification", "government_id", "other"] as const)[index] || "other"
      const { error: documentError } = await supabase.from("doctor_verification_documents").insert({ application_id: created.id, document_type: documentType, file_path: path, file_name: file.name, mime_type: file.type || "application/octet-stream", file_size_bytes: file.size })
      if (documentError) { setMessage(`Application saved, but ${file.name} metadata could not be recorded: ${documentError.message}`); setSaving(false); return }
      documentPaths[documentType] = path
    }
    const { error: applicationUpdateError } = await supabase.from("doctor_verification_applications").update({ license_document_path: documentPaths.medical_registration, degree_document_path: documentPaths.qualification, government_id_document_path: documentPaths.government_id, supporting_document_path: documentPaths.other || null }).eq("id", created.id)
    if (applicationUpdateError) { setMessage(applicationUpdateError.message); setSaving(false); return }
    sessionStorage.removeItem("carebridge_doctor_draft"); setSaving(false); router.replace("/doctor/verification-pending")
  }

  if (loading) return <main className="container mx-auto max-w-3xl px-4 py-12">Loading verification application…</main>
  if (application) {
    const approved = application.status === "approved"
    const Icon = approved ? CheckCircle2 : application.status === "rejected" ? XCircle : Clock3
    return <main className="container mx-auto max-w-2xl px-4 py-12"><Card><CardHeader><div className="flex items-center gap-3"><Icon className={approved ? "text-green-600" : application.status === "rejected" ? "text-red-600" : "text-amber-600"} /><CardTitle>Verification {application.status}</CardTitle></div><CardDescription>Submitted {new Date(application.submitted_at).toLocaleString()}.</CardDescription></CardHeader><CardContent className="space-y-4">{application.status === "pending" && <><p className="font-medium">Your documents have been submitted and are awaiting verification.</p><p>Doctor dashboard access stays unavailable until approval.</p></>}{approved && <><p>Your doctor account is verified.</p><Link href="/dashboard"><Button>Open Doctor Dashboard</Button></Link></>}{application.status === "rejected" && <><p className="text-destructive">Reason: {application.rejection_reason}</p><Button onClick={() => setApplication(null)}>Update and resubmit application</Button></>}<div className="rounded-md bg-muted p-4 text-sm"><p><strong>Doctor:</strong> {application.full_name}</p><p><strong>Specialization:</strong> {application.specialization}</p><p><strong>Qualification:</strong> {application.qualification}</p><p><strong>Registration:</strong> {application.registration_number}</p></div></CardContent></Card></main>
  }

  return <main className="container mx-auto max-w-4xl px-4 py-10"><Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Doctor verification</CardTitle><CardDescription>Submit your credentials and supporting documents. Your account will stay pending until an authorized administrator approves it.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-8"><section className="grid gap-4 md:grid-cols-2"><h2 className="md:col-span-2 font-semibold">Personal information</h2><Field label="Full name" value={form.full_name} onChange={(v) => set("full_name", v)} /><Field label="Date of birth" type="date" value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} /><div className="space-y-2"><Label>Gender</Label><Select value={form.gender} onValueChange={(v) => set("gender", v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="female">Female</SelectItem><SelectItem value="male">Male</SelectItem><SelectItem value="non_binary">Non-binary</SelectItem><SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem></SelectContent></Select></div><Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} /><Field label="Address" value={form.address} onChange={(v) => set("address", v)} /><Field label="City" value={form.city} onChange={(v) => set("city", v)} /><Field label="State" value={form.state} onChange={(v) => set("state", v)} /></section><section className="grid gap-4 md:grid-cols-2"><h2 className="md:col-span-2 font-semibold">Professional information</h2><Field label="Qualification" value={form.qualification} onChange={(v) => set("qualification", v)} /><Field label="Specialization" value={form.specialization} onChange={(v) => set("specialization", v)} /><Field label="College or university" value={form.college_or_university} onChange={(v) => set("college_or_university", v)} /><Field label="Graduation year" type="number" value={form.graduation_year} onChange={(v) => set("graduation_year", v)} /><Field label="Years of experience" type="number" value={form.years_of_experience} onChange={(v) => set("years_of_experience", v)} /><Field label="Current hospital or clinic" required={false} value={form.current_hospital_or_clinic} onChange={(v) => set("current_hospital_or_clinic", v)} /></section><section className="grid gap-4 md:grid-cols-2"><h2 className="md:col-span-2 font-semibold">Medical registration</h2><Field label="Registration number" value={form.registration_number} onChange={(v) => set("registration_number", v)} /><Field label="Registration authority" value={form.registration_authority} onChange={(v) => set("registration_authority", v)} /><Field label="Registration date" type="date" value={form.registration_date} onChange={(v) => set("registration_date", v)} /></section><div className="space-y-2"><Label htmlFor="documents">Verification documents (select in this order)</Label><Input id="documents" type="file" multiple accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFiles(e.target.files)} required /><p className="text-sm text-muted-foreground">Select: 1) licence/registration certificate, 2) qualification certificate, 3) government ID, then optional supporting documents. PDF, JPG, or PNG only; files are stored privately.</p></div>{message && <p className="text-sm">{message}</p>}<Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit for review"}</Button></form></CardContent></Card></main>
}

function Field({ label, value, onChange, type = "text", required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></div>
}
