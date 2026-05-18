import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BehaviorPad } from "@/components/BehaviorPad";
import { extractFeatures } from "@/lib/behavior/features";
import { AadiError, parseHeader, readAadi, type AadiHeader } from "@/lib/aadi";
import { deriveAesAndHmac } from "@/lib/crypto/derive";
import { loadEnrollment, unb64 } from "@/lib/storage";
import { toast } from "sonner";
import { Loader2, FileUp, Download, Eye } from "lucide-react";
import { ToleranceReport } from "@/components/ToleranceReport";
import type { FeatureVector } from "@/lib/behavior/features";

export const Route = createFileRoute("/decrypt")({
  head: () => ({
    meta: [
      { title: "Decrypt · BehaviorKey Vault" },
      { name: "description", content: "Decrypt a .aadi file by reproducing your behavioral biometric." },
    ],
  }),
  component: DecryptPage,
});

function DecryptPage() {
  const [enrolled, setEnrolled] = useState(false);
  const [buf, setBuf] = useState<Uint8Array | null>(null);
  const [header, setHeader] = useState<AadiHeader | null>(null);
  const [working, setWorking] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; isFile: boolean; bytes: Uint8Array } | null>(null);
  const [mismatch, setMismatch] = useState<{ sample: FeatureVector; template: FeatureVector } | null>(null);

  useEffect(() => { setEnrolled(!!loadEnrollment()); }, []);

  async function onFile(f: File | null) {
    setRevealed(null);
    setHeader(null);
    setBuf(null);
    if (!f) return;
    try {
      const arr = new Uint8Array(await f.arrayBuffer());
      const h = parseHeader(arr);
      setBuf(arr);
      setHeader(h);
    } catch (e) {
      const err = e as AadiError;
      toast.error("Invalid .aadi", { description: err.message });
    }
  }

  async function handleCaptured(raw: Parameters<typeof extractFeatures>[0]) {
    if (!buf || !header) {
      toast.error("Upload a .aadi file first");
      return;
    }
    const enr = loadEnrollment();
    if (!enr) return;
    setWorking(true);
    setMismatch(null);
    const liveFeatures = extractFeatures(raw);
    try {
      // Derive the key from LIVE features — quantization (±15%) provides tolerance.
      const { aesKey, hmacKey } = await deriveAesAndHmac(liveFeatures, header.salt);
      const { plaintext } = await readAadi(buf, aesKey, hmacKey);
      setRevealed({ name: header.name, isFile: header.isFile, bytes: plaintext });
      toast.success("Decrypted", { description: `${plaintext.length} bytes recovered` });
    } catch (e) {
      const err = e as AadiError | Error;
      const code = (err as AadiError).code;
      if (code === "HmacMismatch" || code === "DecryptFailed") {
        setMismatch({ sample: liveFeatures, template: enr.template });
        toast.error("Behavior mismatch", { description: "See per-feature breakdown below." });
      } else {
        toast.error("Failed", { description: err.message });
      }
    } finally {
      setWorking(false);
    }
  }

  function download() {
    if (!revealed) return;
    const blob = new Blob([new Uint8Array(revealed.bytes)], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = revealed.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!enrolled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-semibold">No enrollment yet</h1>
        <p className="text-muted-foreground">Enroll your behavior first so we can re-derive the key.</p>
        <Link to="/enroll"><Button className="gradient-primary text-primary-foreground">Enroll now</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Decrypt</h1>
        <p className="text-sm text-muted-foreground">Upload your .aadi file, then reproduce your behavior to unlock it.</p>
      </header>

      <div className="rounded-xl border bg-card p-5">
        <label className="flex items-center justify-center gap-2 h-28 w-full rounded-md border border-dashed cursor-pointer hover:border-primary/50 text-sm text-muted-foreground">
          <FileUp className="h-4 w-4" />
          {header ? <span className="text-foreground font-mono">{header.name}</span> : "Drop a .aadi file"}
          <input type="file" accept=".aadi" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      {header && (
        <div className="rounded-xl border bg-card p-5 space-y-2 text-xs font-mono">
          <Row k="magic" v="AADI" />
          <Row k="version" v={String(header.version)} />
          <Row k="kind" v={header.isFile ? "file" : "text"} />
          <Row k="name" v={header.name} />
          <Row k="salt" v={hex(header.salt)} />
          <Row k="iv" v={hex(header.iv)} />
          <Row k="payload" v={`${header.payloadLen} bytes`} />
        </div>
      )}

      <div className="rounded-xl border bg-card p-5">
        <BehaviorPad onCaptured={handleCaptured} label="Reproduce your behavior" minDurationMs={3000} />
      </div>

      {working && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Verifying HMAC & decrypting…
        </div>
      )}

      {revealed && (
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-accent">
            <Eye className="h-4 w-4" /> Decrypted: <span className="font-mono">{revealed.name}</span>
          </div>
          {revealed.isFile ? (
            <Button onClick={download} className="gradient-primary text-primary-foreground">
              <Download className="mr-1 h-4 w-4" /> Save file
            </Button>
          ) : (
            <pre className="hex-dump bg-card rounded-md p-3 max-h-72 overflow-auto whitespace-pre-wrap">
              {safeText(revealed.bytes)}
            </pre>
          )}
        </div>
      )}

      {mismatch && !revealed && (
        <ToleranceReport
          sample={mismatch.sample}
          template={mismatch.template}
          onRetry={() => setMismatch(null)}
        />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground truncate">{v}</span>
    </div>
  );
}
function hex(b: Uint8Array) {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function safeText(b: Uint8Array) {
  try { return new TextDecoder("utf-8", { fatal: false }).decode(b); } catch { return "[binary]"; }
}
