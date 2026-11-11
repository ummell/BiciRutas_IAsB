import type { Asignacion, Estado, EtiquetaOpcion, Metricas, MotivoSinRuta, Recorrido, Red, Viaje } from "./api";

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

export function explicarLote(
  ref: Metricas,
  eq: Metricas,
  { maxPuntualidad = false }: { maxPuntualidad?: boolean } = {},
): { sobrecarga: string; costos: string[] } {
  const r = ref.sobrecarga_acumulada_bici_intervalo;
  const e = eq.sobrecarga_acumulada_bici_intervalo;
  const sinViajes = eq.viajes_a_tiempo + eq.viajes_tarde === 0 && eq.viajes_sin_ruta_segura > 0;
  const sobrecarga = sinViajes
    ? "Ningún viaje tiene ruta segura, así que no hay carga que repartir: 0 es el resultado esperado."
    : r === 0 && e === 0
      ? "Ningún tramo supera su capacidad, ni con estrategia ni en la referencia."
      : e === 0
        ? "0 significa que, con la estrategia, ningún tramo supera su capacidad en ningún intervalo de 5 min."
        : `Quedan ${e} bici-intervalos por encima de la capacidad; en la referencia eran ${r}.`;

  const costos: string[] = [];
  if (eq.pares_saturados > ref.pares_saturados) {
    costos.push(
      `Hay más pares saturados (${ref.pares_saturados} → ${eq.pares_saturados}) porque la carga se reparte en más tramos, cada uno mucho menos cargado: el tramo más cargado baja de ${veces(ref.maxima_relacion_carga_capacidad)} a ${veces(eq.maxima_relacion_carga_capacidad)} su capacidad.`,
    );
  }
  const tarde = eq.viajes_tarde - ref.viajes_tarde;
  const extra = eq.minutos_totales_viaje - ref.minutos_totales_viaje;
  if (tarde > 0 && extra > 0) {
    costos.push(
      `Los minutos de viaje suben de ${ref.minutos_totales_viaje} a ${eq.minutos_totales_viaje} (+${extra}) porque los viajes desviados toman corredores más largos que la ruta más rápida.`,
    );
  }
  if (tarde > 0) {
    costos.push(
      maxPuntualidad
        ? `${plural(tarde, "viaje más llega", "viajes más llegan")} tarde (${eq.minutos_totales_tardanza} min de tardanza en total). Incluso con el control en «más puntualidad», es lo mínimo que logra la estrategia sin volver a saturar los tramos.`
        : `${plural(tarde, "viaje más llega", "viajes más llegan")} tarde (${eq.minutos_totales_tardanza} min de tardanza en total): el reto prioriza bajar la congestión del conjunto. Mueve «Qué pesa más» hacia la puntualidad para reducirlos.`,
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

export type Cambio = "igual" | "hora" | "ruta" | "ruta_hora";

export const ETIQUETA_CAMBIO: Record<Cambio, string> = {
  igual: "Igual",
  hora: "Otra hora",
  ruta: "Otra ruta",
  ruta_hora: "Otra ruta y hora",
};

const ruta = (r: Recorrido) => r.pasos.map((p) => p.tramo_id).join(",");

export function tipoCambio(antes: Recorrido | null, despues: Recorrido | null): Cambio | null {
  if (!antes || !despues) return null;
  const otraRuta = ruta(antes) !== ruta(despues);
  const otraHora = antes.salida !== despues.salida;
  if (otraRuta && otraHora) return "ruta_hora";
  if (otraRuta) return "ruta";
  if (otraHora) return "hora";
  return "igual";
}

export function notaLote(individual: Recorrido | null, lote: Asignacion | undefined): string | null {
  const r = lote?.recorrido;
  const cambio = tipoCambio(individual, r ?? null);
  if (!lote || !r || !cambio) return null;
  if (cambio === "igual") return `En el reparto del lote, ${lote.viaje_id} mantiene esta misma ruta y hora.`;
  const por = cambio === "hora" ? "la misma ruta" : "otra ruta";
  const llega = r.tardanza_min > 0 ? `llega ${r.tardanza_min} min tarde (${r.llegada})` : `llega a tiempo (${r.llegada})`;
  return `En el reparto del lote, ${lote.viaje_id} sale a las ${r.salida} por ${por} y ${llega}, para no saturar los tramos.`;
}

export function textoSinRuta(motivo: MotivoSinRuta | undefined, fin: string): string {
  if (motivo === "horizonte")
    return `Ninguna ruta segura llega antes de las ${fin}, cuando termina la simulación. Prueba una salida más temprana.`;
  if (motivo === "sin_acceso")
    return "Los tramos de acceso a ese destino están bloqueados durante toda la simulación. Cambiar la hora de salida no ayuda.";
  return "Todos los recorridos posibles usan algún tramo bloqueado a esa hora. Otra hora de salida sí puede tener ruta segura.";
}

/** For each level, the index of another level with less overload and less lateness (at least one strictly), or null. */
export function planDominante(niveles: Metricas[]): (number | null)[] {
  return niveles.map((a, i) => {
    const j = niveles.findIndex(
      (b, k) =>
        k !== i &&
        b.sobrecarga_acumulada_bici_intervalo <= a.sobrecarga_acumulada_bici_intervalo &&
        b.minutos_totales_tardanza <= a.minutos_totales_tardanza &&
        (b.sobrecarga_acumulada_bici_intervalo < a.sobrecarga_acumulada_bici_intervalo ||
          b.minutos_totales_tardanza < a.minutos_totales_tardanza),
    );
    return j === -1 ? null : j;
  });
}

export function textoAlternativas(rutas: number, salidas: number): string {
  return `${plural(rutas, "ruta segura", "rutas seguras")} · ${plural(salidas, "hora de salida evaluada", "horas de salida evaluadas")}`;
}
