"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileCheck2,
  FileText,
  LockKeyhole,
  Stethoscope,
  Upload,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FormData = Record<string, string>;
const blank: FormData = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  date_of_birth: "",
  specialization: "",
  qualification: "",
  college_or_university: "",
  graduation_year: "",
  years_of_experience: "",
  registration_number: "",
  registration_authority: "",
  registration_date: "",
  current_hospital_or_clinic: "",
  address: "",
  city: "",
  state: "",
  about: "",
};
type RequiredDocument =
  | "medical_registration"
  | "qualification"
  | "government_id"
  | "other";

export default function DoctorRegisterPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [form, setForm] = useState<FormData>(blank);
  const [documents, setDocuments] = useState<
    Partial<Record<RequiredDocument, File>>
  >({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const set = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const saveApplication = async (userId: string, email: string) => {
    const payload = {
      doctor_id: userId,
      email,
      full_name: form.full_name,
      date_of_birth: form.date_of_birth,
      phone: form.phone,
      address: form.address,
      city: form.city,
      state: form.state,
      qualification: form.qualification,
      specialization: form.specialization,
      college_or_university: form.college_or_university,
      medical_college: form.college_or_university,
      graduation_year: Number(form.graduation_year),
      years_of_experience: Number(form.years_of_experience),
      current_hospital_or_clinic: form.current_hospital_or_clinic,
      clinic_hospital_name: form.current_hospital_or_clinic,
      clinic_hospital_address: form.address,
      professional_bio: form.about,
      registration_number: form.registration_number,
      medical_license_number: form.registration_number,
      registration_authority: form.registration_authority,
      registration_council: form.registration_authority,
      registration_date: form.registration_date,
    };
    const { data: application, error } = await supabase
      .from("doctor_verification_applications")
      .upsert(payload, { onConflict: "doctor_id" })
      .select("id")
      .single();
    if (error || !application)
      throw new Error(
        error?.message || "Could not create verification application",
      );
    const documentPaths: Record<string, string> = {};
    for (const [document_type, file] of Object.entries(documents)) {
      if (!file) continue;
      const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("doctor-verification-documents")
        .upload(path, file, { contentType: file.type });
      if (uploadError)
        throw new Error(
          `Could not upload ${file.name}: ${uploadError.message}`,
        );
      const { error: metadataError } = await supabase
        .from("doctor_verification_documents")
        .insert({
          application_id: application.id,
          document_type,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size_bytes: file.size,
        });
      if (metadataError)
        throw new Error(
          `Could not save ${file.name}: ${metadataError.message}`,
        );
      documentPaths[document_type] = path;
    }
    const { error: applicationUpdateError } = await supabase
      .from("doctor_verification_applications")
      .update({
        license_document_path: documentPaths.medical_registration,
        degree_document_path: documentPaths.qualification,
        government_id_document_path: documentPaths.government_id,
        supporting_document_path: documentPaths.other || null,
      })
      .eq("id", application.id);
    if (applicationUpdateError)
      throw new Error(
        `Could not save document references: ${applicationUpdateError.message}`,
      );
  };

  const prepareDoctorProfile = async () => {
    const profileResponse = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.full_name,
        phone: form.phone,
        address: form.address,
        specialty: form.specialization,
        about: form.about,
        role: "doctor",
        language: "en",
      }),
    });
    if (!profileResponse.ok) {
      const errorData = await profileResponse.json().catch(() => null);
      throw new Error(
        errorData?.error ||
          "Your account could not be prepared for doctor verification.",
      );
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !documents.medical_registration ||
      !documents.qualification ||
      !documents.government_id
    ) {
      setMessage(
        "Upload your licence, qualification certificate, and government ID.",
      );
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();
      if (existingUser) {
        await prepareDoctorProfile();
        await saveApplication(
          existingUser.id,
          existingUser.email || form.email,
        );
        router.replace("/doctor/verification-pending");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            name: form.full_name,
            phone: form.phone,
            role: "doctor",
            language: "en",
          },
        },
      });
      if (error) throw error;
      sessionStorage.setItem("carebridge_doctor_draft", JSON.stringify(form));
      if (!data.session || !data.user) {
        setMessage(
          "Check your email to confirm your account. After signing in, complete the verification submission and re-upload the documents from this private device.",
        );
        return;
      }
      await prepareDoctorProfile();
      await saveApplication(data.user.id, data.user.email || form.email);
      router.replace("/doctor/verification-pending");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not create your doctor account.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost">Back to CareBridge</Button>
          </Link>
          <Link href="/login?role=doctor">
            <Button variant="outline">Doctor sign in</Button>
          </Link>
        </div>
        <Card className="border-secondary/30 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-secondary/10">
              <Stethoscope className="h-5 w-5 text-secondary" />
            </div>
            <CardTitle>Join CareBridge as a verified doctor</CardTitle>
            <CardDescription>
              We review your credentials before enabling consultations. Your
              documents remain private and are only available to authorized
              verification administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-8 grid gap-3 sm:grid-cols-4">
              {[
                "Personal Information",
                "Professional Credentials",
                "Practice Details",
                "Verification Documents",
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-xs font-semibold text-secondary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <form onSubmit={submit} className="space-y-6">
              <Section title="Account & Personal Information">
                <Field
                  label="Full name"
                  placeholder="Enter your full name"
                  value={form.full_name}
                  onChange={(v) => set("full_name", v)}
                />
                <Field
                  label="Email"
                  placeholder="Enter your professional email"
                  type="email"
                  value={form.email}
                  onChange={(v) => set("email", v)}
                />
                <Field
                  label="Password"
                  placeholder="Create a strong password"
                  type="password"
                  value={form.password}
                  onChange={(v) => set("password", v)}
                />
                <Field
                  label="Phone number"
                  placeholder="+91 XXXXX XXXXX"
                  value={form.phone}
                  onChange={(v) => set("phone", v)}
                />
                <Field
                  label="Date of birth"
                  placeholder="Select your date of birth"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(v) => set("date_of_birth", v)}
                />
              </Section>
              <Section title="Professional Credentials">
                <Field
                  label="Medical specialization"
                  placeholder="e.g. Cardiology, Dermatology, General Medicine"
                  value={form.specialization}
                  onChange={(v) => set("specialization", v)}
                />
                <Field
                  label="Qualification / degree"
                  placeholder="e.g. MBBS, MD, BDS"
                  value={form.qualification}
                  onChange={(v) => set("qualification", v)}
                />
                <Field
                  label="Medical college / institution"
                  placeholder="Enter your medical college or institution"
                  value={form.college_or_university}
                  onChange={(v) => set("college_or_university", v)}
                />
                <Field
                  label="Graduation year"
                  placeholder="e.g. 2022"
                  type="number"
                  value={form.graduation_year}
                  onChange={(v) => set("graduation_year", v)}
                />
                <Field
                  label="Years of experience"
                  placeholder="e.g. 3"
                  type="number"
                  value={form.years_of_experience}
                  onChange={(v) => set("years_of_experience", v)}
                />
                <Field
                  label="Medical registration / licence number"
                  placeholder="Enter your registration number"
                  value={form.registration_number}
                  onChange={(v) => set("registration_number", v)}
                />
                <Field
                  label="Registration council, state or country"
                  placeholder="e.g. National Medical Commission / State Medical Council"
                  value={form.registration_authority}
                  onChange={(v) => set("registration_authority", v)}
                />
                <Field
                  label="Registration date"
                  placeholder="Select registration date"
                  type="date"
                  value={form.registration_date}
                  onChange={(v) => set("registration_date", v)}
                />
              </Section>
              <Section title="Practice Details">
                <Field
                  label="Clinic / hospital name"
                  placeholder="Enter clinic or hospital name"
                  value={form.current_hospital_or_clinic}
                  onChange={(v) => set("current_hospital_or_clinic", v)}
                />
                <Field
                  label="Clinic / hospital address"
                  placeholder="Enter complete address"
                  value={form.address}
                  onChange={(v) => set("address", v)}
                />
                <Field
                  label="City"
                  placeholder="Enter city"
                  value={form.city}
                  onChange={(v) => set("city", v)}
                />
                <Field
                  label="State"
                  placeholder="Enter state"
                  value={form.state}
                  onChange={(v) => set("state", v)}
                />
                <div className="space-y-2 md:col-span-2">
                  <Label>Professional bio</Label>
                  <Textarea
                    value={form.about}
                    onChange={(e) => set("about", e.target.value)}
                    placeholder="Briefly describe your experience, specialization and approach to patient care..."
                    required
                  />
                </div>
              </Section>
              <section className="space-y-5 rounded-xl border border-secondary/20 bg-muted/20 p-5 sm:p-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5 text-secondary" />
                    <h2 className="font-semibold">
                      Required Verification Documents
                    </h2>
                  </div>
                  <p className="text-sm font-medium">Required documents</p>
                  <p className="text-sm text-muted-foreground">
                    These documents are securely stored and reviewed by our
                    verification team before your doctor account is approved.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <DocumentField
                    label="Medical licence / registration certificate"
                    description="Upload your valid medical registration or licence certificate."
                    required
                    file={documents.medical_registration}
                    onChange={(file) =>
                      setDocuments((d) => ({
                        ...d,
                        medical_registration: file,
                      }))
                    }
                  />
                  <DocumentField
                    label="Medical degree / qualification certificate"
                    description="Upload your MBBS/MD/BDS or other qualification certificate."
                    required
                    file={documents.qualification}
                    onChange={(file) =>
                      setDocuments((d) => ({ ...d, qualification: file }))
                    }
                  />
                  <DocumentField
                    label="Government ID"
                    description="Upload a valid government-issued identity document."
                    required
                    file={documents.government_id}
                    onChange={(file) =>
                      setDocuments((d) => ({ ...d, government_id: file }))
                    }
                  />
                  <DocumentField
                    label="Additional supporting document"
                    description="Optional document supporting your professional credentials."
                    file={documents.other}
                    onChange={(file) =>
                      setDocuments((d) => ({ ...d, other: file }))
                    }
                  />
                </div>
              </section>
              {message && (
                <p className="rounded-md border px-3 py-2 text-sm">{message}</p>
              )}
              <Button
                type="submit"
                size="lg"
                disabled={saving}
                className="gap-2"
              >
                <LockKeyhole className="h-4 w-4" />
                {saving
                  ? "Submitting application..."
                  : "Create Account & Submit for Verification"}
              </Button>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                Doctor dashboard access is granted only after approval.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-xl border bg-card/50 p-5 sm:grid-cols-2 sm:p-6">
      <h2 className="sm:col-span-2 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
function DocumentField({
  label,
  description,
  file,
  required = false,
  onChange,
}: {
  label: string;
  description: string;
  file?: File;
  required?: boolean;
  onChange: (file?: File) => void;
}) {
  const id = `document-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="rounded-lg border bg-background/60 p-4">
      <input
        id={id}
        className="sr-only"
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        required={required}
        onChange={(e) => onChange(e.target.files?.[0])}
      />
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-secondary/10 p-2">
          <FileText className="h-5 w-5 text-secondary" />
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor={id} className="cursor-pointer font-medium">
            {label}
            {required ? " *" : ""}
          </Label>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            PDF, JPG or PNG · Maximum 10 MB
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Label htmlFor={id}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="pointer-events-none gap-2"
              >
                <Upload className="h-4 w-4" />
                {file ? "Replace file" : "Upload document"}
              </Button>
            </Label>
            {file && (
              <span className="flex min-w-0 items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{file.name}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
