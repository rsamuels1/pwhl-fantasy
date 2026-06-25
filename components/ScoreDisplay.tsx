"use client";

import { useState, useEffect } from "react";

export function ScoreDisplay({ value, color }: { value: number; color: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }

    // Skip animation for users who prefer reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    const startTime = Date.now();
    const duration = 1200; // 1.2 seconds
    let animationId: NodeJS.Timeout;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayValue(Math.round(value * progress * 10) / 10);

      if (progress < 1) {
        animationId = setTimeout(animate, 16); // ~60fps
      }
    };

    animate();
    return () => clearTimeout(animationId);
  }, [value]);

  return (
    <span style={{ color }}>
      {/* Intermediate animated values hidden from AT */}
      <span aria-hidden="true">{displayValue.toFixed(1)}</span>
      {/* Final value always readable by screen readers */}
      <span className="visually-hidden">{value.toFixed(1)}</span>
    </span>
  );
}
