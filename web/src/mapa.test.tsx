import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MapaCanvas, type Capas } from "./components/MapaCanvas";
import { Resultado } from "./components/Resultado";
import { ErrorAviso, EstadoCalculo } from "./components/ui";
import type { EstadoTramo, Red } from "./lib/api";
import { construirFondo, construirVias, DIA, encuadrar, partirNombre } from "./lib/mapa";
import { ConsultaView, SelectorRuta } from "./views/ConsultaView";
import { SelloEvaluador } from "./views/LoteView";
import { UsuarioView } from "./views/UsuarioView";

const movimiento = vi.hoisted(() => ({ reducir: false }));
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useReducedMotion: () => movimiento.reducir,
}));

const red: Red = {
  escenario_id: "prueba",
  config: { inicio: "15:00", fin: "21:00", intervalo_min: 5, inicio_noche: "18:00", fin_noche: "21:00" },
  nodos: [
    { id: "N01", nombre: "Portal", x: 80, y: 90 },
    { id: "N02", nombre: "Plazoleta", x: 260, y: 90 },
    { id: "N03", nombre: "Biblioteca", x: 260, y: 270 },
  ],
  tramos: [
    { id: "T01", origen: "N01", destino: "N02", distancia_m: 400, tiempo_base_min: 2, capacidad_bicis: 3, iluminado: true, habilitado_bicicletas: true, tipo: "ciclorruta" },
    { id: "T02", origen: "N02", destino: "N03", distancia_m: 400, tiempo_base_min: 2, capacidad_bicis: 3, iluminado: true, habilitado_bicicletas: true, tipo: "via_mixta" },
    { id: "T03", origen: "N03", destino: "N01", distancia_m: 600, tiempo_base_min: 3, capacidad_bicis: 3, iluminado: true, habilitado_bicicletas: false, tipo: "via_no_habilitada" },
  ],
  restricciones: [],
  viajes: [],
};

const capas: Capas = { calor: false, ciclo: true, trafico: false, seguridad: true, etiquetas: false };

function canvas(estado: Record<string, EstadoTramo> = {}, vivo = true, parqueaderos?: Set<string>, anchoVista = 400) {
  const sin = () => undefined;
  return renderToStaticMarkup(
    <MapaCanvas
      red={red}
      vias={construirVias(red.nodos, red.tramos)}
      fondo={construirFondo(red.nodos)}
      paleta={DIA}
      vb={{ x: 0, y: 0, w: anchoVista, h: (anchoVista * 3) / 4 }}
      setVb={sin}
      ancho={400}
      origen="N01"
      destino="N02"
      ruta={[{ tramo_id: "T01", entrada: "17:00", salida: "17:02" }]}
      rutaKey="1"
      estado={estado}
      trafico={{}}
      capas={capas}
      tramoSel={null}
      tramoResaltado={null}
      onHoverTramo={sin}
      onTramo={sin}
      onNodo={sin}
      nodoSel={null}
      minutoBici={null}
      vivo={vivo}
      radioCobertura={110}
      parqueaderos={parqueaderos}
    />,
  );
}

const cuenta = (html: string, texto: string) => html.split(texto).length - 1;

function conConsultas(nodo: ReactNode) {
  return renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{nodo}</QueryClientProvider>);
}

describe("mapa de usuario en modo vivo", () => {
  it("dibuja cobertura, flujo y ciclistas cuando hay movimiento", () => {
    movimiento.reducir = false;
    const html = canvas();
    expect(cuenta(html, 'stroke-dasharray="3 5"')).toBe(2);
    expect(html).toContain("br-cobertura-no");
    expect(html).toContain('class="flujo-via"');
    expect(html).toContain("<animateMotion");
  });

  it("no tiene círculos que parpadean", () => {
    const html = canvas();
    expect(html).not.toContain("onda-cobertura");
    expect(html).not.toContain("pulso-vivo");
  });

  it("apaga toda animación si el sistema pide reducir movimiento", () => {
    movimiento.reducir = true;
    const html = canvas();
    expect(html).not.toContain("onda-cobertura");
    expect(html).not.toContain("flujo-via");
    expect(html).not.toContain("pulso-vivo");
    expect(html).not.toContain("<animateMotion");
    expect(html).toContain("br-cobertura-ok");
    movimiento.reducir = false;
  });

  it("marca con forma y texto una estación sin salidas seguras a esa hora", () => {
    const html = canvas({ T02: { tramo_id: "T02", seguro: false, motivo: "Cierre temporal" } });
    expect(html).toContain('aria-label="Plazoleta, destino, sin salidas seguras a esta hora"');
    expect(cuenta(html, 'stroke-dasharray="3 5"')).toBe(1);
  });

  it("muestra los bici-parqueaderos como estaciones con P", () => {
    const html = canvas({}, true, new Set(["N03"]));
    expect(html).toContain('aria-label="Biblioteca, bici-parqueadero, sin salidas seguras a esta hora"');
    expect(cuenta(html, ">P</text>")).toBe(1);
    expect(canvas({}, false, new Set(["N03"]))).not.toContain("bici-parqueadero");
  });

  it("sin modo vivo conserva el mapa sin capas animadas", () => {
    const html = canvas({}, false);
    expect(html).not.toContain("url(#br-cobertura");
    expect(html).not.toContain("onda-cobertura");
    expect(html).not.toContain("<animateMotion");
  });
});

describe("mapa según el rol", () => {
  it("usuario ve el mapa interactivo", () => {
    const html = conConsultas(<UsuarioView escenario="prueba" red={red} />);
    expect(html).toContain('aria-label="Acercar"');
    expect(html).not.toContain('aria-label="Red de ciclorrutas con');
  });

  it("administración ve el plano original, sin barra de tiempo", () => {
    const html = conConsultas(<ConsultaView escenario="prueba" red={red} admin />);
    expect(html).toContain('aria-label="Red de ciclorrutas con');
    expect(html).not.toContain("Reproducir el día");
    expect(html).not.toContain("Cambio siguiente");
    expect(html).not.toContain('aria-label="Acercar"');
  });
});

