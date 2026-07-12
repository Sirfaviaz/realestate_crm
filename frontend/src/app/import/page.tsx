"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { importApi, type ImportPreview } from "@/lib/api";
import { CONTACT_TYPES } from "@/lib/contact-roles";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, LoadingSpinner } from "@/components/ui";

type Step = "pick" | "upload" | "preview" | "done";

export default function ImportPage() {
  const [step, setStep] = useState<Step>("pick");
  const [role, setRole] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [updateDuplicates, setUpdateDuplicates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; listings_created?: number } | null>(null);

  const pickRole = (r: string) => {
    setRole(r);
    setStep("upload");
  };

  const upload = async () => {
    if (!file || !role) return;
    setLoading(true);
    try {
      const p = await importApi.preview(role, file);
      setPreview(p);
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!preview?.preview_id) return;
    setLoading(true);
    try {
      const r = await importApi.confirm(preview.preview_id, updateDuplicates);
      setResult(r);
      setStep("done");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("pick");
    setRole("");
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">Import Contacts</h1>

      {step === "pick" && (
        <div className="grid grid-cols-2 gap-3">
          {CONTACT_TYPES.map((t) => (
            <button
              key={t.role}
              type="button"
              onClick={() => pickRole(t.role)}
              className="rounded-2xl border-2 border-slate-200 bg-white p-4 text-left hover:border-emerald-400"
            >
              <div className="font-bold">{t.label}</div>
              <div className="text-sm text-slate-500">Excel template</div>
            </button>
          ))}
        </div>
      )}

      {step === "upload" && (
        <Card className="space-y-4">
          <div className="font-semibold capitalize">{role} import</div>
          {(role === "seller" || role === "landlord") && (
            <p className="text-sm text-slate-600">
              Template includes owner contact fields (name, phone) plus full project details
              (builder, location, BHK, pricing, amenities, etc.). Each row creates a person and a property listing.
            </p>
          )}
          {(role === "buyer" || role === "renter") && (
            <p className="text-sm text-slate-600">
              Template includes search preferences only — budget, locations, BHK, tenant profile (renters).
            </p>
          )}
          <button
            type="button"
            onClick={() => importApi.downloadTemplate(role)}
            className="flex items-center gap-2 text-sm text-emerald-600 underline"
          >
            <Download className="h-4 w-4" /> Download template
          </button>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6">
            <Upload className="h-8 w-8 text-slate-400" />
            <span className="text-sm text-slate-600">{file ? file.name : "Choose .xlsx file"}</span>
            <input type="file" accept=".xlsx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <Button className="w-full" disabled={!file || loading} onClick={upload}>
            {loading ? "Uploading..." : "Preview import"}
          </Button>
          <Button variant="outline" className="w-full" onClick={reset}>Back</Button>
        </Card>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Badge>{preview.valid_count} valid</Badge>
            <Badge>{preview.error_count} errors</Badge>
            <Badge>{preview.duplicate_count} duplicates</Badge>
          </div>
          {preview.errors.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <div className="mb-2 font-semibold text-red-700">Errors</div>
              {preview.errors.slice(0, 10).map((e) => (
                <div key={e.row} className="text-sm">Row {e.row}: {e.errors.join(", ")}</div>
              ))}
            </Card>
          )}
          {preview.duplicate_count > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={updateDuplicates} onChange={(e) => setUpdateDuplicates(e.target.checked)} />
              Update existing contacts (match by phone)
            </label>
          )}
          {loading ? <LoadingSpinner /> : (
            <>
              <Button className="w-full" onClick={confirm} disabled={!preview.preview_id || preview.valid_count === 0}>
                Confirm import ({preview.valid_count} rows)
              </Button>
              <Button variant="outline" className="w-full" onClick={reset}>Cancel</Button>
            </>
          )}
        </div>
      )}

      {step === "done" && result && (
        <Card className="space-y-3 text-center">
          <div className="text-lg font-semibold text-emerald-700">Import complete</div>
          <div className="text-sm text-slate-600">
            Created {result.created}, updated {result.updated}, skipped {result.skipped}
            {result.listings_created != null && result.listings_created > 0
              ? `, ${result.listings_created} propert${result.listings_created === 1 ? "y" : "ies"} imported`
              : ""}
          </div>
          <Button className="w-full" onClick={reset}>Import more</Button>
        </Card>
      )}
    </AppShell>
  );
}
