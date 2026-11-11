import { describe, expect, it } from "vitest";
import type { Metricas, Viaje } from "./lib/api";
import { ETIQUETA_OPCION, etiquetaViaje, explicarLote, nivelCongestion, resumenViajes } from "./lib/texto";

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
    expect(explicarLote(m({}), m({})).sobrecarga).toBe("Ningún tramo supera su capacidad, ni con ni sin estrategia.");
  });

  it("explica el 0 cuando ningún viaje tiene ruta segura", () => {
    const sin = m({ viajes_a_tiempo: 0, viajes_sin_ruta_segura: 3, minutos_totales_viaje: 0 });
    expect(explicarLote(sin, sin).sobrecarga).toBe(
      "Ningún viaje tiene ruta segura, así que no hay carga que repartir: 0 es el resultado esperado.",
    );
  });

  it("dice cuánto queda por encima de la capacidad", () => {
    const e = explicarLote(m({ sobrecarga_acumulada_bici_intervalo: 348 }), m({ sobrecarga_acumulada_bici_intervalo: 143 }));
    expect(e.sobrecarga).toBe("Quedan 143 bici-intervalos por encima de la capacidad; sin estrategia eran 348.");
  });

  it("explica por qué suben los pares saturados y los viajes tardíos en 02", () => {
    const ref = m({ sobrecarga_acumulada_bici_intervalo: 348, pares_saturados: 6, maxima_relacion_carga_capacidad: 20.3333, minutos_totales_viaje: 720, viajes_a_tiempo: 60 });
    const eq = m({ sobrecarga_acumulada_bici_intervalo: 143, pares_saturados: 19, maxima_relacion_carga_capacidad: 6.6667, minutos_totales_viaje: 1242, minutos_totales_tardanza: 89, viajes_a_tiempo: 44, viajes_tarde: 16 });
    expect(explicarLote(ref, eq).costos).toEqual([
      "Hay más pares saturados (6 → 19) porque la carga se reparte en más tramos, cada uno mucho menos cargado: el tramo más cargado baja de 20,3× a 6,7× su capacidad.",
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
  const nombre = (id: string) => ({ N01: "Portal Andino", N05: "Casa del Encuentro" })[id] ?? id;

  it("resume los viajes idénticos y explica qué prueba el escenario", () => {
    expect(resumenViajes([v("V001", "propia"), v("V002", "publica")], nombre)).toBe(
      "Los 2 viajes de este escenario van de Portal Andino a Casa del Encuentro, salen entre 17:00 y 17:10 y deben llegar antes de las 17:35. Solo cambia la modalidad: el escenario prueba qué pasa cuando muchos ciclistas piden la misma ruta.",
    );
  });

  it("no resume si los viajes son distintos", () => {
    expect(resumenViajes([v("V001", "propia"), v("V002", "propia", { destino: "N16" })], nombre)).toBeNull();
  });

  it("etiqueta cada viaje con lo que cambia", () => {
    const iguales = [v("V001", "propia"), v("V002", "publica")];
    expect(etiquetaViaje(iguales[0], iguales)).toBe("V001 · bici propia");
    expect(etiquetaViaje(iguales[1], iguales)).toBe("V002 · bici pública");
    const distintos = [v("V001", "propia"), v("V002", "publica", { salida_desde: "18:00", salida_hasta: "18:10" })];
    expect(etiquetaViaje(distintos[1], distintos)).toBe("V002 · N01 → N05 · 18:00–18:10 · bici pública");
  });
});
