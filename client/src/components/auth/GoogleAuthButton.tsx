import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type GoogleAuthButtonProps = {
  onCredential: (credential: string) => void;
  disabled?: boolean;
  text?: "signin_with" | "signup_with" | "continue_with";
};

const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export function GoogleAuthButton({
  onCredential,
  disabled = false,
  text = "continue_with",
}: GoogleAuthButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCredentialRef = useRef(onCredential);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error" | "unconfigured">(
    "idle",
  );

  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId) {
      setStatus("unconfigured");
      return;
    }

    let active = true;
    setStatus("loading");

    void loadGoogleScript()
      .then(() => {
        const googleIdentity = window.google?.accounts?.id;
        const target = containerRef.current;

        if (!active || !googleIdentity || !target) {
          return;
        }

        googleIdentity.initialize({
          client_id: clientId,
          callback: (response) => {
            const credential = response.credential?.trim();
            if (!credential || disabled) {
              return;
            }
            onCredentialRef.current(credential);
          },
        });

        target.innerHTML = "";
        googleIdentity.renderButton(target, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text,
          logo_alignment: "left",
          width: Math.max(220, Math.floor(target.clientWidth || 220)),
        });

        if (active) {
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });

    return () => {
      active = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [clientId, disabled, text]);

  if (status === "unconfigured") {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Google sign-in will appear after `VITE_GOOGLE_CLIENT_ID` is configured.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border/60 bg-background/70 p-1",
          status === "loading" && "min-h-12",
        )}
      >
        <div ref={containerRef} className="flex min-h-10 items-center justify-center" />
        {status === "loading" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {disabled ? <div className="absolute inset-0 rounded-xl bg-background/55" /> : null}
      </div>

      {status === "error" ? (
        <p className="text-center text-xs text-muted-foreground">
          Google sign-in could not load. Check the client ID and allowed origins.
        </p>
      ) : null}
    </div>
  );
}
