import type { Estado, EtiquetaOpcion, Metricas, Red, Viaje } from "./api";

const MOTIVOS: Record<string, string> = {
  cierre_por_obras: "Cierre por obras",
  cierre_total: "Cierre total",
  riesgo_vial_alto: "Riesgo vial alto",
  riesgo_seguridad_personal: "Riesgo de seguridad personal",
  no_habilitado_bicicletas: "No habilitado para bicicletas",
};

export function motivoRestriccion(codigo: string): string {
  return MOTIVOS[codigo] ?? codigo;
}

export function motivoBloqueo(msg: string | null): string {
  if (!msg) return "";
  if (msg.startsWith("Restricción ")) {
    const codigo = msg.slice("Restricción ".length).split(":")[0];
    return motivoRestriccion(codigo);
  }
  if (msg.startsWith("Sin iluminación")) return "Sin iluminación en horario nocturno";
  if (msg.startsWith("Tramo no habilitado")) return "No habilitado para bicicletas";
  if (msg.includes("horizonte")) return "Fuera del horizonte de la simulación";
  return msg;
}

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  A_TIEMPO: "A tiempo",
  TARDE: "Llega tarde",
  SIN_RUTA_SEGURA: "Sin ruta segura",
};

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function nivelCongestion(n: number): string {
  if (n === 0) return "Sin congestión";
  if (n <= 3) return "Moderada";
  return "Alta";
}

export const ETIQUETA_OPCION: Record<EtiquetaOpcion, string> = {
  recomendada: "Recomendada",
  mas_rapida: "Más rápida",
  menos_congestion: "Menos congestión",
};

export const veces = (n: number) => `${n.toFixed(1).replace(".", ",")}×`;

export function explicarLote(ref: Metricas, eq: Metricas): { sobrecarga: string; costos: string[] } {
  const r = ref.sobrecarga_acumulada_bici_intervalo;
  const e = eq.sobrecarga_acumulada_bici_intervalo;
  const sinViajes = eq.viajes_a_tiempo + eq.viajes_tarde === 0 && eq.viajes_sin_ruta_segura > 0;
  const sobrecarga = sinViajes
    ? "Ningún viaje tiene ruta segura, así que no hay carga que repartir: 0 es el resultado esperado."
    : r === 0 && e === 0
      ? "Ningún tramo supera su capacidad, ni con ni sin estrategia."
      : e === 0
        ? "0 significa que, con la estrategia, ningún tramo supera su capacidad en ningún intervalo de 5 min."
        : `Quedan ${e} bici-intervalos por encima de la capacidad; sin estrategia eran ${r}.`;

  const costos: string[] = [];
  if (eq.pares_saturados > ref.pares_saturados) {
    costos.push(
      `Hay más pares saturados (${ref.pares_saturados} → ${eq.pares_saturados}) porque la carga se reparte en más tramos, cada uno mucho menos cargado: el tramo más cargado baja de ${veces(ref.maxima_relacion_carga_capacidad)} a ${veces(eq.maxima_relacion_carga_capacidad)} su capacidad.`,
    );
  }
  const tarde = eq.viajes_tarde - ref.viajes_tarde;
  if (tarde > 0) {
    costos.push(
      `${plural(tarde, "viaje más llega", "viajes más llegan")} tarde (${eq.minutos_totales_tardanza} min de tardanza en total): el reto prioriza bajar la congestión del conjunto. Mueve «Qué pesa más» hacia la puntualidad para reducirlos.`,
    );
  } else if (eq.minutos_totales_viaje > ref.minutos_totales_viaje && eq.viajes_tarde === 0) {
    costos.push(
      `Repartir la demanda cuesta ${eq.minutos_totales_viaje - ref.minutos_totales_viaje} min de viaje más en total, sin que nadie llegue tarde.`,
    );
  }
  if (
    !costos.length &&
    e < r &&
    eq.minutos_totales_viaje <= ref.minutos_totales_viaje &&
    eq.minutos_totales_tardanza <= ref.minutos_totales_tardanza
  ) {
    costos.push("Repartir no cuesta minutos de viaje ni tardanza.");
  }
  return { sobrecarga, costos };
}

const MODALIDAD: Record<string, string> = { propia: "bici propia", publica: "bici pública" };

const mismoViaje = (a: Viaje, b: Viaje) =>
  a.origen === b.origen &&
  a.destino === b.destino &&
  a.salida_desde === b.salida_desde &&
  a.salida_hasta === b.salida_hasta &&
  a.llegada_limite === b.llegada_limite;

const iguales = (viajes: Viaje[]) => viajes.length > 1 && viajes.every((v) => mismoViaje(v, viajes[0]));

export function resumenViajes(viajes: Viaje[], nombre: (id: string) => string): string | null {
  if (!iguales(viajes)) return null;
  const v = viajes[0];
  return `Los ${viajes.length} viajes de este escenario van de ${nombre(v.origen)} a ${nombre(v.destino)}, salen entre ${v.salida_desde} y ${v.salida_hasta} y deben llegar antes de las ${v.llegada_limite}. Solo cambia la modalidad: el escenario prueba qué pasa cuando muchos ciclistas piden la misma ruta.`;
}

export function etiquetaViaje(v: Viaje, viajes: Viaje[]): string {
  const modalidad = MODALIDAD[v.modalidad] ?? v.modalidad;
  if (iguales(viajes)) return `${v.id} · ${modalidad}`;
  return `${v.id} · ${v.origen} → ${v.destino} · ${v.salida_desde}–${v.salida_hasta} · ${modalidad}`;
}

export interface FilaRestriccion {
  tramo: string;
  sentido: string;
  motivo: string;
}

export function restriccionesDelEscenario(red: Pick<Red, "config" | "tramos" | "restricciones">): FilaRestriccion[] {
  const tramos = new Map(red.tramos.map((t) => [t.id, t]));
  const sentido = (id: string) => {
    const t = tramos.get(id);
    return t ? `${t.origen} → ${t.destino}` : "";
  };
  const filas: FilaRestriccion[] = [];
  for (const t of red.tramos) {
    if (!t.iluminado) {
      filas.push({ tramo: t.id, sentido: sentido(t.id), motivo: `Sin iluminación de ${red.config.inicio_noche} a ${red.config.fin_noche}` });
    }
  }
  for (const r of red.restricciones) {
    const motivo =
      r.motivo === "no_habilitado_bicicletas"
        ? motivoRestriccion(r.motivo)
        : `${motivoRestriccion(r.motivo)} de ${r.inicio} a ${r.fin}`;
    filas.push({ tramo: r.tramo_id, sentido: sentido(r.tramo_id), motivo });
  }
  const noHabilitado = motivoRestriccion("no_habilitado_bicicletas");
  for (const t of red.tramos) {
    if (!t.habilitado_bicicletas && !filas.some((f) => f.tramo === t.id && f.motivo === noHabilitado)) {
      filas.push({ tramo: t.id, sentido: sentido(t.id), motivo: noHabilitado });
    }
  }
  return filas.sort((a, b) => a.tramo.localeCompare(b.tramo));
}
