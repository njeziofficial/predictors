import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, X } from "lucide-react";
import { api, type EmailProviderName, type EmailStatusDto } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// What each provider needs on the backend (Render → Environment): only its secret keys. Who it
// sends from is set below. senderHelp: which addresses it will actually send from.
const PROVIDERS: Record<EmailProviderName, { label: string; help: string; settings: string; senderHelp: string }> = {
  Brevo: {
    label: "Brevo",
    help: "Free: 300 a day. No domain needed: without one, Brevo sends from an @brevosend.com address in place of yours.",
    settings: "Email__Brevo__ApiKey",
    senderHelp: "Must be a sender you verified in Brevo (Senders, Domains & Dedicated IPs → Senders), or Brevo refuses to send.",
  },
  Gmail: {
    label: "Gmail",
    help: "Free: about 500 a day, sent from your Gmail address through the Gmail API.",
    settings: "Email__Gmail__ClientId · Email__Gmail__ClientSecret · Email__Gmail__RefreshToken",
    senderHelp:
      "Must be the Gmail account the refresh token was made with (or one of its \"Send mail as\" addresses); Gmail sends from that account otherwise. Another account needs a new refresh token on the server.",
  },
  Resend: {
    label: "Resend",
    help: "Free: 100 a day, 3,000 a month. Needs a domain of your own, verified in Resend.",
    settings: "Email__Resend__ApiKey",
    senderHelp: "Must be an address on the domain you verified in Resend.",
  },
};

/** Who emails come from: the name, and each provider's address. Blank uses the server's. */
const SendersForm = ({ status }: { status: EmailStatusDto }) => {
  const queryClient = useQueryClient();
  const saved = () => ({
    senderName: status.savedSenderName ?? "",
    ...Object.fromEntries(status.providers.map((p) => [p.name.toLowerCase(), p.savedAddress ?? ""])),
  }) as { senderName: string; resend: string; brevo: string; gmail: string };
  const [form, setForm] = useState(saved);
  const savedKey = JSON.stringify(saved());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setForm(saved()), [savedKey]);
  const dirty = JSON.stringify(form) !== savedKey;

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.admin.email.setSenders(form),
    onSuccess: (next) => {
      queryClient.setQueryData(["email-status"], next);
      toast.success("Sender saved.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save the sender."),
  });

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <p className="text-sm font-semibold">Sender</p>
        <p className="text-xs text-muted-foreground">Who players see emails come from. Leave a field blank to use the server's setting (shown greyed).</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email-sender-name">Name</Label>
        <Input
          id="email-sender-name"
          value={form.senderName}
          maxLength={100}
          placeholder="Octopus Prediction"
          onChange={(e) => setForm({ ...form, senderName: e.target.value })}
          className="bg-secondary border-border"
        />
      </div>
      {status.providers.map((p) => {
        const key = p.name.toLowerCase() as "resend" | "brevo" | "gmail";
        return (
          <div key={p.name} className="space-y-1.5">
            <Label htmlFor={`email-sender-${key}`}>{PROVIDERS[p.name].label} address</Label>
            <Input
              id={`email-sender-${key}`}
              type="email"
              value={form[key]}
              maxLength={256}
              placeholder={p.serverAddress ?? "Not set"}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="bg-secondary border-border"
            />
            <p className="text-[11px] text-muted-foreground">{PROVIDERS[p.name].senderHelp}</p>
          </div>
        );
      })}
      <Button className="w-full" onClick={() => save()} disabled={!dirty || isPending}>
        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save sender
      </Button>
    </div>
  );
};

