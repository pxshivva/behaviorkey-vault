import { useMemo } from "react";

function toHexRows(bytes: Uint8Array, max = 256): string[] {
  const slice = bytes.subarray(0, max);
  const rows: string[] = [];
  for (let i = 0; i < slice.length; i += 16) {
    const chunk = slice.subarray(i, i + 16);
    const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const off = i.toString(16).padStart(6, "0");
    rows.push(`${off}  ${hex}`);
  }
  return rows;
}

export function HexDumpDiff({ plaintext, ciphertext }: { plaintext: Uint8Array; ciphertext: Uint8Array }) {
  const left = useMemo(() => toHexRows(plaintext), [plaintext]);
  const right = useMemo(() => toHexRows(ciphertext), [ciphertext]);
  const rows = Math.max(left.length, right.length);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Panel title="Plaintext" rows={left} totalRows={rows} tone="muted" />
      <Panel title="Encrypted" rows={right} totalRows={rows} tone="primary" />
    </div>
  );
}

function Panel({ title, rows, totalRows, tone }: { title: string; rows: string[]; totalRows: number; tone: "muted" | "primary" }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className={`px-3 py-1.5 text-xs uppercase tracking-wider border-b ${tone === "primary" ? "text-accent" : "text-muted-foreground"}`}>
        {title}
      </div>
      <pre className="hex-dump p-3 max-h-72 overflow-auto text-foreground/90">
        {Array.from({ length: totalRows }).map((_, i) => rows[i] ?? "").join("\n")}
      </pre>
    </div>
  );
}
