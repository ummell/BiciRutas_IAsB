import { animate, AnimatePresence, motion, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Paso, Red } from "../lib/api";
import { useEstadoTramos, useLote } from "../lib/hooks";
import {
  cajaDe,
  colorTrafico,
  construirFondo,
  construirVias,
  DIA,
  encuadrar,
  escalaBonita,
  formatoDistancia,
  metrosPorUnidad,
  NOCHE,
  TIPO_TRAMO,
  type Caja,
} from "../lib/mapa";
import { motivoBloqueo } from "../lib/texto";
import { aHora, aMin } from "../lib/time";
import { MapaCanvas, type Capas } from "./MapaCanvas";
import { AnimatedNumber } from "./ui";
import { VistaCalle } from "./VistaCalle";

const PESO = 1000;

interface Props {
  escenario: string;
  red: Red;
  modo: "usuario" | "admin";
  hora?: string;
  onHora?: (h: string) => void;
  origen?: string;
  destino?: string;
  ruta?: Paso[];
  rutaTarde?: boolean;
  rutaKey: string;
  onOrigen?: (id: string) => void;
  onDestino?: (id: string) => void;
  calor?: Record<string, number>;
  calorMax?: number;
  className?: string;
  simple?: boolean;
}

export function MapaInteractivo(p: Props) {
  const reducir = useReducedMotion();
  const { red } = p;
  const cfg = red.config;
  const ultimo = aHora(aMin(cfg.fin) - cfg.intervalo_min);

  const [horaPropia, setHoraPropia] = useState("17:00");
  const hora = p.hora ?? horaPropia;
  const horaRef = useRef(hora);
  horaRef.current = hora;
  const setHora = useCallback(
    (h: string) => {
      if (p.onHora) p.onHora(h);
      else setHoraPropia(h);
    },
    [p.onHora],
  );

  const marco = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [vb, setVbEstado] = useState<Caja | null>(null);
  const vbRef = useRef<Caja | null>(null);
  const vuelo = useRef<AnimationPlaybackControls | null>(null);
  const paseo = useRef<AnimationPlaybackControls | null>(null);

  const [capas, setCapas] = useState<Capas>(
    p.modo === "admin"
      ? { calor: true, ciclo: false, trafico: false, seguridad: false, etiquetas: false }
      : { calor: false, ciclo: true, trafico: false, seguridad: true, etiquetas: false },
  );
  const [menuCapas, setMenuCapas] = useState(false);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [minAnim, setMinAnim] = useState<number | null>(null);
  const [tramoSel, setTramoSel] = useState<string | null>(null);
  const [calleGrande, setCalleGrande] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [nodoSel, setNodoSel] = useState<string | null>(null);

  const vias = useMemo(() => construirVias(red.nodos, red.tramos), [red.nodos, red.tramos]);
  const fondo = useMemo(() => construirFondo(red.nodos), [red.nodos]);
  const mpu = useMemo(() => metrosPorUnidad(red.nodos, red.tramos), [red.nodos, red.tramos]);
  const tramos = useMemo(() => new Map(red.tramos.map((t) => [t.id, t])), [red.tramos]);
  const nombre = useCallback((id: string) => red.nodos.find((n) => n.id === id)?.nombre ?? id, [red.nodos]);
  const derecha = tam.w >= 700 ? 70 : 56;

  const cajaRed = useMemo(() => {
    const pts = red.nodos.map((n) => ({ x: n.x, y: n.y }));
    Object.values(vias).forEach((v) => pts.push(v.medio));
    return cajaDe(pts, 50);
  }, [red.nodos, vias]);

  const cajaRuta = useMemo(() => {
    const pts = (p.ruta ?? []).flatMap((x) => {
      const v = vias[x.tramo_id];
      return v ? [v.a, v.b, v.medio] : [];
    });
    return pts.length ? cajaDe(pts, 70) : null;
  }, [p.ruta, vias]);

  const setVb = useCallback((f: (v: Caja) => Caja) => {
    vuelo.current?.stop();
    setVbEstado((v) => {
      if (!v) return v;
      const n = f(v);
      vbRef.current = n;
      return n;
    });
  }, []);

  const volarA = useCallback(
    (d: Caja) => {
      vuelo.current?.stop();
      const a = vbRef.current;
      if (!a || reducir) {
        vbRef.current = d;
        setVbEstado(d);
        return;
      }
      vuelo.current = animate(0, 1, {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (t) => {
          const n = { x: a.x + (d.x - a.x) * t, y: a.y + (d.y - a.y) * t, w: a.w + (d.w - a.w) * t, h: a.h + (d.h - a.h) * t };
          vbRef.current = n;
          setVbEstado(n);
        },
      });
    },
    [reducir],
  );

  useLayoutEffect(() => {
    const el = marco.current;
    if (!el) return;
    const medir = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      setTam((t) => (t.w === w && t.h === h ? t : { w, h }));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    window.addEventListener("resize", medir);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);

  useEffect(() => {
    if (!tam.w || !tam.h) return;
    const actual = vbRef.current;
    if (!actual) {
      const n = encuadrar(cajaRuta ?? cajaRed, tam.w, tam.h, 0, derecha);
      vbRef.current = n;
      setVbEstado(n);
      return;
    }
    const h = actual.w * (tam.h / tam.w);
    if (Math.abs(h - actual.h) > 0.5) {
      const n = { ...actual, y: actual.y + (actual.h - h) / 2, h };
      vbRef.current = n;
      setVbEstado(n);
    }
  }, [tam, cajaRed, cajaRuta, derecha]);

  useEffect(() => {
    paseo.current?.stop();
    setMinAnim(null);
    setNodoSel(null);
    if (!tam.w || !vbRef.current) return;
    volarA(encuadrar(cajaRuta ?? cajaRed, tam.w, tam.h, 0, derecha));
  }, [p.rutaKey]);

  useEffect(() => {
    setTramoSel(null);
    setCalleGrande(false);
  }, [p.escenario]);

  const estadoQ = useEstadoTramos(p.escenario, hora);
  const estado = useMemo(
    () => Object.fromEntries((estadoQ.data?.tramos ?? []).map((t) => [t.tramo_id, t])),
    [estadoQ.data],
  );
  const loteQ = useLote(p.escenario, PESO, capas.trafico || tramoSel !== null);
  const cargaHora = useMemo(() => {
    const m: Record<string, { total: number; capacidad: number }> = {};
    for (const f of loteQ.data?.equipo.ocupacion ?? []) {
      if (f.inicio === hora) m[f.tramo_id] = { total: f.carga_total, capacidad: f.capacidad };
    }
    return m;
  }, [loteQ.data, hora]);
  const trafico = useMemo(
    () => Object.fromEntries(red.tramos.map((t) => [t.id, (cargaHora[t.id]?.total ?? 0) / Math.max(1, t.capacidad_bicis)])),
    [cargaHora, red.tramos],
  );
  const noche = aMin(hora) >= aMin(cfg.inicio_noche) && aMin(hora) < aMin(cfg.fin_noche);

  useEffect(() => {
    if (!reproduciendo) return;
    const id = window.setInterval(() => {
      const s = aMin(horaRef.current) + cfg.intervalo_min;
      if (s > aMin(ultimo)) setReproduciendo(false);
      else setHora(aHora(s));
    }, 220);
    return () => window.clearInterval(id);
  }, [reproduciendo, cfg.intervalo_min, ultimo, setHora]);

  useEffect(
    () => () => {
      paseo.current?.stop();
    },
    [],
  );

  const pasos = p.ruta ?? [];
  const salidaR = pasos.length ? pasos[0].entrada : null;
  const llegadaR = pasos.length ? pasos[pasos.length - 1].salida : null;
  const minutoBici =
    minAnim ?? (!p.simple && salidaR && llegadaR && aMin(hora) >= aMin(salidaR) && aMin(hora) <= aMin(llegadaR) ? aMin(hora) : null);

  function recorrer() {
    if (!salidaR || !llegadaR) return;
    paseo.current?.stop();
    setReproduciendo(false);
    const a = aMin(salidaR);
    const b = aMin(llegadaR);
    const grilla = (m: number) =>
      aHora(aMin(cfg.inicio) + Math.floor((m - aMin(cfg.inicio)) / cfg.intervalo_min) * cfg.intervalo_min);
    if (reducir) {
      setHora(grilla(b));
      return;
    }
    let ultimaGrilla = "";
    paseo.current = animate(a, b, {
      duration: Math.min(8, Math.max(2.5, (b - a) * 0.35)),
      ease: "linear",
      onUpdate: (v) => {
        setMinAnim(v);
        const g = grilla(v);
        if (g !== ultimaGrilla) {
          ultimaGrilla = g;
          setHora(g);
        }
      },
      onComplete: () => {
        setMinAnim(b);
        window.setTimeout(() => setMinAnim(null), 900);
      },
    });
  }

  function zoom(f: number) {
    const v = vbRef.current;
    if (!v || !tam.w) return;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const w = Math.min(2600, Math.max(180, v.w * f));
    const s = w / v.w;
    volarA({ x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s, w, h: v.h * s });
  }

  function recentrar() {
    if (tam.w) volarA(encuadrar(cajaRuta ?? cajaRed, tam.w, tam.h, 0, derecha));
  }

  function verCalle(id: string) {
    setTramoSel(id);
    setNodoSel(null);
  }

  const enPantalla = (x: number, y: number) =>
    vb && tam.w ? { left: ((x - vb.x) / vb.w) * tam.w, top: ((y - vb.y) / vb.h) * tam.h } : null;

  const nodo = nodoSel ? red.nodos.find((n) => n.id === nodoSel) : undefined;
  const posNodo = nodo ? enPantalla(nodo.x, nodo.y) : null;
  const tHover = hover && hover !== tramoSel ? tramos.get(hover) : undefined;
  const posHover = tHover && vias[tHover.id] ? enPantalla(vias[tHover.id].medio.x, vias[tHover.id].medio.y) : null;
  const tSel = tramoSel ? tramos.get(tramoSel) : undefined;
  const idxSel = tramoSel ? pasos.findIndex((x) => x.tramo_id === tramoSel) : -1;
  const escala = vb && tam.w ? escalaBonita((vb.w / tam.w) * mpu) : null;
  const span = aMin(cfg.fin) - aMin(cfg.inicio);
  const nocheIni = ((aMin(cfg.inicio_noche) - aMin(cfg.inicio)) / span) * 100;
  const nocheAncho = ((aMin(cfg.fin_noche) - aMin(cfg.inicio_noche)) / span) * 100;
  const bloqueados = (estadoQ.data?.tramos ?? []).filter((t) => !t.seguro).length;
  const puedeElegir = Boolean(p.onOrigen || p.onDestino);
  const vivo = p.modo === "usuario";
  const seguros = red.tramos.filter((t) => t.tipo !== "via_no_habilitada" && estado[t.id]?.seguro !== false);
  const conectados = new Set(seguros.map((t) => t.origen)).size;
  const metrosSeguros = seguros.reduce((s, t) => s + t.distancia_m, 0);

  const chips: [keyof Capas, string][] =
    p.modo === "admin"
      ? [
          ["calor", "Sobrecarga del día"],
          ["trafico", "Tráfico a esta hora"],
          ["seguridad", bloqueados && capas.seguridad ? `Seguridad · ${bloqueados}` : "Seguridad"],
        ]
      : [
          ["ciclo", "Ciclorrutas"],
          ["trafico", "Tráfico de bicis"],
          ["seguridad", bloqueados && capas.seguridad ? `Seguridad · ${bloqueados}` : "Seguridad"],
        ];

  const vistaCalle = tSel ? (
    <div key={`calle-${tSel.id}`} className={calleGrande ? "contents" : "pointer-events-auto w-[min(400px,100%)]"}>
      <VistaCalle
        red={red}
        tramo={tSel}
        hora={hora}
        noche={noche}
        estado={estado[tSel.id]}
        restricciones={red.restricciones.filter((x) => x.tramo_id === tSel.id)}
        carga={loteQ.data ? (cargaHora[tSel.id] ?? { total: 0, capacidad: tSel.capacidad_bicis }) : undefined}
        enRuta={idxSel >= 0}
        expandida={calleGrande}
        onExpandir={() => setCalleGrande((g) => !g)}
        onCerrar={() => {
          setTramoSel(null);
          setCalleGrande(false);
        }}
        onIr={verCalle}
        siguienteEnRuta={idxSel >= 0 && idxSel < pasos.length - 1 ? pasos[idxSel + 1].tramo_id : undefined}
        anteriorEnRuta={idxSel > 0 ? pasos[idxSel - 1].tramo_id : undefined}
      />
    </div>
  ) : null;

  return (
    <div ref={marco} className={`relative overflow-hidden rounded-2xl border border-line ${p.className ?? "h-[560px]"}`}>
      {vb && (
        <MapaCanvas
          red={red}
          vias={vias}
          fondo={fondo}
          paleta={noche ? NOCHE : DIA}
          vb={vb}
          setVb={setVb}
          ancho={tam.w}
          origen={p.origen}
          destino={p.destino}
          ruta={p.ruta}
          rutaTarde={p.rutaTarde}
          rutaKey={p.rutaKey}
          estado={estado}
          trafico={trafico}
          capas={capas}
          tramoSel={tramoSel}
          tramoResaltado={hover}
          onHoverTramo={setHover}
          onTramo={p.simple ? () => undefined : verCalle}
          onNodo={(id) => setNodoSel((s) => (s === id ? null : id))}
          nodoSel={nodoSel}
          minutoBici={minutoBici}
          calor={p.calor}
          calorMax={p.calorMax}
          vivo={vivo}
          radioCobertura={240 / mpu}
        />
      )}

      {!p.simple && (
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
          {chips.map(([clave, texto]) => (
            <Chip key={clave} activo={capas[clave]} onClick={() => setCapas((c) => ({ ...c, [clave]: !c[clave] }))}>
              {texto}
            </Chip>
          ))}
        </div>
        <AnimatePresence>{!calleGrande && vistaCalle}</AnimatePresence>
      </div>
      )}

      {vivo && p.simple && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_2px_8px_rgb(25_58_39/0.18)]">
          <p className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-muted">
            <span className="relative inline-flex size-2.5" aria-hidden="true">
              {!reducir && <span className="pulso-vivo absolute inset-0 rounded-full bg-bosque-600" />}
              <span className="relative size-2.5 rounded-full bg-bosque-600" />
            </span>
            Cobertura a las <span className="tnum text-bosque">{hora}</span>
          </p>
          <dl className="mt-2 flex gap-5">
            <div>
              <dd className="font-display text-[22px] font-extrabold leading-none text-bosque">
                <AnimatedNumber value={conectados} />
                <span className="text-[14px] text-muted">/{red.nodos.length}</span>
              </dd>
              <dt className="mt-1 text-[11.5px] font-semibold text-muted">estaciones conectadas</dt>
            </div>
            <div>
              <dd className="font-display text-[22px] font-extrabold leading-none text-bosque">
                <AnimatedNumber value={seguros.length} />
                <span className="text-[14px] text-muted">/{red.tramos.length}</span>
              </dd>
              <dt className="mt-1 text-[11.5px] font-semibold text-muted">tramos seguros</dt>
            </div>
            <div>
              <dd className="font-display tnum text-[22px] font-extrabold leading-none text-bosque">{formatoDistancia(metrosSeguros)}</dd>
              <dt className="mt-1 text-[11.5px] font-semibold text-muted">de red segura</dt>
            </div>
          </dl>
        </div>
      )}

      {pasos.length > 0 && !p.simple && (
        <div className="absolute left-3 top-3 z-20">
          <button
            type="button"
            onClick={recorrer}
            className="inline-flex items-center gap-2 rounded-full bg-bosque px-4 py-2 text-[13.5px] font-bold text-white shadow-[0_2px_8px_rgb(25_58_39/0.25)] transition-colors hover:bg-bosque-900"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="#e07a2b" aria-hidden="true">
              <path d="M3 1.5v11l9-5.5z" />
            </svg>
            Recorrer la ruta
          </button>
        </div>
      )}

      <AnimatePresence>{calleGrande && vistaCalle}</AnimatePresence>

      {posNodo && nodo && (
        <div
          className="absolute z-20 w-64 -translate-x-1/2 -translate-y-[calc(100%+28px)] rounded-2xl bg-white p-3.5 shadow-[0_2px_10px_rgb(25_58_39/0.2)]"
          style={{ left: posNodo.left, top: posNodo.top }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-[17px] font-extrabold leading-tight text-bosque">{nodo.nombre}</p>
              <p className="mt-0.5 text-[12px] text-muted">
                Punto {nodo.id} · {red.tramos.filter((t) => t.origen === nodo.id).length} salidas ·{" "}
                {red.tramos.filter((t) => t.destino === nodo.id).length} llegadas
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNodoSel(null)}
              className="-mr-1 -mt-1 grid size-7 place-items-center rounded-full text-bosque hover:bg-[#f1efe8]"
              aria-label="Cerrar"
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M2 2l10 10M12 2 2 12" />
              </svg>
            </button>
          </div>
          {puedeElegir && (
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  p.onOrigen?.(nodo.id);
                  setNodoSel(null);
                }}
                className="rounded-full border-[1.5px] border-salvia px-2 py-2 text-[13.5px] font-bold text-bosque hover:bg-bosque-100"
              >
                Salir desde aquí
              </button>
              <button
                type="button"
                onClick={() => {
                  p.onDestino?.(nodo.id);
                  setNodoSel(null);
                }}
                className="rounded-full bg-bosque px-2 py-2 text-[13.5px] font-bold text-white hover:bg-bosque-900"
              >
                Ir hasta aquí
              </button>
            </div>
          )}
          <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-white" aria-hidden="true" />
        </div>
      )}

      {posHover && tHover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] whitespace-nowrap rounded-xl bg-bosque-900 px-3 py-2 text-[12.5px] text-white shadow-lg"
          style={{ left: posHover.left, top: posHover.top }}
        >
          <p className="font-bold">
            {tHover.id} · {TIPO_TRAMO[tHover.tipo] ?? tHover.tipo}
          </p>
          <p className="tnum text-white/75">
            {nombre(tHover.origen)} → {nombre(tHover.destino)} · {formatoDistancia(tHover.distancia_m)}
          </p>
          {capas.calor && p.calor && <p className="tnum text-white/75">Sobrecarga acumulada: {p.calor[tHover.id] ?? 0}</p>}
          {capas.trafico && (
            <p className="tnum text-white/75">
              {cargaHora[tHover.id]?.total ?? 0} bicis / capacidad {tHover.capacidad_bicis} a las {hora}
            </p>
          )}
          {estado[tHover.id]?.seguro === false && (
            <p className="font-semibold text-[#f3b4ac]">Bloqueado: {motivoBloqueo(estado[tHover.id].motivo)}</p>
          )}
          {!p.simple && <p className="mt-0.5 text-[11px] text-white/55">Clic para ver la calle</p>}
        </div>
      )}

      <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-2">
        {!p.simple && (
        <div className="relative">
          <BotonMapa onClick={() => setMenuCapas((m) => !m)} etiqueta="Capas del mapa" activo={menuCapas}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 2.5 18 7l-8 4.5L2 7z" />
              <path d="m2 11 8 4.5 8-4.5" />
            </svg>
          </BotonMapa>
          <AnimatePresence>
            {menuCapas && (
              <motion.div
                className="absolute bottom-0 right-12 w-64 rounded-2xl bg-white p-3 shadow-[0_2px_10px_rgb(25_58_39/0.2)]"
                initial={reducir ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducir ? undefined : { opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
              >
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted">Capas</p>
                {(
                  [
                    ...(p.calor ? ([["calor", "Sobrecarga del día", "Sobrecarga acumulada por tramo en todo el escenario."]] as const) : []),
                    ["ciclo", "Ciclorrutas", "Verde continuo: ciclorruta. Punteado: vía mixta."],
                    ["trafico", "Tráfico de bicis", "Bicis por tramo a esta hora frente a su capacidad."],
                    ["seguridad", "Seguridad", "Tramos que no se pueden usar a esta hora."],
                    ["etiquetas", "Nombres de tramos", "Muestra T01, T02…"],
                  ] as const
                ).map(([clave, titulo, desc]) => (
                  <label key={clave} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-[#f7f5ef]">
                    <input
                      type="checkbox"
                      role="switch"
                      className="peer sr-only"
                      checked={capas[clave]}
                      onChange={() => setCapas((c) => ({ ...c, [clave]: !c[clave] }))}
                    />
                    <span
                      aria-hidden="true"
                      className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-[#d6cfbf] transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-bosque peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-rueda"
                    />
                    <span>
                      <span className="block text-[13.5px] font-semibold text-bosque">{titulo}</span>
                      <span className="block text-[12px] text-muted">{desc}</span>
                    </span>
                  </label>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}
        <BotonMapa onClick={recentrar} etiqueta={pasos.length ? "Encuadrar la ruta" : "Ver toda la red"}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="10" cy="10" r="3.2" fill="currentColor" stroke="none" />
            <circle cx="10" cy="10" r="6.5" />
            <path d="M10 1.5v2.5M10 16v2.5M1.5 10H4M16 10h2.5" />
          </svg>
        </BotonMapa>
        <div className="overflow-hidden rounded-xl bg-white shadow-[0_1px_4px_rgb(25_58_39/0.2)]">
          <button type="button" onClick={() => zoom(1 / 1.5)} className="grid size-12 place-items-center text-bosque transition-colors hover:bg-[#f1efe8] active:bg-bosque-100" aria-label="Acercar">
            <svg width="18" height="18" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M8 2v12M2 8h12" />
            </svg>
          </button>
          <div className="mx-2 h-px bg-[#ece7dc]" />
          <button type="button" onClick={() => zoom(1.5)} className="grid size-12 place-items-center text-bosque transition-colors hover:bg-[#f1efe8] active:bg-bosque-100" aria-label="Alejar">
            <svg width="18" height="18" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M2 8h12" />
            </svg>
          </button>
        </div>
        {escala && (
          <div className="flex items-center gap-2 rounded bg-white/85 px-1.5 py-0.5 text-[11px] font-semibold text-bosque">
            <span className="tnum">{formatoDistancia(escala.metros)}</span>
            <span className="h-1.5 border-x-2 border-b-2 border-bosque" style={{ width: escala.px }} aria-hidden="true" />
          </div>
        )}
      </div>

      {!p.simple && (
      <div className="absolute bottom-3 left-3 z-20 flex justify-center" style={{ right: derecha }}>
        <div className="flex w-full max-w-[540px] items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_2px_6px_rgb(25_58_39/0.18)]">
          <button
            type="button"
            onClick={() => {
              paseo.current?.stop();
              setMinAnim(null);
              if (!reproduciendo && aMin(hora) >= aMin(ultimo)) setHora(cfg.inicio);
              setReproduciendo((x) => !x);
            }}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-bosque text-rueda transition-colors hover:bg-bosque-900"
            aria-label={reproduciendo ? "Pausar la hora" : "Avanzar la hora"}
          >
            {reproduciendo ? (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                <rect x="2" y="1" width="3.5" height="12" rx="1" />
                <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                <path d="M3 1.5v11l9-5.5z" />
              </svg>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="relative">
              <div
                className="pointer-events-none absolute top-[3px] h-1.5 rounded-full bg-bosque/25"
                style={{ left: `${nocheIni}%`, width: `${nocheAncho}%` }}
                aria-hidden="true"
              />
              <input
                type="range"
                aria-label="Hora en la red"
                className="w-full accent-[#e07a2b]"
                min={aMin(cfg.inicio)}
                max={aMin(ultimo)}
                step={cfg.intervalo_min}
                value={aMin(hora)}
                onChange={(e) => {
                  paseo.current?.stop();
                  setMinAnim(null);
                  setReproduciendo(false);
                  setHora(aHora(Number(e.target.value)));
                }}
              />
            </div>
            <div className="tnum flex justify-between whitespace-nowrap text-[11px] font-medium text-muted">
              <span>{cfg.inicio}</span>
              <span className="hidden sm:inline">noche {cfg.inicio_noche}</span>
              <span>{cfg.fin}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display tnum text-[22px] font-extrabold leading-none text-bosque">{hora}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-muted">{noche ? "☾ noche" : "☀ día"}</p>
          </div>
        </div>
      </div>
      )}

      <span className={`pointer-events-none absolute left-3 z-10 grid size-10 ${p.simple ? "bottom-3" : "bottom-[84px]"} place-items-center rounded-xl bg-white/90 shadow-[0_1px_4px_rgb(25_58_39/0.2)]`}>
        <img src="/marca/logo.png" alt="BiciRutas" className="h-7 w-auto opacity-90" />
      </span>

      {(capas.trafico || (capas.calor && p.calor)) && (
        <div className="absolute bottom-[86px] left-[60px] z-10 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-bosque shadow-[0_1px_4px_rgb(25_58_39/0.2)]">
          {capas.calor && p.calor ? "Sin sobrecarga" : "Fluido"}
          {[0.3, 0.85, 1.1, 1.5].map((v) => (
            <span key={v} className="h-1.5 w-5 rounded-full" style={{ background: colorTrafico(v) }} />
          ))}
          {capas.calor && p.calor ? "Alta" : "Saturado"}
          {loteQ.isFetching && capas.trafico && <span className="ml-1 text-muted">· cargando…</span>}
        </div>
      )}
    </div>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold shadow-[0_1px_4px_rgb(25_58_39/0.18)] transition-colors ${
        activo ? "bg-bosque text-white" : "bg-white text-bosque hover:bg-[#f7f5ef]"
      }`}
    >
      {activo && <span aria-hidden="true" className="text-rueda">● </span>}
      {children}
    </button>
  );
}

function BotonMapa({ onClick, etiqueta, children, activo }: { onClick: () => void; etiqueta: string; children: ReactNode; activo?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className={`grid size-12 place-items-center rounded-xl shadow-[0_1px_4px_rgb(25_58_39/0.2)] transition-colors ${
        activo ? "bg-bosque-100 text-bosque" : "bg-white text-bosque hover:bg-[#f1efe8]"
      }`}
    >
      {children}
    </button>
  );
}
