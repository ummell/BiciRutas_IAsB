export type Estado = "A_TIEMPO" | "TARDE" | "SIN_RUTA_SEGURA";

export interface Nodo {
  id: string;
  nombre: string;
  x: number;
  y: number;
}
export interface Tramo {
  id: string;
  origen: string;
  destino: string;
  distancia_m: number;
  tiempo_base_min: number;
  capacidad_bicis: number;
  iluminado: boolean;
  habilitado_bicicletas: boolean;
  tipo: string;
}
export interface Restriccion {
  id: string;
  tramo_id: string;
  inicio: string;
  fin: string;
  motivo: string;
}
export interface Viaje {
  id: string;
  orden: number;
  origen: string;
  destino: string;
  salida_desde: string;
  salida_hasta: string;
  llegada_limite: string;
  modalidad: string;
}
export interface Config {
  inicio: string;
  fin: string;
  intervalo_min: number;
  inicio_noche: string;
  fin_noche: string;
}
export interface Red {
  escenario_id: string;
  config: Config;
  nodos: Nodo[];
  tramos: Tramo[];
  restricciones: Restriccion[];
  viajes: Viaje[];
}
export interface EscenarioIndice {
  id: string;
  nombre: string;
  objetivo: string;
  cantidad_viajes: number;
}
export interface Paso {
  tramo_id: string;
  entrada: string;
  salida: string;
}
export interface Recorrido {
  viaje_id: string;
  estado: "A_TIEMPO" | "TARDE";
  salida: string;
  llegada: string;
  duracion_min: number;
  tardanza_min: number;
  pasos: Paso[];
}
export type EtiquetaOpcion = "recomendada" | "mas_rapida" | "menos_congestion";

export interface OpcionEquilibrada {
  etiqueta: EtiquetaOpcion;
  congestion: number;
  recorrido: Recorrido;
}

/** Congestion weight of the delivered plan (estrategia.PESO_CONGESTION). */
export const PESO_PLAN = 3;

export type MotivoSinRuta = "horizonte" | "sin_acceso" | "bloqueo";

export interface ConsultaOut {
  estado: Estado;
  alternativas: number;
  recorrido: Recorrido | null;
  motivo_sin_ruta?: MotivoSinRuta;
  rutas_seguras?: number;
  salidas_evaluadas?: number;
  criterio?: "rapido" | "equilibrado";
  congestion?: number | null;
  opciones?: OpcionEquilibrada[];
}
export interface ConsultaIn {
  origen: string;
  destino: string;
  salida_desde: string;
  llegada_limite: string;
  salida_hasta?: string;
  criterio?: "rapido" | "equilibrado";
}
export interface Metricas {
  sobrecarga_acumulada_bici_intervalo: number;
  pares_saturados: number;
  maxima_relacion_carga_capacidad: number;
  minutos_totales_viaje: number;
  minutos_totales_tardanza: number;
  viajes_a_tiempo: number;
  viajes_tarde: number;
  viajes_sin_ruta_segura: number;
}
export interface Asignacion {
  viaje_id: string;
  estado: Estado;
  recorrido: Recorrido | null;
}
export interface OcupacionFila {
  tramo_id: string;
  inicio: string;
  fin: string;
  carga_inicial: number;
  carga_asignada: number;
  carga_total: number;
  capacidad: number;
  sobrecarga: number;
}
export interface LoteLado {
  metricas: Metricas;
  asignaciones: Asignacion[];
  ocupacion: OcupacionFila[];
  evaluador_ok?: boolean;
}
export interface Lote {
  escenario_id: string;
  peso_congestion: number;
  equipo: LoteLado;
  referencia: LoteLado;
}
export interface EstadoTramo {
  tramo_id: string;
  seguro: boolean;
  motivo: string | null;
}
export interface TramoBloqueado {
  tramo_id: string;
  motivo: string;
}
export interface LineaTiempo {
  intervalo_min: number;
  horas: { hora: string; bloqueados: TramoBloqueado[] }[];
}
export interface EstadoTramos {
  hora: string;
  tramos: EstadoTramo[];
}

export class ApiError extends Error {}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch {
    throw new ApiError("No se pudo conectar con la API local. ¿Está corriendo en el puerto 8000?");
  }
  if (!r.ok) {
    let detalle = `Error ${r.status}`;
    try {
      const cuerpo = await r.json();
      if (typeof cuerpo.detail === "string") detalle = cuerpo.detail;
      else if (Array.isArray(cuerpo.detail)) detalle = "Revisa los datos del formulario";
    } catch {
    }
    throw new ApiError(detalle);
  }
  return r.json() as Promise<T>;
}

export const api = {
  escenarios: () => pedir<EscenarioIndice[]>("/api/escenarios"),
  red: (id: string) => pedir<Red>(`/api/escenarios/${id}/red`),
  consulta: (id: string, datos: ConsultaIn) =>
    pedir<ConsultaOut>(`/api/escenarios/${id}/consulta`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(datos),
    }),
  lote: (id: string, peso: number) => pedir<Lote>(`/api/escenarios/${id}/lote?peso=${peso}`),
  lineaTiempo: (id: string) => pedir<LineaTiempo>(`/api/escenarios/${id}/linea-tiempo`),
  estadoTramos: (id: string, hora: string) =>
    pedir<EstadoTramos>(`/api/escenarios/${id}/estado-tramos?hora=${hora}`),
};
