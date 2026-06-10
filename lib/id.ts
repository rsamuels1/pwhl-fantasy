/**
 * Generate a short, human-readable ID from a name.
 * Example: "PWHL Fantasy League" -> "pwhl-fantasy-abc1"
 */
export function generateShortId(name: string): string {
  // Slugify: lowercase, remove special chars, replace spaces with hyphens
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove special characters
    .replace(/\s+/g, "-") // replace spaces with hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim hyphens from start/end

  // Limit slug length to 12 chars
  const truncated = slug.slice(0, 12);

  // Generate random suffix (4 chars: 2 letters + 2 numbers)
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${truncated}-${suffix}`.slice(0, 20); // max 20 chars total
}
