import { useState } from "react";
import { ForecastPoint, ForecastBandPoint } from "../api";

interface Props {
  history: ForecastPoint[];
  forecast: ForecastBandPoint[];
  format: (n: number) => string; // y-axis + tooltip formatter
  color: string; // hex, e.g. "#0ea5e9"
}

type Node = {
  x: number;
  y: number;
  label: string;
  value: number;
  forecast: boolean;
  lower?: number;
  upper?: number;
};

// A small dependency-free SVG chart that draws actuals as a solid line and the
// projected periods as a dashed line with a shaded uncertainty band, split by a
// "now" divider. Used for both the revenue and new-customer forecasts.
export default function ForecastChart({ history, forecast, format, color }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const width = 520;
  const height = 210;
  const pl = 58;
  const pr = 12;
  const pt = 16;
  const pb = 28;
  const cw = width - pl - pr;
  const ch = height - pt - pb;

  const combined = [...history, ...forecast];
  const n = combined.length;
  if (n === 0) return <p className="py-12 text-center text-sm text-slate-400">Not enough data to forecast yet.</p>;

  const maxV =
    Math.max(
      ...history.map((h) => h.value),
      ...forecast.map((f) => f.upper),
      1
    ) * 1.1;

  const xAt = (i: number) => pl + (i / Math.max(n - 1, 1)) * cw;
  const yAt = (v: number) => height - pb - (v / maxV) * ch;

  const histLen = history.length;
  const nodes: Node[] = combined.map((p, i) => {
    const isF = i >= histLen;
    const band = isF ? (p as ForecastBandPoint) : null;
    return { x: xAt(i), y: yAt(p.value), label: p.label, value: p.value, forecast: isF, lower: band?.lower, upper: band?.upper };
  });

  const histNodes = nodes.slice(0, histLen);
  // Connect the dashed forecast line back to the last actual point for continuity.
  const fcNodes = histLen > 0 ? nodes.slice(histLen - 1) : nodes.slice(histLen);

  const toPath = (ns: Node[]) =>
    ns.length ? `M ${ns[0].x} ${ns[0].y} ` + ns.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ") : "";

  const histPath = toPath(histNodes);
  const fcPath = toPath(fcNodes);

  // Shaded band: upper edge left→right, lower edge right→left, anchored at the
  // last actual point so it visually grows out of "now".
  const bandNodes = fcNodes;
  let bandPath = "";
  if (bandNodes.length > 1) {
    const upper = bandNodes.map((p, i) => ({ x: p.x, y: yAt(i === 0 ? p.value : p.upper ?? p.value) }));
    const lower = bandNodes.map((p, i) => ({ x: p.x, y: yAt(i === 0 ? p.value : p.lower ?? p.value) }));
    bandPath =
      `M ${upper[0].x} ${upper[0].y} ` +
      upper.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ") +
      ` ` +
      [...lower].reverse().map((p) => `L ${p.x} ${p.y}`).join(" ") +
      " Z";
  }

  const dividerX = histLen > 0 ? xAt(histLen - 1) : pl;
  const yTicks = [0, 0.5, 1];

  return (
    <div className="relative h-52 w-full">
      <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* gridlines + y labels */}
        {yTicks.map((t, i) => {
          const y = height - pb - t * ch;
          return (
            <g key={i}>
              <line x1={pl} y1={y} x2={width - pr} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
              <text x={pl - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {format(t * maxV)}
              </text>
            </g>
          );
        })}

        {/* forecast region tint + now divider */}
        <rect x={dividerX} y={pt} width={width - pr - dividerX} height={ch} fill={color} opacity={0.03} />
        <line x1={dividerX} y1={pt} x2={dividerX} y2={height - pb} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
        <text x={dividerX + 4} y={pt + 9} fontSize="9" fill="#94a3b8">
          now
        </text>

        {bandPath && <path d={bandPath} fill={color} opacity={0.1} />}
        {histPath && <path d={histPath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {fcPath && (
          <path d={fcPath} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        )}

        {/* x labels (sparse) */}
        {nodes.map((p, i) => {
          const show = i % 3 === 0 || i === n - 1;
          if (!show) return null;
          return (
            <text key={i} x={p.x} y={height - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {p.label}
            </text>
          );
        })}

        {/* markers */}
        {nodes.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hover === i ? 5 : 2.8}
            fill={p.forecast ? "#ffffff" : color}
            stroke={color}
            strokeWidth="2"
            className="transition-all duration-150"
          />
        ))}

        {/* hover targets */}
        {nodes.map((p, i) => {
          const colW = cw / Math.max(n - 1, 1);
          return (
            <rect
              key={`h${i}`}
              x={p.x - colW / 2}
              y={0}
              width={colW}
              height={height}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>

      {hover !== null && nodes[hover] && (
        <div
          className="absolute z-10 rounded-lg bg-charcoal-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg pointer-events-none"
          style={{
            left: `${(nodes[hover].x / width) * 100}%`,
            top: `${(nodes[hover].y / height) * 100 - 30}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full h-0 w-0 border-x-4 border-x-transparent border-t-4 border-t-charcoal-900" />
          <p className="font-semibold text-slate-300">
            {nodes[hover].label}
            {nodes[hover].forecast && <span className="ml-1 text-[9px] uppercase text-slate-500">proj.</span>}
          </p>
          <p className="mt-0.5 font-bold" style={{ color }}>
            {format(nodes[hover].value)}
          </p>
          {nodes[hover].forecast && nodes[hover].lower !== undefined && (
            <p className="text-[10px] text-slate-400">
              {format(nodes[hover].lower!)} – {format(nodes[hover].upper!)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
