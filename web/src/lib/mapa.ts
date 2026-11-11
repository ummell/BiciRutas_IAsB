import type { Nodo, Tramo } from "./api";

export type P = { x: number; y: number };
export type Caja = { x: number; y: number; w: number; h: number };

export interface Paleta {
  tierra: string;
  manzana: string;
  calleMenor: string;
  parque: string;
  arbol: string;
  agua: string;
  bordeVia: string;
  via: string;
  viaNoHab: string;
  bordeViaNoHab: string;
  ciclo: string;
  flecha: string;
  texto: string;
  textoSuave: string;
  halo: string;
  textoAgua: string;
  punto: string;
  bordeRuta: string;
  noche: boolean;
}

export const MARCA = {
  bosque: "#193a27",
  bosque900: "#0f2318",
  bosque600: "#2f7a4b",
  bosque100: "#e3ece5",
  rueda: "#e07a2b",
  rueda700: "#a34e16",
  rueda100: "#fcebdd",
  salvia: "#667f63",
  bloqueado: "#b5322a",
};

export const DIA: Paleta = {
  tierra: "#f4f1ea",
  manzana: "#e9e4d8",
  calleMenor: "#f9f7f2",
  parque: "#dde6d8",
  arbol: "#a9bba6",
  agua: "#bfd9d2",
  bordeVia: "#d6cfbf",
  via: "#ffffff",
  viaNoHab: "#d9d3c4",
  bordeViaNoHab: "#c4bca9",
  ciclo: "#667f63",
  flecha: "#566259",
  texto: "#193a27",
  textoSuave: "#566259",
  halo: "#f4f1ea",
  textoAgua: "#667f63",
  punto: "#667f63",
  bordeRuta: "#193a27",
  noche: false,
};

export const NOCHE: Paleta = {
  tierra: "#0f2318",
  manzana: "#16301f",
  calleMenor: "#132a1c",
  parque: "#1c3a28",
  arbol: "#2b5038",
  agua: "#0b1a14",
  bordeVia: "#0a1a10",
  via: "#2c4a37",
  viaNoHab: "#23392b",
  bordeViaNoHab: "#0a1a10",
  ciclo: "#8fb08a",
  flecha: "#a9bba6",
  texto: "#ede8dc",
  textoSuave: "#a9bba6",
  halo: "#0f2318",
  textoAgua: "#8fb08a",
  punto: "#a9bba6",
  bordeRuta: "#0a1a10",
  noche: true,
};

export const TRAFICO = {
  fluido: "#2f7a4b",
  lento: "#c9962a",
  denso: "#b5322a",
  saturado: "#6e1e1a",
};

export function colorTrafico(relacion: number): string {
  if (relacion > 1.25) return TRAFICO.saturado;
  if (relacion > 1) return TRAFICO.denso;
  if (relacion > 0.7) return TRAFICO.lento;
  return TRAFICO.fluido;
}

export const TIPO_TRAMO: Record<string, string> = {
  ciclorruta: "Ciclorruta",
  via_mixta: "Vía mixta",
  via_no_habilitada: "Vía no habilitada",
};

export interface Via {
  id: string;
  d: string;
  a: P;
  b: P;
  medio: P;
  angulo: number;
  arco: boolean;
  doble: boolean;
}

const CARRIL = 5.5;

