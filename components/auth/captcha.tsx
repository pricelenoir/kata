"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import Script from "next/script";

// Cloudflare Turnstile, passed to Supabase Auth as `captchaToken`. Inert
// unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set — and the matching secret
// must be enabled under Authentication > Bot and Abuse Protection, or
// Supabase will ignore (or, the other way round, demand) the token.

export const CAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface TurnstileApi {
  render(el: HTMLElement, opts: { sitekey: string; theme: "dark"; callback: (token: string) => void; "expired-callback": () => void }): string;
  reset(id: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface CaptchaHandle {
  /** Tokens are single-use: reset after every auth attempt. */
  reset(): void;
}

export function Captcha({ onToken, ref }: { onToken: (token: string | null) => void; ref?: Ref<CaptchaHandle> }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  const mount = () => {
    if (!CAPTCHA_SITE_KEY || !window.turnstile || !container.current || widget.current) return;
    widget.current = window.turnstile.render(container.current, {
      sitekey: CAPTCHA_SITE_KEY,
      theme: "dark",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
    });
  };

  useEffect(() => {
    mount();
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widget.current) window.turnstile?.reset(widget.current);
      onTokenRef.current(null);
    },
  }));

  if (!CAPTCHA_SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={mount} />
      <div ref={container} className="min-h-[65px]" />
    </>
  );
}
