import { describe, expect, it } from "vitest";
import type { Metricas, Recorrido, Red, Tramo, Viaje } from "./lib/api";
import {
  ETIQUETA_OPCION,
  etiquetaViaje,
  explicarLote,
  nivelCongestion,
  notaLote,
  planDominante,
  restriccionesDelEscenario,
  textoAlternativas,
  textoSinRuta,
  tipoCambio,
} from "./lib/texto";

describe("nivelCongestion", () => {
  it("devuelve 'Sin congestión' para 0", () => {
    expect(nivelCongestion(0)).toBe("Sin congestión");
  });
  it("devuelve 'Moderada' para 1", () => {
    expect(nivelCongestion(1)).toBe("Moderada");
  });
  it("devuelve 'Moderada' para 3", () => {
    expect(nivelCongestion(3)).toBe("Moderada");
  });
  it("devuelve 'Alta' para 4", () => {
    expect(nivelCongestion(4)).toBe("Alta");
  });
});

describe("ETIQUETA_OPCION", () => {
  it("tiene la etiqueta recomendada", () => {
    expect(ETIQUETA_OPCION.recomendada).toBe("Recomendada");
  });
  it("tiene la etiqueta mas_rapida", () => {
    expect(ETIQUETA_OPCION.mas_rapida).toBe("Más rápida");
  });
  it("tiene la etiqueta menos_congestion", () => {
    expect(ETIQUETA_OPCION.menos_congestion).toBe("Menos congestión");
  });
});
const m = (x: Partial<Metricas>): Metricas => ({
  sobrecarga_acumulada_bici_intervalo: 0,
  pares_saturados: 0,
  maxima_relacion_carga_capacidad: 1,
  minutos_totales_viaje: 100,
  minutos_totales_tardanza: 0,
  viajes_a_tiempo: 10,
  viajes_tarde: 0,
  viajes_sin_ruta_segura: 0,
  ...x,
});

