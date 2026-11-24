// Renders the app icons into public/ and app/ (run once: npx tsx scripts/make-icons.tsx).
// Carnelian square, white plate, carnelian check: "food that fits". Glyph stays inside the
// maskable safe zone (central 80% circle) so Android can crop it to any shape.
import { writeFileSync } from "node:fs";
import { ImageResponse } from "next/og";

function Icon({ size }: { size: number }) {
  const plate = size * 0.58;
  return (
    <div style={{ width: size, height: size, background: "#B31B1B", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: plate, height: plate, borderRadius: plate, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={plate * 0.66} height={plate * 0.66} viewBox="0 0 24 24">
          <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#B31B1B" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

const out: [string, number][] = [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["app/apple-icon.png", 180],
  ["app/icon.png", 64],
];
async function main() {
  for (const [path, size] of out) {
    const png = Buffer.from(await new ImageResponse(<Icon size={size} />, { width: size, height: size }).arrayBuffer());
    writeFileSync(path, png);
    console.log(path, png.length, "bytes");
  }
}
void main();
