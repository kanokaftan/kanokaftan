import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Clock, Link2, Loader2, Store, Wallet } from "lucide-react";
import { toast } from "sonner";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useMyAmbassadorApplication, useSubmitAmbassadorApplication } from "@/hooks/useAmbassadors";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const NIGERIAN_PHONE = /^(\+?234|0)[789][01]\d{8}$/;
const ABOUT_MAX = 500;
const SIGN_IN_HREF = "/auth?redirect=/ambassadors/join";

const STEPS = [
  { icon: Link2, title: "Get your own link", body: "Once approved, you get a personal link and a dashboard." },
  { icon: Store, title: "Invite tailors and sellers", body: "Share it on WhatsApp or in person. They open a free shop through it." },
  { icon: Wallet, title: "Earn a bonus", body: "You're paid for every seller you bring once they make their first sale." },
];

function Intro() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Kano Kaftan ambassadors</p>
        <h1 className="mt-1 font-display text-2xl font-bold leading-tight">Bring sellers to Kano Kaftan and get paid</h1>
        <p className="mt-2 text-sm opacity-90">For people who know the tailors and traders in their market or area.</p>
      </div>
      <ol className="space-y-2">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3 rounded-2xl border bg-card p-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <step.icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="text-sm font-semibold">{i + 1}. {step.title}</p>
              <p className="text-[13px] text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Status({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-6 text-center">
      <Icon className="mx-auto h-10 w-10 text-primary" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function ApplicationForm({ defaultName, previousNote }: { defaultName: string; previousNote?: string | null }) {
  const [fullName, setFullName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [about, setAbout] = useState("");
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});
  const submit = useSubmitAmbassadorApplication();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (fullName.trim().length < 2) next.fullName = "Enter your full name.";
    if (!NIGERIAN_PHONE.test(phone.replace(/[\s-]/g, ""))) next.phone = "Enter a Nigerian number, e.g. 0803 123 4567.";
    setErrors(next);
    if (Object.keys(next).length) return;

    submit.mutate(
      { full_name: fullName.trim(), phone: phone.replace(/[\s-]/g, ""), city: city.trim(), about: about.trim() },
      {
        onSuccess: () => toast.success("Application sent. We'll let you know soon."),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-4" noValidate>
      <h2 className="font-semibold">Apply</h2>
      {previousNote && (
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Last time: {previousNote}</p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="amb-name">Full name</Label>
        <Input id="amb-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" className="h-11 rounded-xl" aria-invalid={!!errors.fullName} />
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amb-phone">Phone (WhatsApp)</Label>
        <Input id="amb-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="0803 123 4567" className="h-11 rounded-xl" aria-invalid={!!errors.phone} />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amb-city">Town or market</Label>
        <Input id="amb-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Kurmi market, Kano" className="h-11 rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amb-about">Who could you bring? (optional)</Label>
        <Textarea id="amb-about" value={about} maxLength={ABOUT_MAX} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder="e.g. I know about 20 tailors in Sabon Gari" className="rounded-xl" />
      </div>
      <Button type="submit" className="h-12 w-full rounded-full" disabled={submit.isPending}>
        {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send application
      </Button>
    </form>
  );
}

/** Public page where anyone can apply to be an ambassador; admins approve it. */
export default function AmbassadorJoin() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: application, isLoading } = useMyAmbassadorApplication(!!user);

  useDocumentMeta({
    title: "Become an ambassador - Kano Kaftan",
    description: "Invite tailors and sellers to Kano Kaftan with your own link and earn a bonus for each one who starts selling.",
  });

  let body: React.ReactNode;
  if (authLoading || (user && isLoading)) {
    body = <Skeleton className="h-64 rounded-2xl" />;
  } else if (!user) {
    body = (
      <div className="rounded-2xl border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">Create a free Kano Kaftan account (or sign in), then fill in a short form.</p>
        <Button asChild className="mt-4 h-12 w-full rounded-full"><Link to={SIGN_IN_HREF}>Sign in or create account</Link></Button>
      </div>
    );
  } else if (application?.status === "ambassador") {
    body = (
      <Status
        icon={BadgeCheck}
        title="You're already an ambassador"
        body="Your link and the sellers you invited are on your dashboard."
        action={<Button asChild className="rounded-full"><Link to="/ambassador">Open my dashboard</Link></Button>}
      />
    );
  } else if (application?.status === "pending") {
    body = (
      <Status
        icon={Clock}
        title="Application received"
        body="The Kano Kaftan team will review it and may call you. You'll get a notification when you're approved."
      />
    );
  } else {
    const fallbackName = (user.user_metadata?.full_name as string | undefined) ?? "";
    body = <ApplicationForm defaultName={fallbackName} previousNote={application?.status === "rejected" ? application.admin_note : null} />;
  }

  return (
    <MobileLayout>
      <div className="space-y-4 px-4 pb-24 pt-4">
        <Intro />
        {body}
      </div>
    </MobileLayout>
  );
}