export function construirVias(nodos: Nodo[], tramos: Tramo[]): Record<string, Via> {
  const pos = new Map<string, P>(nodos.map((n) => [n.id, { x: n.x, y: n.y }]));
  const hay = new Set(tramos.map((t) => `${t.origen}>${t.destino}`));
  const out: Record<string, Via> = {};
  for (const t of tramos) {
    const a0 = pos.get(t.origen);
    const b0 = pos.get(t.destino);
    if (!a0 || !b0) continue;
    const dx = b0.x - a0.x;
    const dy = b0.y - a0.y;
    const dist = Math.hypot(dx, dy) || 1;
    const angulo = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (dist > 250) {
      const c = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 - dist * 0.3 };
      out[t.id] = {
        id: t.id,
        d: `M ${a0.x} ${a0.y} Q ${c.x} ${c.y} ${b0.x} ${b0.y}`,
        a: a0,
        b: b0,
        medio: { x: 0.25 * a0.x + 0.5 * c.x + 0.25 * b0.x, y: 0.25 * a0.y + 0.5 * c.y + 0.25 * b0.y },
        angulo,
        arco: true,
        doble: false,
      };
      continue;
    }
    const doble = hay.has(`${t.destino}>${t.origen}`);
    const off = doble ? CARRIL : 0;
    const nx = (-dy / dist) * off;
    const ny = (dx / dist) * off;
    const a = { x: a0.x + nx, y: a0.y + ny };
    const b = { x: b0.x + nx, y: b0.y + ny };
    out[t.id] = {
      id: t.id,
      d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
      a,
      b,
      medio: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      angulo,
      arco: false,
      doble,
    };
  }
  return out;
}

