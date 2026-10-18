import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle, Loader2, MapPin, Search, Trash2, Upload, Weight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fileToDataUrl } from "@/lib/image";
import { startCollection, verifyCollection } from "@/lib/waste.functions";

export const Route = createFileRoute("/_authenticated/collect")({
  head: () => ({
    meta: [
      { title: "Collect Waste — Zero2Hero" },
      { name: "description", content: "Pick up reported waste, verify with a photo and earn points." },
      { property: "og:title", content: "Collect Waste — Zero2Hero" },
      { property: "og:description", content: "Pick up reported waste, verify with a photo and earn points." },
    ],
  }),
  component: CollectPage,
});

const PER_PAGE = 5;
const statusStyles: Record<string, string> = {
  pending: "bg-warning/20 text-accent-foreground",
  in_progress: "bg-secondary text-secondary-foreground",
  verified: "bg-primary text-primary-foreground",
};

function CollectPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [task, setTask] = useState<{ id: number; waste_type: string; amount: string } | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  const tasks = useQuery({
    queryKey: ["reports", "tasks"],
    queryFn: async () => (await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  const filtered = (tasks.data ?? []).filter((t) => t.location.toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  async function start(id: number) {
    try {
      await startCollection({ data: { reportId: id } });
      toast.success("Task started — go collect it!");
      qc.invalidateQueries({ queryKey: ["reports"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function verify() {
    if (!task || !image) return;
    setVerifying(true);
    const r = await verifyCollection({ data: { reportId: task.id, image } });
    setVerifying(false);
    if (!r.ok) return toast.error(r.error);
    const pct = `${(r.result.confidence * 100).toFixed(0)}% confidence`;
    if (r.passed) {
      setOutcome(`Verified! You earned ${r.reward} points (${pct}).`);
      toast.success(`You earned ${r.reward} points!`);
      qc.invalidateQueries();
    } else {
      setOutcome(`Didn't match the report — type ${r.result.wasteTypeMatch ? "✓" : "✗"}, amount ${r.result.quantityMatch ? "✓" : "✗"}, ${pct}.`);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-4xl font-bold">Waste collection tasks</h1>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by area…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {tasks.isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          {shown.map((t) => (
            <div key={t.id} className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="flex items-center text-lg font-semibold"><MapPin className="mr-2 h-5 w-5 text-primary" />{t.location}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyles[t.status] ?? ""}`}>{t.status.replace("_", " ")}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                <span className="flex items-center"><Trash2 className="mr-2 h-4 w-4" />{t.waste_type}</span>
                <span className="flex items-center"><Weight className="mr-2 h-4 w-4" />{t.amount}</span>
                <span className="flex items-center"><Calendar className="mr-2 h-4 w-4" />{new Date(t.created_at).toLocaleDateString()}</span>
              </div>
              <div className="mt-4 flex justify-end">
                {t.status === "pending" && <Button variant="outline" size="sm" onClick={() => start(t.id)}>Start collection</Button>}
                {t.status === "in_progress" && t.collector_id === user?.id && (
                  <Button size="sm" onClick={() => { setTask(t); setImage(null); setOutcome(null); }}>Complete & verify</Button>
                )}
                {t.status === "in_progress" && t.collector_id !== user?.id && <span className="text-sm text-warning">Being collected by someone else</span>}
                {t.status === "verified" && <span className="flex items-center text-sm text-success"><CheckCircle className="mr-1 h-4 w-4" />Reward earned</span>}
              </div>
            </div>
          ))}
          {!shown.length && <p className="py-12 text-center text-muted-foreground">No tasks found.</p>}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm">Page {page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={!!task} onOpenChange={(o) => !o && setTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verify collection</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Upload a photo of the collected waste ({task?.waste_type}, {task?.amount}).</p>
          <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-6 hover:border-primary">
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-semibold text-primary">Choose photo</span>
            <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImage(await fileToDataUrl(f)); }} />
          </label>
          {image && <img src={image} alt="Collected waste" className="max-h-56 rounded-lg object-contain" />}
          <Button onClick={verify} disabled={!image || verifying}>
            {verifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : "Verify collection"}
          </Button>
          {outcome && <p className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">{outcome}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
