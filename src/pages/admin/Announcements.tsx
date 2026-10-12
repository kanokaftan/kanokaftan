import { useState } from "react";
import { BellRing, Loader2, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const MAX_TITLE_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 300;
const MIN_TEXT_LENGTH = 2;

type Audience = "customers" | "sellers" | "everyone";

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "customers", label: "Customers" },
  { value: "sellers", label: "Sellers" },
  { value: "everyone", label: "Everyone" },
];

const LINK_PRESETS = [
  { value: "/products", label: "All products" },
  { value: "/shops", label: "Shops" },
  { value: "/", label: "Home page" },
  { value: "custom", label: "Another page…" },
];

/** Admin: send a promo / news notification to phones and in-app bells. */
export default function AdminAnnouncements() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [titleHa, setTitleHa] = useState("");
  const [messageHa, setMessageHa] = useState("");
  const [audience, setAudience] = useState<Audience>("customers");
  const [linkPreset, setLinkPreset] = useState("/products");
  const [customLink, setCustomLink] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const link = linkPreset === "custom" ? customLink.trim() : linkPreset;
  const audienceLabel = AUDIENCES.find((a) => a.value === audience)?.label.toLowerCase();

  const validate = (): string | null => {
    if (title.trim().length < MIN_TEXT_LENGTH) return "Write a title";
    if (message.trim().length < MIN_TEXT_LENGTH) return "Write a message";
    if (linkPreset === "custom" && !/^\/[^\s]*$/.test(link)) return "The link must be a Kano Kaftan page starting with /, e.g. /products/blue-agbada";
    return null;
  };

  const askToSend = () => {
    const problem = validate();
    if (problem) return toast.error(problem);
    setConfirming(true);
  };

  const send = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.rpc("admin_broadcast_notification", {
        p_title: title.trim(),
        p_message: message.trim(),
        p_action_url: link || undefined,
        p_audience: audience,
        p_title_ha: titleHa.trim(),
        p_message_ha: messageHa.trim(),
      });
      if (error) throw new Error(error.message);
      toast.success(`Sent to ${data ?? 0} ${audienceLabel}`);
      setTitle("");
      setMessage("");
      setTitleHa("");
      setMessageHa("");
    } catch (error) {
      console.error("Broadcast failed", error);
      toast.error(error instanceof Error ? error.message : "Could not send the announcement");
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  return (
    <AdminLayout title="Announcements">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4" />
              Send an announcement
            </CardTitle>
            <CardDescription>
              Shows on phones that turned on notifications (lock screen and notification panel) and in everyone's bell.
              Customers only get promos if they allowed promotions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title</Label>
              <Input id="ann-title" value={title} maxLength={MAX_TITLE_LENGTH} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sallah sale: 20% off kaftans" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-message">Message</Label>
              <Textarea id="ann-message" rows={3} value={message} maxLength={MAX_MESSAGE_LENGTH} onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. This weekend only. Tap to see the new collection." />
              <p className="text-right text-xs text-muted-foreground">{message.length}/{MAX_MESSAGE_LENGTH}</p>
            </div>
            <div className="space-y-3 rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Hausa (optional)</p>
                <p className="text-xs text-muted-foreground">People who chose Hausa in the app see this instead.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-title-ha">Title in Hausa</Label>
                <Input id="ann-title-ha" lang="ha" value={titleHa} maxLength={MAX_TITLE_LENGTH} onChange={(e) => setTitleHa(e.target.value)}
                  placeholder="misali Rangwamen Sallah: 20% a kan kaftan" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-message-ha">Message in Hausa</Label>
                <Textarea id="ann-message-ha" lang="ha" rows={3} value={messageHa} maxLength={MAX_MESSAGE_LENGTH} onChange={(e) => setMessageHa(e.target.value)}
                  placeholder="misali Wannan karshen mako kawai. Taba don ganin sababbin kaya." />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Send to</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Opens</Label>
                <Select value={linkPreset} onValueChange={setLinkPreset}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LINK_PRESETS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {linkPreset === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="ann-link">Page link</Label>
                <Input id="ann-link" value={customLink} onChange={(e) => setCustomLink(e.target.value)} placeholder="/products/blue-agbada" />
              </div>
            )}

            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
              <div className="flex gap-3 rounded-lg bg-background p-3 shadow-sm">
                <img src="/pwa-192x192.png" alt="" className="h-9 w-9 rounded-md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{title || "Title"}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{message || "Your message"}</p>
                </div>
              </div>
            </div>

            <Button onClick={askToSend} disabled={sending} className="w-full sm:w-auto">
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send
            </Button>
          </CardContent>
        </Card>

        <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <BellRing className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          New products already notify the shop's followers automatically.
        </p>
      </div>

      <AlertDialog open={confirming} onOpenChange={(open) => !sending && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to all {audienceLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              "{title.trim()}" will go out right away and can't be recalled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); send(); }} disabled={sending}>
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
