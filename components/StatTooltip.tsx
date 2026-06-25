// Server component — no "use client" needed. Renders an <abbr> with a tooltip title.
export default function StatTooltip({ abbr, title }: { abbr: string; title: string }) {
  return (
    <abbr
      title={title}
      style={{
        textDecoration: "underline dotted",
        textDecorationColor: "var(--faint)",
        textUnderlineOffset: 3,
        cursor: "help",
        fontStyle: "normal",
      }}
    >
      {abbr}
    </abbr>
  );
}
