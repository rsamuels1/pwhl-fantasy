"use client";

import { useEffect, useRef, useCallback } from "react";
import posthog from "posthog-js";

let initialized = false;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || initialized) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
    });
    initialized = true;
  }, []);

  return <>{children}</>;
}

export function useAnalytics() {
  const ready = useRef(false);

  useEffect(() => {
    ready.current = !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
  }, []);

  const capture = useCallback(
    (event: string, props?: Record<string, unknown>) => {
      if (!ready.current) return;
      try {
        posthog.capture(event, props);
      } catch {}
    },
    []
  );

  return { capture };
}