describe("cálculo automático sin botón", () => {
  it("las consultas no muestran un botón de calcular", () => {
    const admin = conConsultas(<ConsultaView escenario="prueba" red={red} admin />);
    const usuario = conConsultas(<UsuarioView escenario="prueba" red={red} />);
    expect(admin).not.toContain("Calcular recorrido");
    expect(admin).not.toContain('type="submit"');
    expect(usuario).not.toContain("Buscar ruta");
    expect(usuario).not.toContain('type="submit"');
  });

  it("el estado avisa si calcula o si ya está al día", () => {
    expect(renderToStaticMarkup(<EstadoCalculo pendiente listo={false} />)).toContain("Calculando…");
    const listo = renderToStaticMarkup(<EstadoCalculo pendiente={false} listo />);
    expect(listo).toContain("Actualizado");
    expect(listo).toContain('aria-live="polite"');
    expect(renderToStaticMarkup(<EstadoCalculo pendiente={false} listo={false} />)).not.toContain("Actualizado");
  });

  it("el error ofrece reintentar solo si hay acción", () => {
    expect(renderToStaticMarkup(<ErrorAviso mensaje="Falló" onReintentar={() => undefined} />)).toContain("Reintentar");
    expect(renderToStaticMarkup(<ErrorAviso mensaje="Falló" />)).not.toContain("Reintentar");
  });
});

describe("sello del evaluador oficial", () => {
  it("muestra la validación con el total de viajes", () => {
    const html = renderToStaticMarkup(<SelloEvaluador ok total={60} />);
    expect(html).toContain("Validado por el evaluador oficial");
    expect(html).toContain("60 de 60 viajes");
  });

  it("avisa si el evaluador rechaza el plan", () => {
    expect(renderToStaticMarkup(<SelloEvaluador ok={false} total={60} />)).toContain("El evaluador oficial rechaza este plan");
  });

  it("no muestra nada si no hay dato", () => {
    expect(renderToStaticMarkup(<SelloEvaluador total={60} />)).toBe("");
  });
});

describe("ruta individual o ruta en el lote", () => {
  it("marca la opción elegida", () => {
    const html = renderToStaticMarkup(<SelectorRuta lote={false} alCambiar={() => undefined} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Ruta individual</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Ruta en el lote</);
    expect(renderToStaticMarkup(<SelectorRuta lote alCambiar={() => undefined} />)).toMatch(
      /aria-pressed="true"[^>]*>Ruta en el lote</,
    );
  });

  it("la tarjeta muestra el estado de la ruta del lote", () => {
    const tarde = {
      viaje_id: "V018",
      salida: "17:10",
      llegada: "17:32",
      estado: "TARDE" as const,
      duracion_min: 22,
      tardanza_min: 2,
      pasos: [{ tramo_id: "T01", entrada: "17:10", salida: "17:32" }],
    };
    const html = renderToStaticMarkup(
      <Resultado
        resultado={{ estado: "TARDE", alternativas: 9, recorrido: tarde }}
        red={red}
        limite="17:30"
        ampliado={false}
        puedeAmpliar={false}
        pendiente={false}
        onAmpliar={() => undefined}
        nodosRuta={[]}
        enLote
      />,
    );
    expect(html).toContain("Llega tarde");
    expect(html).toContain("2 min después del límite (17:30)");
    expect(html).toContain("Ruta asignada en el reparto del lote");
    expect(html).not.toContain("opciones seguras evaluadas");
  });

  it("sin viaje cargado no ofrece la ruta del lote", () => {
    expect(conConsultas(<ConsultaView escenario="prueba" red={red} admin />)).not.toContain("Ruta en el lote");
  });
});

describe("encuadre", () => {
  it("con los márgenes por defecto conserva el encuadre previo", () => {
    const caja = { x: 0, y: 0, w: 800, h: 400 };
    expect(encuadrar(caja, 1000, 600, 0, 70)).toEqual(encuadrar(caja, 1000, 600, 0, 70, 15, 75));
    const v = encuadrar(caja, 1000, 600, 0, 70);
    const s = Math.max(800 / 930, 400 / 510);
    expect(v.y).toBeCloseTo(200 - 270 * s);
  });

  it("deja libre el margen superior pedido", () => {
    const caja = { x: 0, y: 0, w: 800, h: 400 };
    const v = encuadrar(caja, 1000, 600, 0, 70, 120, 20);
    const s = v.w / 1000;
    expect((caja.y - v.y) / s).toBeGreaterThanOrEqual(120 - 1e-9);
  });
});

describe("partirNombre", () => {
  it("deja en una línea los nombres cortos", () => {
    expect(partirNombre("Polideportivo")).toEqual(["Polideportivo"]);
    expect(partirNombre("Alameda Verde")).toEqual(["Alameda Verde"]);
  });
  it("parte los nombres largos en dos líneas parejas", () => {
    expect(partirNombre("Biblioteca del Barrio")).toEqual(["Biblioteca", "del Barrio"]);
    expect(partirNombre("Casa del Encuentro")).toEqual(["Casa del", "Encuentro"]);
    expect(partirNombre("Jardín de las Flores")).toEqual(["Jardín de", "las Flores"]);
  });
});

describe("nombres en el mapa del usuario", () => {
  it("muestra el nombre de todas las estaciones aunque el mapa esté alejado", () => {
    const html = canvas({}, true, undefined, 800);
    expect(html).toContain(">Biblioteca<");
  });
});
