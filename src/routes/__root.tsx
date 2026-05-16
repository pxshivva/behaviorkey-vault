import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { FingerprintCanvas } from "@/components/FingerprintCanvas";
import { OnboardingStepper } from "@/components/OnboardingStepper";
import { ShieldCheck } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex gap-2 justify-center">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BehaviorKey Vault — Encrypt with your behavior" },
      { name: "description", content: "Derive AES-256-GCM keys from your mouse and typing rhythm. Encrypt files into the .aadi format — entirely in your browser." },
      { property: "og:title", content: "BehaviorKey Vault — Encrypt with your behavior" },
      { property: "og:description", content: "Derive AES-256-GCM keys from your mouse and typing rhythm. Encrypt files into the .aadi format — entirely in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "BehaviorKey Vault — Encrypt with your behavior" },
      { name: "twitter:description", content: "Derive AES-256-GCM keys from your mouse and typing rhythm. Encrypt files into the .aadi format — entirely in your browser." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/be46a96c-550a-4ff7-a1ff-da5f797a2a6c/id-preview-57f59782--1b90e759-dd8c-4d2f-99c5-e8ccd156390c.lovable.app-1778909323920.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/be46a96c-550a-4ff7-a1ff-da5f797a2a6c/id-preview-57f59782--1b90e759-dd8c-4d2f-99c5-e8ccd156390c.lovable.app-1778909323920.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md gradient-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span className="tracking-tight">BehaviorKey <span className="text-gradient">Vault</span></span>
            </Link>
            <div className="hidden sm:block flex-1">
              <FingerprintCanvas height={44} />
            </div>
            <div className="hidden md:block">
              <OnboardingStepper />
            </div>
            <Link
              to="/demo"
              className="text-xs rounded-md border border-accent/40 text-accent px-2 py-1 hover:bg-accent/10"
            >
              Demo
            </Link>
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="border-t py-4 text-center text-xs text-muted-foreground">
          Runs entirely in your browser · Web Crypto · AES-256-GCM · PBKDF2-SHA256
        </footer>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
