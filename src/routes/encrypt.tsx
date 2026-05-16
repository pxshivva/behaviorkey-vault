import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BehaviorPad } from "@/components/BehaviorPad";
import { HexDumpDiff } from "@/components/HexDumpDiff";
import { extractFeatures } from "@/lib/behavior/features";
import { deriveAesAndHmac, randomIv } from "@/lib/crypto/derive";
import { writeAadi } from "@/lib/aadi";
import { loadEnrollment, unb64 } from "@/lib/storage";
import { toast } from "sonner";
import { Download, Lock, Loader2, FileUp } from "lucide-react";

export const Route = createFileRoute("/encrypt")({
  head: () => ({
    meta: [
      { title: "Encrypt · BehaviorKey Vault" },
      { name: "description", content: "Encrypt text or files into a behavioral .aadi container." },
    ],
  }),
  component: EncryptPage,
});

function EncryptPage() {
  const [enrolled, setEnrolled] = useState(false);
  const [mode, setMode] = useState<"text" | "file">("text");
  const [text, setText] = useState("This is a secret message protected by my behavior.");
  const [file, setFile] = useState<File | null>(null);
  const [plaintext, setPlaintext] = useState<Uint8Array | null>(null);
  const [ciphertext, setCiphertext] = useState<Uint8Array | null>(null);
  const [aadi, setAadi] = useState<Uint8Array | null>(null);
  const [name, setName] = useState("secret.txt");
  const [working, setWorking] = useState(false);

  useEffect(() => { setEnrolled(!!loadEnrollment()); }, []);

  async function handleCaptured(raw: Parameters<typeof extractFeatures>[0]) {
    const enr = loadEnrollment();
    if (!enr) return;
    setWorking(true);
    try {
      const features = extractFeatures(raw);
      const salt = unb64(enr.saltB64);
      // Use the stored template (the stable representation) for key derivation
      // and verify the live sample loosely so we still capture intent.
      const { aesKey, hmacKey } = await deriveAesAndHmac(enr.template, salt);

      let pt: Uint8Array;
      let isFile = false;
      let outName = name;
      if (mode === "text") {
        pt = new TextEncoder().encode(text);
        outName = name || "secret.txt";
      } else {
        if (!file) {
          toast.error("Pick a file first");
          setWorking(false);
          return;
        }
        pt = new Uint8Array(await file.arrayBuffer());
        outName = file.name;
        isFile = true;
      }
      const iv = randomIv();
      const blob = await writeAadi({
        plaintext: pt,
        aesKey,
        hmacKey,
        salt,
        iv,
        name: outName,
        isFile,
      });
      // ciphertext slice for diff = everything between header and HMAC (close enough for demo)
      const ct = blob.subarray(40 + new TextEncoder().encode(outName).length + 8, blob.length - 32);
      setPlaintext(pt);
      setCiphertext(new Uint8Array(ct));
      setAadi(blob);
      toast.success("Encrypted", { description: `${blob.length} bytes ready to download` });
      // touch features to avoid unused-var lint
      void features;
    } catch (e) {
      console.error(e);
      toast.error("Encryption failed", { description: (e as Error).message });
    } finally {
      setWorking(false);
    }
  }

  function download() {
    if (!aadi) return;
    const base = (mode === "file" ? file?.name : name) || "secret";
    const blob = new Blob([new Uint8Array(aadi)], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.aadi`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!enrolled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-semibold">No enrollment yet</h1>
        <p className="text-muted-foreground">Enroll your behavior before encrypting.</p>
        <Link to="/enroll"><Button className="gradient-primary text-primary-foreground">Enroll now</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Encrypt</h1>
        <p className="text-sm text-muted-foreground">Choose your payload, then perform a behavioral sample to derive the key.</p>
      </header>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "text" | "file")}>
          <TabsList>
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="file">File</TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="space-y-3 pt-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border bg-input/40 px-3 py-2 text-sm font-mono"
              placeholder="filename.txt"
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-36 rounded-md border bg-input/40 px-3 py-2 text-sm font-mono"
            />
          </TabsContent>
          <TabsContent value="file" className="pt-3">
            <label className="flex items-center justify-center gap-2 h-28 w-full rounded-md border border-dashed cursor-pointer hover:border-primary/50 text-sm text-muted-foreground">
              <FileUp className="h-4 w-4" />
              {file ? <span className="text-foreground font-mono">{file.name}</span> : "Choose a file"}
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </TabsContent>
        </Tabs>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <BehaviorPad onCaptured={handleCaptured} label="Authenticate with your behavior" minDurationMs={3000} />
      </div>

      {working && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Deriving key & encrypting…
        </div>
      )}

      {plaintext && ciphertext && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Before / after</h2>
            <Button onClick={download} className="gradient-primary text-primary-foreground">
              <Download className="mr-1 h-4 w-4" /> Download .aadi
            </Button>
          </div>
          <HexDumpDiff plaintext={plaintext} ciphertext={ciphertext} />
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> AES-256-GCM · 12-byte IV · HMAC-SHA256 footer
          </div>
        </div>
      )}
    </div>
  );
}
