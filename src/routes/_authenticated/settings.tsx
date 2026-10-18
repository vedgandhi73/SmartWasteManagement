import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Zero2Hero" },
      { name: "description", content: "Manage your Zero2Hero profile and preferences." },
      { property: "og:title", content: "Settings — Zero2Hero" },
      { property: "og:description", content: "Manage your Zero2Hero profile and preferences." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { user } = useAuth();
  const [p, setP] = useState({ name: "", phone: "", address: "", notifications_enabled: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) setP({ name: data.name, phone: data.phone ?? "", address: data.address ?? "", notifications_enabled: data.notifications_enabled });
    });
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ ...p, name: p.name.trim() || "Eco Hero" }).eq("id", user.id);
    setSaving(false);
    error ? toast.error(error.message) : toast.success("Settings saved");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-4xl font-bold">Account settings</h1>
      <form onSubmit={save} className="space-y-5 rounded-3xl border bg-card p-8 shadow-soft">
        <div className="space-y-1.5"><Label htmlFor="n">Full name</Label><Input id="n" maxLength={80} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Email address</Label><Input value={user?.email ?? ""} readOnly className="bg-muted" /></div>
        <div className="space-y-1.5"><Label htmlFor="ph">Phone number</Label><Input id="ph" maxLength={30} value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="ad">Address</Label><Input id="ad" maxLength={200} value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} /></div>
        <div className="flex items-center gap-3">
          <Switch id="nt" checked={p.notifications_enabled} onCheckedChange={(v) => setP({ ...p, notifications_enabled: v })} />
          <Label htmlFor="nt">Receive email notifications</Label>
        </div>
        <Button type="submit" disabled={saving}>Save changes</Button>
      </form>
    </div>
  );
}
