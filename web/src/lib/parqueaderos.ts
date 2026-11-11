import type { Tramo } from "./api";

export interface Parqueadero {
  nodo: string;
  nombre: string;
  cupos: number;
  horario: string;
}

export const PARQUEADEROS: Parqueadero[] = [
  { nodo: "N04", nombre: "Bici-parqueadero Mercado Central", cupos: 24, horario: "06:00–22:00" },
  { nodo: "N08", nombre: "Bici-parqueadero Centro Cultural", cupos: 16, horario: "07:00–21:00" },
];

export function parqueaderoMasCercano(
  desde: string,
  tramos: Tramo[],
  lista: Parqueadero[] = PARQUEADEROS,
): { parqueadero: Parqueadero; metros: number } | null {
  const dist = new Map<string, number>([[desde, 0]]);
  const pendientes = new Set([desde]);
  const hecho = new Set<string>();
  while (pendientes.size) {
    let actual = "";
    for (const n of pendientes) if (!actual || dist.get(n)! < dist.get(actual)!) actual = n;
    pendientes.delete(actual);
    hecho.add(actual);
    for (const t of tramos) {
      if (t.origen !== actual || t.tipo === "via_no_habilitada" || hecho.has(t.destino)) continue;
      const d = dist.get(actual)! + t.distancia_m;
      if (d < (dist.get(t.destino) ?? Infinity)) {
        dist.set(t.destino, d);
        pendientes.add(t.destino);
      }
    }
  }
  let mejor: { parqueadero: Parqueadero; metros: number } | null = null;
  for (const p of lista) {
    const d = dist.get(p.nodo);
    if (p.nodo === desde || d === undefined) continue;
    if (!mejor || d < mejor.metros) mejor = { parqueadero: p, metros: d };
  }
  return mejor;
}