describe("explicarLote", () => {
  it("explica que 0 con estrategia significa ningún tramo saturado", () => {
    const e = explicarLote(m({ sobrecarga_acumulada_bici_intervalo: 36 }), m({}));
    expect(e.sobrecarga).toBe("0 significa que, con la estrategia, ningún tramo supera su capacidad en ningún intervalo de 5 min.");
  });

  it("explica cuando ninguno de los dos lados tiene sobrecarga", () => {
    expect(explicarLote(m({}), m({})).sobrecarga).toBe("Ningún tramo supera su capacidad, ni con estrategia ni en la referencia.");
  });

  it("explica el 0 cuando ningún viaje tiene ruta segura", () => {
    const sin = m({ viajes_a_tiempo: 0, viajes_sin_ruta_segura: 3, minutos_totales_viaje: 0 });
    expect(explicarLote(sin, sin).sobrecarga).toBe(
      "Ningún viaje tiene ruta segura, así que no hay carga que repartir: 0 es el resultado esperado.",
    );
  });

  it("dice cuánto queda por encima de la capacidad", () => {
    const e = explicarLote(m({ sobrecarga_acumulada_bici_intervalo: 348 }), m({ sobrecarga_acumulada_bici_intervalo: 143 }));
    expect(e.sobrecarga).toBe("Quedan 143 bici-intervalos por encima de la capacidad; en la referencia eran 348.");
  });

  it("explica por qué suben los pares saturados y los viajes tardíos en 02", () => {
    const ref = m({ sobrecarga_acumulada_bici_intervalo: 348, pares_saturados: 6, maxima_relacion_carga_capacidad: 20.3333, minutos_totales_viaje: 720, viajes_a_tiempo: 60 });
    const eq = m({ sobrecarga_acumulada_bici_intervalo: 143, pares_saturados: 19, maxima_relacion_carga_capacidad: 6.6667, minutos_totales_viaje: 1242, minutos_totales_tardanza: 89, viajes_a_tiempo: 44, viajes_tarde: 16 });
    expect(explicarLote(ref, eq).costos).toEqual([
      "Hay más pares saturados (6 → 19) porque la carga se reparte en más tramos, cada uno mucho menos cargado: el tramo más cargado baja de 20,3× a 6,7× su capacidad.",
      "Los minutos de viaje suben de 720 a 1242 (+522) porque los viajes desviados toman corredores más largos que la ruta más rápida.",
      "16 viajes más llegan tarde (89 min de tardanza en total): el reto prioriza bajar la congestión del conjunto. Mueve «Qué pesa más» hacia la puntualidad para reducirlos.",
    ]);
  });

  it("si nadie llega tarde, explica el costo en minutos de viaje", () => {
    const ref = m({ sobrecarga_acumulada_bici_intervalo: 36, pares_saturados: 6, maxima_relacion_carga_capacidad: 3, minutos_totales_viaje: 96 });
    const eq = m({ minutos_totales_viaje: 132 });
    expect(explicarLote(ref, eq).costos).toEqual(["Repartir la demanda cuesta 36 min de viaje más en total, sin que nadie llegue tarde."]);
  });

  it("usa singular cuando solo un viaje más llega tarde", () => {
    const e = explicarLote(m({}), m({ viajes_a_tiempo: 9, viajes_tarde: 1, minutos_totales_tardanza: 4 }));
    expect(e.costos[0]).toMatch(/^1 viaje más llega tarde \(4 min/);
  });

  it("si baja la sobrecarga sin costo, lo dice", () => {
    expect(explicarLote(m({ sobrecarga_acumulada_bici_intervalo: 6, pares_saturados: 3 }), m({})).costos).toEqual([
      "Repartir no cuesta minutos de viaje ni tardanza.",
    ]);
  });

  it("sin mejora ni costo no agrega explicaciones", () => {
    expect(explicarLote(m({}), m({})).costos).toEqual([]);
  });
});

describe("viajes del escenario", () => {
  const v = (id: string, modalidad: string, extra: Partial<Viaje> = {}): Viaje => ({
    id,
    orden: 1,
    origen: "N01",
    destino: "N05",
    salida_desde: "17:00",
    salida_hasta: "17:10",
    llegada_limite: "17:35",
    modalidad,
    ...extra,
  });
  it("etiqueta cada viaje con lo que cambia", () => {
    const iguales = [v("V001", "propia"), v("V002", "publica")];
    expect(etiquetaViaje(iguales[0], iguales)).toBe("V001 · bici propia");
    expect(etiquetaViaje(iguales[1], iguales)).toBe("V002 · bici pública");
    const distintos = [v("V001", "propia"), v("V002", "publica", { salida_desde: "18:00", salida_hasta: "18:10" })];
    expect(etiquetaViaje(distintos[1], distintos)).toBe("V002 · N01 → N05 · 18:00–18:10 · bici pública");
  });
});

describe("restriccionesDelEscenario", () => {
  const tramo = (id: string, origen: string, destino: string, extra: Partial<Tramo> = {}): Tramo => ({
    id,
    origen,
    destino,
    distancia_m: 400,
    tiempo_base_min: 2,
    capacidad_bicis: 3,
    iluminado: true,
    habilitado_bicicletas: true,
    tipo: "ciclorruta",
    ...extra,
  });
  const red = {
    config: { inicio: "15:00", fin: "21:00", intervalo_min: 5, inicio_noche: "18:00", fin_noche: "21:00" },
    tramos: [
      tramo("T01", "N01", "N02"),
      tramo("T02", "N02", "N03", { iluminado: false }),
      tramo("T18", "N08", "N03"),
      tramo("T27", "N02", "N04"),
      tramo("T28", "N01", "N05", { habilitado_bicicletas: false, tipo: "via_no_habilitada" }),
    ],
    restricciones: [
      { id: "R03", tramo_id: "T18", inicio: "18:00", fin: "21:00", motivo: "riesgo_seguridad_personal" },
      { id: "R01", tramo_id: "T27", inicio: "15:00", fin: "21:00", motivo: "riesgo_vial_alto" },
      { id: "R02", tramo_id: "T28", inicio: "15:00", fin: "21:00", motivo: "no_habilitado_bicicletas" },
    ],
  } as unknown as Red;

  it("lista los tramos con restricciones como el prototipo de ias (escenario 04)", () => {
    expect(restriccionesDelEscenario(red)).toEqual([
      { tramo: "T02", sentido: "N02 → N03", motivo: "Sin iluminación de 18:00 a 21:00" },
      { tramo: "T18", sentido: "N08 → N03", motivo: "Riesgo de seguridad personal de 18:00 a 21:00" },
      { tramo: "T27", sentido: "N02 → N04", motivo: "Riesgo vial alto de 15:00 a 21:00" },
      { tramo: "T28", sentido: "N01 → N05", motivo: "No habilitado para bicicletas" },
    ]);
  });

  it("incluye un tramo no habilitado aunque no tenga restricción", () => {
    const sinR = { ...red, restricciones: [] } as Red;
    expect(restriccionesDelEscenario(sinR).map((f) => f.tramo)).toEqual(["T02", "T28"]);
  });
});

const rec = (salida: string, llegada: string, tramos: string[], tardanza = 0): Recorrido => ({
  viaje_id: "V019",
  estado: tardanza > 0 ? "TARDE" : "A_TIEMPO",
  salida,
  llegada,
  duracion_min: 0,
  tardanza_min: tardanza,
  pasos: tramos.map((t) => ({ tramo_id: t, entrada: salida, salida: llegada })),
});

describe("tipoCambio", () => {
  const base = rec("17:00", "17:12", ["T01", "T02"]);
  it("distingue igual, otra hora, otra ruta y ambas", () => {
    expect(tipoCambio(base, rec("17:00", "17:12", ["T01", "T02"]))).toBe("igual");
    expect(tipoCambio(base, rec("17:05", "17:17", ["T01", "T02"]))).toBe("hora");
    expect(tipoCambio(base, rec("17:00", "17:20", ["T13", "T05"]))).toBe("ruta");
    expect(tipoCambio(base, rec("17:10", "17:38", ["T13", "T05"]))).toBe("ruta_hora");
  });
  it("sin recorrido en algún lado no hay cambio que mostrar", () => {
    expect(tipoCambio(null, base)).toBeNull();
    expect(tipoCambio(base, null)).toBeNull();
  });
});

describe("notaLote", () => {
  const individual = rec("17:00", "17:12", ["T01", "T02"]);
  it("dice cuándo y por dónde sale en el lote y cuánto llega tarde (02, V019)", () => {
    const lote = { viaje_id: "V019", estado: "TARDE" as const, recorrido: rec("17:05", "17:33", ["T13", "T05"], 3) };
    expect(notaLote(individual, lote)).toBe(
      "En el reparto del lote, V019 sale a las 17:05 por otra ruta y llega 3 min tarde (17:33), para no saturar los tramos.",
    );
  });
  it("si solo cambia la hora y llega a tiempo, lo dice", () => {
    const lote = { viaje_id: "V001", estado: "A_TIEMPO" as const, recorrido: rec("17:05", "17:17", ["T01", "T02"]) };
    expect(notaLote(individual, lote)).toBe(
      "En el reparto del lote, V001 sale a las 17:05 por la misma ruta y llega a tiempo (17:17), para no saturar los tramos.",
    );
  });
  it("si el lote no cambia nada, lo confirma", () => {
    const lote = { viaje_id: "V001", estado: "A_TIEMPO" as const, recorrido: rec("17:00", "17:12", ["T01", "T02"]) };
    expect(notaLote(individual, lote)).toBe("En el reparto del lote, V001 mantiene esta misma ruta y hora.");
  });
  it("sin asignación o sin ruta no hay nota", () => {
    expect(notaLote(individual, undefined)).toBeNull();
    expect(notaLote(individual, { viaje_id: "V001", estado: "SIN_RUTA_SEGURA", recorrido: null })).toBeNull();
  });
});

describe("textoSinRuta", () => {
  it("no culpa a un bloqueo cuando la simulación se acaba", () => {
    expect(textoSinRuta("horizonte", "21:00")).toBe(
      "Ninguna ruta segura llega antes de las 21:00, cuando termina la simulación. Prueba una salida más temprana.",
    );
  });
  it("dice que cambiar la hora no ayuda si el destino está cerrado toda la simulación", () => {
    expect(textoSinRuta("sin_acceso", "21:00")).toBe(
      "Los tramos de acceso a ese destino están bloqueados durante toda la simulación. Cambiar la hora de salida no ayuda.",
    );
  });
  it("si es un bloqueo a esa hora, sugiere probar otra", () => {
    const t =
      "Todos los recorridos posibles usan algún tramo bloqueado a esa hora. Otra hora de salida sí puede tener ruta segura.";
    expect(textoSinRuta("bloqueo", "21:00")).toBe(t);
    expect(textoSinRuta(undefined, "21:00")).toBe(t);
  });
});

describe("planDominante", () => {
  const n = (sobrecarga: number, tardanza: number) =>
    m({ sobrecarga_acumulada_bici_intervalo: sobrecarga, minutos_totales_tardanza: tardanza });
  it("marca los niveles que otro mejora en sobrecarga y en tardanza a la vez (02)", () => {
    const niveles = [n(181, 12), n(165, 28), n(138, 87), n(143, 89), n(143, 89)];
    expect(planDominante(niveles)).toEqual([null, null, null, 2, 2]);
  });
  it("un empate exacto no cuenta como peor", () => {
    expect(planDominante([n(10, 5), n(10, 5)])).toEqual([null, null]);
  });
});

describe("explicarLote en el extremo de puntualidad", () => {
  it("no pide mover el control cuando ya está en el extremo", () => {
    const ref = m({ sobrecarga_acumulada_bici_intervalo: 348, viajes_a_tiempo: 60 });
    const eq = m({ sobrecarga_acumulada_bici_intervalo: 181, viajes_tarde: 6, viajes_a_tiempo: 54, minutos_totales_tardanza: 12 });
    const { costos } = explicarLote(ref, eq, { maxPuntualidad: true });
    expect(costos.join(" ")).toContain("Incluso con el control en «más puntualidad»");
    expect(costos.join(" ")).not.toContain("Mueve");
  });
});

describe("textoAlternativas", () => {
  it("separa rutas seguras de horas de salida", () => {
    expect(textoAlternativas(9, 3)).toBe("9 rutas seguras · 3 horas de salida evaluadas");
    expect(textoAlternativas(1, 1)).toBe("1 ruta segura · 1 hora de salida evaluada");
  });
});
