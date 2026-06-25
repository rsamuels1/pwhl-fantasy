"use client";

import { useEffect } from "react";

interface Props {
  /** The element id to scroll to and briefly highlight. */
  targetId: string;
  /** The focus param value from the URL. Highlight fires only when this === targetId. */
  focus?: string;
}

/**
 * Invisible client component. When `focus === targetId`, scrolls the target element
 * into view and applies a 2-second amber-border pulse animation.
 *
 * Usage: place anywhere in the server component; the element with `id={targetId}`
 * can be anywhere in the DOM.
 */
export default function FocusHighlight({ targetId, focus }: Props) {
  useEffect(() => {
    if (focus !== targetId) return;
    const el = document.getElementById(targetId);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "start" });

    // Amber pulse: add a class, then remove it after 2 s
    el.classList.add("focus-highlight-pulse");
    const timer = setTimeout(() => {
      el.classList.remove("focus-highlight-pulse");
    }, 2000);
    return () => clearTimeout(timer);
  }, [focus, targetId]);

  return null;
}
