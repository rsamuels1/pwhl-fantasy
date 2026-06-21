import React from "react";

interface LogoShieldProps {
  size?: number;
}

export function LogoShield({ size = 34 }: LogoShieldProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="pwhl-shield-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#4c1d95" />
        </linearGradient>
      </defs>
      <path
        d="M24 3 L41 9.5 V25 C41 36 24 45 24 45 C24 45 7 36 7 25 V9.5 Z"
        fill="url(#pwhl-shield-grad)"
        stroke="rgba(167,139,250,0.55)"
        strokeWidth="1.2"
      />
      <path
        d="M14 14 L30 8.5"
        stroke="rgba(199,210,224,0.45)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M11 22 L24 17"
        stroke="rgba(167,139,250,0.55)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M24 30 L37 21"
        stroke="rgba(199,210,224,0.35)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LogoWordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
      <LogoShield size={34} />
      <span style={{
        fontWeight: 800,
        fontSize: 15,
        letterSpacing: "0.05em",
        color: "#f3f5fb",
        lineHeight: 1.2,
      }}>
        PWHL GM
      </span>
    </div>
  );
}
