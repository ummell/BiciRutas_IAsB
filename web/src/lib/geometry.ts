import type { Nodo, Tramo } from "./api";

export const NODE_R = 24;
const GAP = 5;
const PARALELO = 10;

export interface EdgeGeom {
  id: string;
  d: string;
  lx: number;
  ly: number;
  arco: boolean;
}

type P = { x: number; y: number };

function trim(from: P, toward: P, r: number): P {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / len) * r, y: from.y + (dy / len) * r };
}

export function buildEdges(nodos: Nodo[], tramos: Tramo[]): Record<string, EdgeGeom> {
  const pos = new Map<string, P>(nodos.map((n) => [n.id, { x: n.x, y: n.y }]));
  const hay = new Set(tramos.map((t) => `${t.origen}>${t.destino}`));
  const out: Record<string, EdgeGeom> = {};

  for (const t of tramos) {
    const a = pos.get(t.origen);
    const b = pos.get(t.destino);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 250) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const c = { x: mid.x, y: mid.y - dist * 0.3 };
      const p0 = trim(a, c, NODE_R + GAP);
      const p2 = trim(b, c, NODE_R + GAP + 3);
      out[t.id] = {
        id: t.id,
        d: `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`,
        lx: 0.25 * p0.x + 0.5 * c.x + 0.25 * p2.x,
        ly: 0.25 * p0.y + 0.5 * c.y + 0.25 * p2.y,
        arco: true,
      };
      continue;
    }

    const doble = hay.has(`${t.destino}>${t.origen}`);
    const len = dist || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const off = doble ? PARALELO : 0;
    const a2 = { x: a.x + nx * off, y: a.y + ny * off };
    const b2 = { x: b.x + nx * off, y: b.y + ny * off };
    const p0 = trim(a2, b2, NODE_R + GAP);
    const p2 = trim(b2, a2, NODE_R + GAP + 3);
    out[t.id] = {
      id: t.id,
      d: `M ${p0.x} ${p0.y} L ${p2.x} ${p2.y}`,
      lx: (p0.x + p2.x) / 2,
      ly: (p0.y + p2.y) / 2,
      arco: false,
    };
  }
  return out;
}
