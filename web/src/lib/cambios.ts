import type { LineaTiempo, TramoBloqueado } from "./api";
import { motivoBloqueo } from "./texto";
import { aMin } from "./time";

export interface Cambio {
  hora: string;
  minuto: number;
  tipo: "bloqueo" | "reapertura" | "mixto";
  texto: string;
}

function relevantes(lista: TramoBloqueado[]): Map<string, string> {
  return new Map(lista.filter((b) => !b.motivo.includes("horizonte")).map((b) => [b.tramo_id, b.motivo]));
}

export function calcularCambios(linea: LineaTiempo): Cambio[] {
  if (linea.horas.length === 0) return [];
  const cambios: Cambio[] = [];
  let previo = relevantes(linea.horas[0].bloqueados);

  for (let i = 1; i < linea.horas.length; i++) {
    const { hora, bloqueados } = linea.horas[i];
    const actual = relevantes(bloqueados);
    const nuevos = [...actual].filter(([id]) => !previo.has(id));
    const reabiertos = [...previo.keys()].filter((id) => !actual.has(id));

    if (nuevos.length > 0 || reabiertos.length > 0) {
      const porMotivo = new Map<string, string[]>();
      for (const [id, motivo] of nuevos) {
        const clave = motivoBloqueo(motivo);
        porMotivo.set(clave, [...(porMotivo.get(clave) ?? []), id]);
      }
      const partes: string[] = [];
      for (const [motivo, ids] of porMotivo) {
        partes.push(`${ids.length === 1 ? "Se bloquea" : "Se bloquean"} ${ids.join(", ")} (${motivo.toLowerCase()})`);
      }
      if (reabiertos.length > 0) {
        partes.push(`${reabiertos.length === 1 ? "Se reabre" : "Se reabren"} ${reabiertos.join(", ")}`);
      }
      cambios.push({
        hora,
        minuto: aMin(hora),
        tipo: nuevos.length > 0 && reabiertos.length > 0 ? "mixto" : nuevos.length > 0 ? "bloqueo" : "reapertura",
        texto: partes.join("; "),
      });
    }
    previo = actual;
  }
  return cambios;
}

export function cambioEn(cambios: Cambio[], hora: string): Cambio | undefined {
  const m = aMin(hora);
  return cambios.find((c) => c.minuto === m);
}

export function cambioSiguiente(cambios: Cambio[], hora: string): Cambio | undefined {
  const m = aMin(hora);
  return cambios.find((c) => c.minuto > m);
}

export function cambioAnterior(cambios: Cambio[], hora: string): Cambio | undefined {
  const m = aMin(hora);
  return [...cambios].reverse().find((c) => c.minuto < m);
}
