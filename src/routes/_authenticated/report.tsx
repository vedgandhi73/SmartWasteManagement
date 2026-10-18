import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Loader2, MapPin, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fileToDataUrl } from "@/lib/image";
import { submitReport, verifyWastePhoto } from "@/lib/waste.functions";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "Report Waste — Zero2Hero" },
      { name: "description", content: "Snap a photo of waste, let AI verify it, and earn points." },
      { property: "og:title", content: "Report Waste — Zero2Hero" },
      { property: "og:description", content: "Snap a photo of waste, let AI verify it, and earn points." },
    ],
  }),
  component: ReportPage,
});

type Verified = { wasteType: string; quantity: string; confidence: number };

function ReportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "failure">("idle");
  const [result, setResult] = useState<Verified | null>(null);
  const [form, setForm] = useState({ location: "", type: "", amount: "" });
  const [submitting, setSubmitting] = useState(false);

  const reports = useQuery({
    queryKey: ["reports", "recent"],
    queryFn: async () => (await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(10)).data ?? [],
  });

  async function onFile(f?: File) {
    if (!f) return;
    setFile(f);
    setStatus("idle");
    setResult(null);
    setPreview(await fileToDataUrl(f));
  }

  async function verify() {
    if (!preview) return;
    setStatus("verifying");
    const r = await verifyWastePhoto({ data: { image: preview } });
    if (r.ok) {
      setResult(r.result);
      setStatus("success");
      setForm((f) => ({ ...f, type: r.result.wasteType, amount: r.result.quantity }));
    } else {
      setStatus("failure");
      toast.error(r.error);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "success" || !result || !user || !file) return toast.error("Please verify the waste first.");
    setSubmitting(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const blob = await (await fetch(preview!)).blob();
      const up = await supabase.storage.from("waste-images").upload(path, blob, { contentType: "image/jpeg" });
      await submitReport({
        data: { location: form.location, wasteType: form.type, amount: form.amount, imagePath: up.error ? null : path, verification: result },
      });
      toast.success("Report submitted! You earned 10 points.");
      setForm({ location: "", type: "", amount: "" });
      setFile(null); setPreview(null); setStatus("idle"); setResult(null);
      qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-4xl font-bold">Report waste</h1>
      <form onSubmit={submit} className="mb-12 rounded-3xl border bg-card p-8 shadow-soft">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-primary">
          <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
          <span className="font-semibold text-primary">Upload a photo of the waste</span>
          <span className="text-xs text-muted-foreground">PNG or JPG, up to 10MB</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {preview && <img src={preview} alt="Waste preview" className="mx-auto mt-6 max-h-80 rounded-xl" />}

        <Button type="button" className="mt-6 w-full" size="lg" disabled={!file || status === "verifying"} onClick={verify}>
          {status === "verifying" ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />Verifying…</>) : "Verify waste"}
        </Button>

        {status === "success" && result && (
          <div className="mt-6 flex gap-3 rounded-xl bg-secondary p-4 text-secondary-foreground">
            <CheckCircle className="h-6 w-6 shrink-0 text-success" />
            <div className="text-sm">
              <p className="font-semibold">Verification successful</p>
              <p>Waste type: {result.wasteType}</p>
              <p>Quantity: {result.quantity}</p>
              <p>Confidence: {(result.confidence * 100).toFixed(0)}%</p>
            </div>
          </div>
        )}
        {status === "failure" && (
          <div className="mt-6 flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
            <XCircle className="h-5 w-5" /> Couldn't verify this photo. Try a clearer one.
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5"><Label htmlFor="loc">Location</Label><Input id="loc" required placeholder="Street, area or landmark" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="type">Waste type</Label><Input id="type" readOnly placeholder="Verified waste type" value={form.type} className="bg-muted" /></div>
          <div className="space-y-1.5"><Label htmlFor="amt">Estimated amount</Label><Input id="amt" readOnly placeholder="Verified amount" value={form.amount} className="bg-muted" /></div>
        </div>
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={submitting || status !== "success"}>
          {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}Submit report
        </Button>
      </form>

      <h2 className="mb-4 text-2xl font-bold">Recent reports</h2>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-5 py-3">Location</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Date</th></tr>
          </thead>
          <tbody>
            {reports.data?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-5 py-3"><MapPin className="mr-2 inline h-4 w-4 text-primary" />{r.location}</td>
                <td className="px-5 py-3">{r.waste_type}</td>
                <td className="px-5 py-3">{r.amount}</td>
                <td className="px-5 py-3">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!reports.data?.length && <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No reports yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
