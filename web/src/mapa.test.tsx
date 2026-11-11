import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MapaCanvas, type Capas } from "./components/MapaCanvas";
import type { EstadoTramo, Red } from "./lib/api";
import { construirFondo, construirVias, DIA, encuadrar } from "./lib/mapa";
import { ConsultaView } from "./views/ConsultaView";
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

function canvas(estado: Record<string, EstadoTramo> = {}, vivo = true) {
  const sin = () => undefined;
  return renderToStaticMarkup(
    <MapaCanvas
      red={red}
      vias={construirVias(red.nodos, red.tramos)}
      fondo={construirFondo(red.nodos)}
      paleta={DIA}
      vb={{ x: 0, y: 0, w: 400, h: 300 }}
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
    expect(cuenta(html, 'class="onda-cobertura"')).toBe(2);
    expect(html).toContain("br-cobertura-no");
    expect(html).toContain('class="flujo-via"');
    expect(html).toContain("<animateMotion");
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
    expect(cuenta(html, 'class="onda-cobertura"')).toBe(1);
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

  it("administración ve el plano original con su control de hora", () => {
    const html = conConsultas(<ConsultaView escenario="prueba" red={red} admin />);
    expect(html).toContain('aria-label="Red de ciclorrutas con');
    expect(html).toContain("Reproducir el día");
    expect(html).not.toContain('aria-label="Acercar"');
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