/** System admin only: which email provider sends, and how much of each one's free limits is used. */
const EmailStatusCard = () => {
  const queryClient = useQueryClient();
  const { data: status, refetch } = useQuery({ queryKey: ["email-status"], queryFn: api.admin.email.status });

  const { mutate: choose, isPending: choosing } = useMutation({
    mutationFn: api.admin.email.setProvider,
    onSuccess: (saved: EmailStatusDto) => {
      queryClient.setQueryData(["email-status"], saved);
      toast.success(saved.active ? `Emails now go out through ${saved.active}.` : "Email provider saved.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't change the email provider."),
  });

  const { mutate: clearErrors, isPending: clearing } = useMutation({
    mutationFn: api.admin.email.clearErrors,
    onSuccess: (next: EmailStatusDto) => queryClient.setQueryData(["email-status"], next),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't clear the notice."),
  });

  const { mutate: sendTest, isPending: testing } = useMutation({
    mutationFn: api.admin.email.test,
    onSuccess: ({ message }) => {
      toast.success(message);
      refetch();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't send a test email.");
      refetch();
    },
  });

  return (
    <div className="rounded-xl border border-destructive/30 bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-destructive" />
        <span className="text-sm font-semibold">Email</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-destructive/20 text-destructive">System user only</span>
        {status && (
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded font-medium ${
              status.active ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"
            }`}
          >
            {status.active ? `Sending through ${status.active}` : "Not set up"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Forgot password links, welcome emails for accounts you create, and reminders and news for players with
        notifications off in every browser. A provider can be chosen once its settings are on the server; keys never
        appear here.
      </p>

      {!status ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <RadioGroup
            value={status.choice}
            onValueChange={(v) => choose(v)}
            className="gap-2"
            disabled={choosing}
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
              <RadioGroupItem value="auto" id="email-auto" className="mt-0.5" />
              <span>
                <Label htmlFor="email-auto">First one set up</Label>
                <span className="block text-xs text-muted-foreground">Resend, then Brevo, then Gmail.</span>
              </span>
            </label>
            {status.providers.map((p) => {
              const info = PROVIDERS[p.name];
              return (
                <label
                  key={p.name}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    p.configured ? "cursor-pointer border-border" : "cursor-not-allowed border-dashed border-border opacity-80"
                  } ${p.active ? "border-primary/60 bg-primary/5" : ""}`}
                >
                  <RadioGroupItem value={p.name} id={`email-${p.name}`} className="mt-0.5" disabled={!p.configured} />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-center gap-2">
                      <Label htmlFor={`email-${p.name}`}>{info.label}</Label>
                      {p.active && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-success/20 text-success">Sending</span>}
                      {!p.configured && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-secondary text-muted-foreground">Not set up</span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">{info.help}</span>
                    {p.configured ? (
                      <span className="block text-xs">
                        <span className="text-muted-foreground">From</span>{" "}
                        <span className="break-all">{p.from ?? "no sender address: set one below"}</span>
                        <span className="text-muted-foreground"> · Today </span>
                        {p.sentToday}/{p.dailyLimit}
                        <span className="text-muted-foreground"> · Month </span>
                        {p.sentThisMonth}/{p.monthlyLimit}
                      </span>
                    ) : (
                      <span className="block break-words font-mono text-[10px] text-muted-foreground">{info.settings}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </RadioGroup>

          {status.active && (
            <p className="text-xs text-muted-foreground">
              {status.dailyReserve} of each day's emails are kept for password and welcome emails, so reminders and news
              can never use them up.
            </p>
          )}
          {status.failedToday > 0 && (
            <div className="relative rounded-lg bg-destructive/10 border border-destructive/30 py-2 pl-3 pr-9 text-xs text-destructive">
              {status.failedToday} {status.failedToday === 1 ? "email" : "emails"} didn't go out today.
              {status.lastError && <span className="block mt-1 break-words">Last error: {status.lastError}</span>}
              <button
                type="button"
                onClick={() => clearErrors()}
                disabled={clearing}
                aria-label="Clear this notice"
                title="Clear this notice (a new failure will show again)"
                className="absolute right-2 top-2 rounded p-0.5 text-destructive/70 transition-colors hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
              >
                {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
          <SendersForm status={status} />
          <Button variant="outline" className="w-full" onClick={() => sendTest()} disabled={!status.active || testing}>
            {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {status.active ? `Send a test to my email through ${status.active}` : "Send a test to my email"}
          </Button>
        </>
      )}
    </div>
  );
};

export default EmailStatusCard;
