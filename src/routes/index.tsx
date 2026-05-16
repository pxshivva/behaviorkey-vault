import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Fingerprint, KeyRound, Lock, Unlock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BehaviorKey Vault — Encrypt with your behavior" },
      { name: "description", content: "Behavioral biometrics encryption tool. Your mouse and typing rhythm derive a 256-bit AES key — no passwords, no backend." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
      <section className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary">
          <Sparkles className="h-3.5 w-3.5" /> No passwords. No backend. Just you.
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
          Encrypt with your <span className="text-gradient">behavior</span>.
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          BehaviorKey Vault turns your mouse movement and typing rhythm into a 256-bit AES-GCM key.
          The key is never stored. Only your behavior — repeated within ±15% tolerance — can unlock your files.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link to="/enroll">
            <Button size="lg" className="gradient-primary text-primary-foreground glow-primary">
              <Fingerprint className="mr-2 h-4 w-4" /> Start enrollment
            </Button>
          </Link>
          <Link to="/demo">
            <Button size="lg" variant="outline">Watch 60s demo</Button>
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Fingerprint, title: "1 · Enroll", body: "Record 3 behavioral samples. We extract 9 stable features and store a template — never the key." },
          { icon: Lock, title: "2 · Encrypt", body: "Derive AES-256-GCM via PBKDF2. Output a tamper-proof .aadi container with HMAC-SHA256." },
          { icon: Unlock, title: "3 · Decrypt", body: "Reproduce your behavior within ±15% to re-derive the key. No biometric leaves your browser." },
        ].map((s) => (
          <div key={s.title} className="rounded-xl border bg-card p-5 space-y-2 hover:border-primary/40 transition-colors">
            <s.icon className="h-5 w-5 text-accent" />
            <div className="font-semibold">{s.title}</div>
            <div className="text-sm text-muted-foreground">{s.body}</div>
          </div>
        ))}
      </section>

      <section className="mt-12 rounded-xl border bg-card/60 p-6">
        <div className="flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">How the key is derived: </strong>
            features are quantized into 15%-wide buckets → SHA-256 seed → PBKDF2-SHA256 (200k iters) with a stored salt → 256 bits split into an AES-GCM key and an HMAC-SHA256 key.
          </div>
        </div>
      </section>
    </div>
  );
}
