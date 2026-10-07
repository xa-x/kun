import { NODE_TYPES } from "@/lib/nodes";

const W = 240;
const H = 112;
const NODE_W = 58;
const NODE_H = 32;

type Cat = "input" | "ai" | "output";
const ORDER: Cat[] = ["input", "ai", "output"];

interface Placed {
  x: number;
  y: number;
  color: string;
}

/**
 * A schematic of a workbook's shape (inputs, then AI steps, then outputs) built
 * from the node kinds it contains. It is a summary of structure, not a
 * screenshot: the library API returns kinds, not positions.
 */
export function BookCover({ kinds }: { kinds: string[] }) {
  const defs = kinds
    .map((k) => NODE_TYPES.find((d) => d.type === k))
    .filter((d): d is NonNullable<typeof d> => !!d);

  const columns = ORDER.map((cat) =>
    defs.filter((d) => d.category === cat).slice(0, 3),
  ).filter((c) => c.length > 0);

  if (!columns.length) {
    return (
      <div className="flex h-full items-center justify-center" aria-hidden>
        <div className="flex h-[54px] w-[88px] items-center justify-center rounded-xl border border-dashed border-line2 text-[11px] text-faint">
          Empty
        </div>
      </div>
    );
  }

  const gap = columns.length > 1 ? (W - 56 - NODE_W) / (columns.length - 1) : 0;
  const placed: Placed[][] = columns.map((col, ci) => {
    const x = columns.length > 1 ? 28 + ci * gap : (W - NODE_W) / 2;
    const rowGap = 10;
    const total = col.length * NODE_H + (col.length - 1) * rowGap;
    const top = (H - total) / 2;
    return col.map((d, ri) => ({
      x,
      y: top + ri * (NODE_H + rowGap),
      color: d.color,
    }));
  });

  const wires: { d: string; color: string }[] = [];
  for (let c = 0; c < placed.length - 1; c++) {
    for (const a of placed[c]) {
      for (const b of placed[c + 1]) {
        const x1 = a.x + NODE_W;
        const y1 = a.y + NODE_H / 2;
        const x2 = b.x;
        const y2 = b.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        wires.push({
          d: `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`,
          color: a.color,
        });
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      role="img"
      aria-label={`Contains ${defs.map((d) => d.label).join(", ")}`}
    >
      {wires.map((w, i) => (
        <path
          key={i}
          d={w.d}
          fill="none"
          stroke={w.color}
          strokeOpacity={0.55}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      {placed.flat().map((n, i) => (
        <g key={i}>
          <rect
            x={n.x}
            y={n.y}
            width={NODE_W}
            height={NODE_H}
            rx={6}
            fill="var(--color-card)"
            stroke="var(--color-line2)"
          />
          <rect
            x={n.x + 7}
            y={n.y + 8}
            width={16}
            height={16}
            rx={5}
            fill={n.color}
            fillOpacity={0.9}
          />
          <rect
            x={n.x + 29}
            y={n.y + 11}
            width={22}
            height={3.5}
            rx={1.75}
            fill="var(--color-line2)"
          />
          <rect
            x={n.x + 29}
            y={n.y + 18}
            width={14}
            height={3.5}
            rx={1.75}
            fill="var(--color-line)"
          />
        </g>
      ))}
    </svg>
  );
}
