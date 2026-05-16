import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const STEPS = [
  { to: "/enroll", label: "Enroll" },
  { to: "/encrypt", label: "Encrypt" },
  { to: "/decrypt", label: "Decrypt" },
] as const;

export function OnboardingStepper() {
  const loc = useLocation();
  const idx = STEPS.findIndex((s) => loc.pathname.startsWith(s.to));
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const active = i === idx;
        const done = idx > i;
        return (
          <div key={s.to} className="flex items-center gap-2">
            <Link
              to={s.to}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                active && "bg-primary/15 text-primary border border-primary/40",
                done && !active && "text-accent",
                !active && !done && "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono",
                  active ? "bg-primary text-primary-foreground" : done ? "bg-accent text-accent-foreground" : "bg-muted",
                )}
              >
                {i + 1}
              </span>
              {s.label}
            </Link>
            {i < STEPS.length - 1 && <span className="text-muted-foreground/40">›</span>}
          </div>
        );
      })}
    </div>
  );
}
