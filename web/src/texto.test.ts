import { describe, expect, it } from "vitest";
import { ETIQUETA_OPCION, nivelCongestion } from "./lib/texto";

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