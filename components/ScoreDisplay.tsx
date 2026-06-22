"use client";

import { useState, useEffect } from "react";

export function ScoreDisplay({ value, color }: { value: number; color: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
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
      {displayValue.toFixed(1)}
    </span>
  );
}