export function metrosPorUnidad(nodos: Nodo[], tramos: Tramo[]): number {
  const pos = new Map(nodos.map((n) => [n.id, n]));
  const r = tramos
    .map((t) => {
      const a = pos.get(t.origen);
      const b = pos.get(t.destino);
      if (!a || !b) return 0;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      return d > 0 && d <= 250 ? t.distancia_m / d : 0;
    })
    .filter((v) => v > 0)
    .sort((x, y) => x - y);
  return r.length ? r[Math.floor(r.length / 2)] : 1;
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export interface Manzana {
  x: number;
  y: number;
  w: number;
  h: number;
  tipo: "manzana" | "parque";
}
export interface Lago {
  d: string;
  cx: number;
  cy: number;
  nombre: string;
}
export interface Fondo {
  limites: Caja;
  manzanas: Manzana[];
  lagos: Lago[];
  callesX: number[];
  callesY: number[];
}

const VERDE = /(^|\s)(parque|jard[ií]n|alameda|bosque|verde)(\s|$)/i;
const AGUA = /(^|\s)(lago|laguna|r[ií]o|humedal)(\s|$)/i;

export function construirFondo(nodos: Nodo[]): Fondo {
  const xs = [...new Set(nodos.map((n) => n.x))].sort((a, b) => a - b);
  const ys = [...new Set(nodos.map((n) => n.y))].sort((a, b) => a - b);
  const paso = (v: number[]) => (v.length > 1 ? Math.min(...v.slice(1).map((x, i) => x - v[i])) : 150);
  const px = paso(xs);
  const py = paso(ys);
  const gx = [xs[0] - 2 * px, xs[0] - px, ...xs, xs[xs.length - 1] + px, xs[xs.length - 1] + 2 * px];
  const gy = [ys[0] - 2 * py, ys[0] - py, ...ys, ys[ys.length - 1] + py, ys[ys.length - 1] + 2 * py];

  const celdaDe = (x: number, y: number) => {
    const i = gx.findIndex((v, k) => k < gx.length - 1 && x >= v && x < gx[k + 1]);
    const j = gy.findIndex((v, k) => k < gy.length - 1 && y >= v && y < gy[k + 1]);
    return `${i},${j}`;
  };
  const parques = new Set<string>();
  const lagosCeldas = new Map<string, string>();
  for (const n of nodos) {
    if (AGUA.test(n.nombre)) lagosCeldas.set(celdaDe(n.x - 1, n.y + 1), n.nombre);
    else if (VERDE.test(n.nombre)) parques.add(celdaDe(n.x + 1, n.y + 1));
  }

  const manzanas: Manzana[] = [];
  const lagos: Lago[] = [];
  const M = 9;
  for (let i = 0; i < gx.length - 1; i++) {
    for (let j = 0; j < gy.length - 1; j++) {
      const x = gx[i] + M;
      const y = gy[j] + M;
      const w = gx[i + 1] - gx[i] - 2 * M;
      const h = gy[j + 1] - gy[j] - 2 * M;
      const clave = `${i},${j}`;
      const lago = lagosCeldas.get(clave);
      if (lago) {
        const cx = x + w / 2;
        const cy = y + h / 2 + h * 0.15;
        const rx = w * 0.62;
        const ry = h * 0.55;
        lagos.push({
          cx,
          cy,
          nombre: /lago/i.test(lago) ? "Lago" : lago,
          d: `M ${cx - rx} ${cy} C ${cx - rx} ${cy - ry * 1.2}, ${cx + rx * 0.2} ${cy - ry * 1.15}, ${cx + rx * 0.75} ${cy - ry * 0.55}
              C ${cx + rx * 1.15} ${cy - ry * 0.1}, ${cx + rx * 0.9} ${cy + ry * 1.05}, ${cx + rx * 0.1} ${cy + ry * 0.95}
              C ${cx - rx * 0.6} ${cy + ry * 0.9}, ${cx - rx} ${cy + ry * 0.6}, ${cx - rx} ${cy} Z`,
        });
        manzanas.push({ x, y, w, h, tipo: "parque" });
        continue;
      }
      if (parques.has(clave)) {
        manzanas.push({ x, y, w, h, tipo: "parque" });
        continue;
      }
      const r = hash(i * 31 + j * 7);
      if (r < 0.35) {
        manzanas.push({ x, y, w, h, tipo: "manzana" });
      } else if (r < 0.7) {
        const mw = (w - 6) / 2;
        manzanas.push({ x, y, w: mw, h, tipo: "manzana" }, { x: x + mw + 6, y, w: mw, h, tipo: "manzana" });
      } else {
        const mw = (w - 6) / 2;
        const mh = (h - 6) / 2;
        for (const [a, b] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          const verde = hash(i * 13 + j * 17 + a * 3 + b * 5) > 0.93;
          manzanas.push({ x: x + a * (mw + 6), y: y + b * (mh + 6), w: mw, h: mh, tipo: verde ? "parque" : "manzana" });
        }
      }
    }
  }
  return {
    limites: { x: gx[0], y: gy[0], w: gx[gx.length - 1] - gx[0], h: gy[gy.length - 1] - gy[0] },
    manzanas,
    lagos,
    callesX: gx,
    callesY: gy,
  };
}

export function cajaDe(puntos: P[], margen = 0): Caja {
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const x = Math.min(...xs) - margen;
  const y = Math.min(...ys) - margen;
  return { x, y, w: Math.max(...xs) + margen - x, h: Math.max(...ys) + margen - y };
}

export function encuadrar(
  caja: Caja,
  ancho: number,
  alto: number,
  izquierda: number,
  derecha = 150,
  arriba = 15,
  abajo = 75,
): Caja {
  const util = Math.max(ancho - izquierda - derecha, 200);
  const utilAlto = Math.max(alto - arriba - abajo, 200);
  const s = Math.max(caja.w / util, caja.h / utilAlto);
  const w = ancho * s;
  const h = alto * s;
  const cx = caja.x + caja.w / 2;
  const cy = caja.y + caja.h / 2;
  return { x: cx - (izquierda + util / 2) * s, y: cy - (arriba + (alto - arriba - abajo) / 2) * s, w, h };
}

export function escalaBonita(metrosPorPx: number): { metros: number; px: number } {
  const opciones = [25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  for (const m of opciones) {
    const px = m / metrosPorPx;
    if (px >= 56) return { metros: m, px };
  }
  const m = opciones[opciones.length - 1];
  return { metros: m, px: m / metrosPorPx };
}

export function formatoDistancia(m: number): string {
  return m >= 1000 ? `${(m / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} km` : `${m} m`;
}

export function partirNombre(nombre: string, maximo = 13): string[] {
  const palabras = nombre.split(" ");
  if (nombre.length <= maximo || palabras.length < 2) return [nombre];
  let mejor: string[] = [nombre];
  let largoMejor = Infinity;
  for (let i = 1; i < palabras.length; i++) {
    const lineas = [palabras.slice(0, i).join(" "), palabras.slice(i).join(" ")];
    const largo = Math.max(lineas[0].length, lineas[1].length);
    if (largo < largoMejor) {
      mejor = lineas;
      largoMejor = largo;
    }
  }
  return mejor;
}
