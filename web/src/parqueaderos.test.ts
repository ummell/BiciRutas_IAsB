import { describe, expect, it } from "vitest";
import type { Tramo } from "./lib/api";
import { parqueaderoMasCercano, PARQUEADEROS, type Parqueadero } from "./lib/parqueaderos";

const tramo = (id: string, origen: string, destino: string, distancia_m: number, tipo = "ciclorruta"): Tramo => ({
  id,
  origen,
  destino,
  distancia_m,
  tiempo_base_min: 2,
  capacidad_bicis: 3,
  iluminado: true,
  habilitado_bicicletas: tipo !== "via_no_habilitada",
  tipo,
});

const lista: Parqueadero[] = [
  { nodo: "N03", nombre: "Uno", cupos: 10, horario: "06:00–22:00" },
  { nodo: "N04", nombre: "Dos", cupos: 10, horario: "06:00–22:00" },
];

const tramos = [
  tramo("T1", "N01", "N02", 400),
  tramo("T2", "N02", "N03", 400),
  tramo("T3", "N01", "N04", 200, "via_no_habilitada"),
  tramo("T4", "N02", "N04", 600),
  tramo("T5", "N04", "N01", 200),
];

describe("bici-parqueaderos", () => {
  it("hay dos parqueaderos en nodos existentes de la red", () => {
    expect(PARQUEADEROS.map((p) => p.nodo)).toEqual(["N04", "N08"]);
  });

  it("elige el más cercano por distancia sobre el grafo dirigido", () => {
    expect(parqueaderoMasCercano("N01", tramos, lista)).toEqual({ parqueadero: lista[0], metros: 800 });
  });

  it("no usa vías no habilitadas para bicicletas", () => {
    expect(parqueaderoMasCercano("N01", tramos, [lista[1]])).toEqual({ parqueadero: lista[1], metros: 1000 });
  });

  it("respeta el sentido de los tramos y devuelve null si no se llega", () => {
    expect(parqueaderoMasCercano("N03", tramos, lista)).toBeNull();
  });

  it("no propone el parqueadero en el que ya se está", () => {
    expect(parqueaderoMasCercano("N04", tramos, lista)).toEqual({ parqueadero: lista[0], metros: 1000 });
  });
});
