import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PE } from "react";
import type { EstadoTramo, Paso, Red } from "../lib/api";
import { colorTrafico, MARCA, TRAFICO, type Caja, type Fondo, type Paleta, type Via } from "../lib/mapa";
import { aMin } from "../lib/time";

export interface Capas {
  calor: boolean;
  ciclo: boolean;
  trafico: boolean;
  seguridad: boolean;
  etiquetas: boolean;
}

interface Props {
  red: Red;
  vias: Record<string, Via>;
  fondo: Fondo;
  paleta: Paleta;
  vb: Caja;
  setVb: (f: (v: Caja) => Caja) => void;
  ancho: number;
  origen?: string;
  destino?: string;
  ruta?: Paso[];
  rutaTarde?: boolean;
  rutaKey: string;
  estado: Record<string, EstadoTramo>;
  trafico: Record<string, number>;
  capas: Capas;
  tramoSel: string | null;
  tramoResaltado: string | null;
  onHoverTramo: (id: string | null) => void;
  onTramo: (id: string) => void;
  onNodo: (id: string) => void;
  nodoSel: string | null;
  minutoBici: number | null;
  calor?: Record<string, number>;
  calorMax?: number;
  vivo?: boolean;
  radioCobertura?: number;
  parqueaderos?: Set<string>;
}

function colorSobrecarga(v: number, max: number): string {
  if (v <= 0 || max <= 0) return TRAFICO.fluido;
  const r = v / max;
  if (r > 0.66) return TRAFICO.saturado;
  if (r > 0.33) return TRAFICO.denso;
  return TRAFICO.lento;
}

const PIN = "M0 0 C -3.5 -8 -13 -13.5 -13 -24 A 13 13 0 1 1 13 -24 C 13 -13.5 3.5 -8 0 0 Z";

export function MapaCanvas(p: Props) {
  const reducir = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const arrastre = useRef<{ x: number; y: number; vb: Caja; movido: boolean } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const rutaRefs = useRef<(SVGPathElement | null)[]>([]);
  const [bici, setBici] = useState<{ x: number; y: number } | null>(null);

  const { vb, paleta: c } = p;
  const k = vb.w / Math.max(p.ancho, 1);
  const tramos = useMemo(() => new Map(p.red.tramos.map((t) => [t.id, t])), [p.red.tramos]);
  const enRuta = new Set(p.ruta?.map((x) => x.tramo_id));
  const hayRuta = enRuta.size > 0;
  const [nodoHover, setNodoHover] = useState<string | null>(null);
  const enRutaNodo = useMemo(() => {
    const out = new Set<string>();
    p.ruta?.forEach((x) => {
      const t = tramos.get(x.tramo_id);
      if (t) {
        out.add(t.origen);
        out.add(t.destino);
      }
    });
    return out;
  }, [p.ruta, tramos]);

  const animar = Boolean(p.vivo) && !reducir;
  const seguros = useMemo(
    () => new Set(p.red.tramos.filter((t) => t.tipo !== "via_no_habilitada" && p.estado[t.id]?.seguro !== false).map((t) => t.id)),
    [p.red.tramos, p.estado],
  );
  const conCobertura = useMemo(
    () => new Set(p.red.tramos.filter((t) => seguros.has(t.id)).map((t) => t.origen)),
    [p.red.tramos, seguros],
  );
  const ciclistas = useMemo(
    () => p.red.tramos.filter((t, i) => i % 4 === 1 && seguros.has(t.id) && p.vias[t.id]),
    [p.red.tramos, seguros, p.vias],
  );
  const rutaD = p.ruta?.map((x) => p.vias[x.tramo_id]?.d ?? "").join(" ") ?? "";
  const minRuta = p.ruta?.length ? aMin(p.ruta[p.ruta.length - 1].salida) - aMin(p.ruta[0].entrada) : 0;
  const ciclista = useRef<SVGAnimateMotionElement>(null);
  const verCiclista = animar && hayRuta && p.minutoBici === null;

  useEffect(() => {
    if (!verCiclista) return;
    const id = window.setTimeout(() => ciclista.current?.beginElement(), ((p.ruta?.length ?? 0) * 0.25 + 0.4) * 1000);
    return () => window.clearTimeout(id);
  }, [verCiclista, p.rutaKey]);

  useLayoutEffect(() => {
    const pasos = p.ruta;
    if (!pasos?.length || p.minutoBici === null) {
      setBici(null);
      return;
    }
    const m = p.minutoBici;
    let idx = pasos.findIndex((x) => m < aMin(x.salida));
    let f = 0;
    if (idx === -1) {
      idx = pasos.length - 1;
      f = 1;
    } else {
      const a = aMin(pasos[idx].entrada);
      const b = aMin(pasos[idx].salida);
      f = b > a ? Math.min(1, Math.max(0, (m - a) / (b - a))) : 0;
    }
    const el = rutaRefs.current[idx];
    if (!el) return;
    const L = el.getTotalLength();
    const pt = el.getPointAtLength(L * f);
    setBici({ x: pt.x, y: pt.y });
  }, [p.minutoBici, p.ruta, p.rutaKey]);

  const setVbRef = useRef(p.setVb);
  setVbRef.current = p.setVb;
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width;
      const fy = (e.clientY - r.top) / r.height;
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      const f = Math.exp(Math.max(-80, Math.min(80, delta)) * 0.004);
      setVbRef.current((v) => {
        const cx = v.x + fx * v.w;
        const cy = v.y + fy * v.h;
        const w = Math.min(2600, Math.max(180, v.w * f));
        const s = w / v.w;
        return { x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s, w, h: v.h * s };
      });
    };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  }, []);

  function bajar(e: PE<SVGSVGElement>) {
    if (e.button !== 0 || e.pointerType === "touch") return;
    arrastre.current = { x: e.clientX, y: e.clientY, vb, movido: false };
  }
  function mover(e: PE<SVGSVGElement>) {
    const a = arrastre.current;
    if (!a) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    if (!a.movido && Math.hypot(dx, dy) < 4) return;
    if (!a.movido) {
      a.movido = true;
      setArrastrando(true);
      svgRef.current?.setPointerCapture(e.pointerId);
    }
    const r = svgRef.current!.getBoundingClientRect();
    const s = a.vb.w / r.width;
    p.setVb(() => ({ ...a.vb, x: a.vb.x - dx * s, y: a.vb.y - dy * s }));
  }
  function soltar(e: PE<SVGSVGElement>) {
    if (arrastre.current?.movido) svgRef.current?.releasePointerCapture(e.pointerId);
    window.setTimeout(() => {
      arrastre.current = null;
    }, 0);
    setArrastrando(false);
  }
  const fueArrastre = () => arrastre.current?.movido === true;

  const f = p.fondo;
  const cerca = k < 0.9;
  const etiquetas = p.capas.etiquetas || k < 0.75;
  const tenue = hayRuta ? 0.7 : 1;
  const anchoVia = (doble: boolean) => Math.max(doble ? 9 : 11, (doble ? 3 : 3.6) * k);
  const durRuta = (p.ruta?.length ?? 0) * 0.25 + 0.4;

  return (
    <svg
      ref={svgRef}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid slice"
      className={`block h-full w-full select-none ${arrastrando ? "cursor-grabbing" : "cursor-grab"}`}
      role="application"
      aria-label="Mapa de la red de ciclorrutas. Arrastra para mover y usa la rueda o los botones para acercar."
      onPointerDown={bajar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      style={{ background: c.tierra, transition: "background 400ms", touchAction: "pan-y" }}
    >
      <defs>
        <filter id="sombra-pin" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#193a27" floodOpacity="0.35" />
        </filter>
        <radialGradient id="br-cobertura-ok">
          <stop offset="0%" stopColor={c.noche ? c.ciclo : MARCA.bosque600} stopOpacity={c.noche ? 0.3 : 0.24} />
          <stop offset="65%" stopColor={c.noche ? c.ciclo : MARCA.bosque600} stopOpacity={c.noche ? 0.1 : 0.08} />
          <stop offset="100%" stopColor={c.noche ? c.ciclo : MARCA.bosque600} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="br-cobertura-no">
          <stop offset="0%" stopColor={MARCA.bloqueado} stopOpacity={0.2} />
          <stop offset="100%" stopColor={MARCA.bloqueado} stopOpacity={0} />
        </radialGradient>
      </defs>

      <g>
        <rect x={f.limites.x - 4000} y={f.limites.y - 4000} width={f.limites.w + 8000} height={f.limites.h + 8000} fill={c.tierra} style={{ transition: "fill 400ms" }} />
        {f.callesX.map((x) => (
          <line key={`cx${x}`} x1={x} x2={x} y1={f.limites.y} y2={f.limites.y + f.limites.h} stroke={c.calleMenor} strokeWidth={5} />
        ))}
        {f.callesY.map((y) => (
          <line key={`cy${y}`} y1={y} y2={y} x1={f.limites.x} x2={f.limites.x + f.limites.w} stroke={c.calleMenor} strokeWidth={5} />
        ))}
        {f.manzanas.map((m, i) => (
          <rect key={i} x={m.x} y={m.y} width={m.w} height={m.h} rx={4} fill={m.tipo === "parque" ? c.parque : c.manzana} style={{ transition: "fill 400ms" }} />
        ))}
        {cerca &&
          f.manzanas
            .filter((m) => m.tipo === "parque")
            .flatMap((m, i) => {
              const out = [];
              for (let x = m.x + 14; x < m.x + m.w - 8; x += 26) {
                for (let y = m.y + 14; y < m.y + m.h - 8; y += 26) {
                  const dx = ((x * 7 + y * 3) % 9) - 4;
                  out.push(<circle key={`a${i}-${x}-${y}`} cx={x + dx} cy={y} r={4.2} fill={c.arbol} opacity={0.85} />);
                }
              }
              return out;
            })}
        {f.lagos.map((l) => (
          <g key={l.nombre}>
            <path d={l.d} fill={c.agua} style={{ transition: "fill 400ms" }} />
            <text x={l.cx} y={l.cy} textAnchor="middle" fontSize={11.5 * k} fontStyle="italic" fontWeight={600} fill={c.textoAgua} pointerEvents="none">
              {l.nombre}
            </text>
          </g>
        ))}
      </g>

      {p.vivo && p.radioCobertura && (
        <g pointerEvents="none" opacity={hayRuta ? 0.5 : 1} style={{ transition: "opacity 300ms" }}>
          {p.red.nodos.map((n) => {
            const ok = conCobertura.has(n.id);
            return (
              <g key={`cob${n.id}`}>
                <circle cx={n.x} cy={n.y} r={ok ? p.radioCobertura : p.radioCobertura! * 0.55} fill={`url(#br-cobertura-${ok ? "ok" : "no"})`} />
                {ok && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={p.radioCobertura}
                    fill="none"
                    stroke={c.noche ? c.ciclo : MARCA.bosque600}
                    strokeOpacity={0.22}
                    strokeWidth={1.2}
                    strokeDasharray="3 5"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            );
          })}
        </g>
      )}

      <g opacity={tenue} style={{ transition: "opacity 300ms" }}>
        {p.red.tramos.map((t) => {
          const v = p.vias[t.id];
          if (!v) return null;
          const noHab = t.tipo === "via_no_habilitada";
          return (
            <path
              key={`b${t.id}`}
              d={v.d}
              fill="none"
              stroke={noHab ? c.bordeViaNoHab : c.bordeVia}
              strokeWidth={anchoVia(v.doble || noHab) + Math.max(4, 1.4 * k)}
              strokeLinecap="round"
            />
          );
        })}
        {p.red.tramos.map((t) => {
          const v = p.vias[t.id];
          if (!v) return null;
          const noHab = t.tipo === "via_no_habilitada";
          return (
            <path
              key={`v${t.id}`}
              d={v.d}
              fill="none"
              stroke={noHab ? c.viaNoHab : c.via}
              strokeWidth={anchoVia(v.doble || noHab)}
              strokeLinecap="round"
              style={{ transition: "stroke 400ms" }}
            />
          );
        })}

        {p.capas.calor &&
          p.calor &&
          p.red.tramos.map((t) => {
            const v = p.vias[t.id];
            if (!v) return null;
            const val = p.calor![t.id] ?? 0;
            return (
              <path
                key={`k${t.id}`}
                d={v.d}
                fill="none"
                stroke={colorSobrecarga(val, p.calorMax ?? 0)}
                strokeWidth={Math.max(val > 0 ? 6 : 4, (val > 0 ? 3.4 : 2.4) * k)}
                strokeLinecap="round"
                pointerEvents="none"
                style={{ transition: "stroke 250ms" }}
              />
            );
          })}

        {p.capas.ciclo &&
          !p.capas.trafico &&
          !p.capas.calor &&
          p.red.tramos
            .filter((t) => t.tipo !== "via_no_habilitada")
            .map((t) => {
              const v = p.vias[t.id];
              if (!v) return null;
              const g = Math.max(1, k * 0.7);
              return (
                <path
                  key={`c${t.id}`}
                  d={v.d}
                  fill="none"
                  stroke={c.ciclo}
                  strokeWidth={Math.max(2.5, 1.3 * k)}
                  strokeDasharray={t.tipo === "via_mixta" ? `${6 * g} ${4 * g}` : undefined}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              );
            })}

        {p.capas.trafico &&
          !p.capas.calor &&
          p.red.tramos.map((t) => {
            const v = p.vias[t.id];
            if (!v || t.tipo === "via_no_habilitada") return null;
            return (
              <path
                key={`t${t.id}`}
                d={v.d}
                fill="none"
                stroke={colorTrafico(p.trafico[t.id] ?? 0)}
                strokeWidth={Math.max(v.doble ? 4.5 : 5, 2.6 * k)}
                strokeLinecap="round"
                pointerEvents="none"
                style={{ transition: "stroke 250ms" }}
              />
            );
          })}

        {animar &&
          !p.capas.trafico &&
          !p.capas.calor &&
          p.red.tramos.map((t) => {
            const v = p.vias[t.id];
            if (!v || !seguros.has(t.id)) return null;
            const periodo = 22 * Math.max(1, k * 0.8);
            return (
              <path
                key={`fl${t.id}`}
                d={v.d}
                fill="none"
                stroke={c.noche ? c.texto : MARCA.bosque600}
                strokeOpacity={0.55}
                strokeWidth={Math.max(2.4, 1.6 * k)}
                strokeDasharray={`0.1 ${periodo}`}
                strokeLinecap="round"
                pointerEvents="none"
                className="flujo-via"
                style={{ ["--periodo" as string]: `${periodo}px`, ["--dur" as string]: `${0.6 + 0.35 * t.tiempo_base_min}s` }}
              />
            );
          })}

        {cerca &&
          p.red.tramos.map((t) => {
            const v = p.vias[t.id];
            if (!v) return null;
            if (t.tipo === "via_no_habilitada") {
              return (
                <g key={`f${t.id}`} transform={`translate(${v.medio.x} ${v.medio.y}) scale(${k})`} pointerEvents="none">
                  <circle r={8} fill="#ffffff" stroke={MARCA.bloqueado} strokeWidth={1.6} />
                  <g fill="none" stroke={MARCA.bosque} strokeWidth={1.2} strokeLinecap="round">
                    <circle cx={-2.6} cy={1.4} r={1.9} />
                    <circle cx={2.6} cy={1.4} r={1.9} />
                    <path d="M -2.6 1.4 L -0.8 -1.6 L 1.6 -1.6 L 2.6 1.4" />
                  </g>
                  <path d="M -5.5 -5.5 L 5.5 5.5" stroke={MARCA.bloqueado} strokeWidth={1.6} />
                </g>
              );
            }
            const tam = 2.6;
            return (
              <path
                key={`f${t.id}`}
                d={`M ${-tam} ${-tam} L ${tam * 0.6} 0 L ${-tam} ${tam}`}
                transform={`translate(${v.medio.x} ${v.medio.y}) rotate(${v.angulo}) scale(${Math.max(1, k)})`}
                fill="none"
                stroke={p.capas.trafico || p.capas.calor ? "#ffffff" : c.flecha}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            );
          })}
      </g>

      {animar &&
        ciclistas.map((t, i) => {
          const dur = 3 + t.tiempo_base_min * 1.4;
          return (
            <g key={`cic${t.id}`} pointerEvents="none" opacity={hayRuta ? 0.45 : 0.95} style={{ transition: "opacity 300ms" }}>
              <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={p.vias[t.id].d} begin={`${-((i * 1.3) % dur)}s`} />
              <g transform={`scale(${k})`}>
                <circle r={8.5} fill={MARCA.bosque600} stroke="#ffffff" strokeWidth={1.8} />
                <g fill="none" stroke="#ffffff" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx={-3.2} cy={1.8} r={2.2} />
                  <circle cx={3.2} cy={1.8} r={2.2} />
                  <path d="M -3.2 1.8 L -1 -1.9 L 2 -1.9 L 3.2 1.8 M -1 -1.9 L 0.5 1.8 L 2 -1.9" />
                </g>
              </g>
            </g>
          );
        })}

      {p.capas.seguridad && (
        <g pointerEvents="none">
          {p.red.tramos.map((t) => {
            const v = p.vias[t.id];
            if (!v || p.estado[t.id]?.seguro !== false) return null;
            const sinLuz = (p.estado[t.id]?.motivo ?? "").startsWith("Sin iluminación");
            const g = Math.max(1, k * 0.6);
            return (
              <g key={`s${t.id}`}>
                <path
                  d={v.d}
                  fill="none"
                  stroke={MARCA.bloqueado}
                  strokeWidth={Math.max(3, 1.8 * k)}
                  strokeDasharray={`${3 * g} ${4 * g}`}
                  strokeLinecap="round"
                />
                <g transform={`translate(${v.medio.x} ${v.medio.y}) scale(${k})`}>
                  <circle r={9} fill={MARCA.bloqueado} stroke="#ffffff" strokeWidth={2} />
                  {sinLuz ? (
                    <g>
                      <path d="M 2.6 -4.2 A 4.6 4.6 0 1 0 3.8 2.6 A 3.6 3.6 0 0 1 2.6 -4.2 Z" fill="#ffffff" />
                      <path d="M -5 -5 L 5 5" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" />
                    </g>
                  ) : (
                    <rect x={-4.8} y={-1.4} width={9.6} height={2.8} rx={1} fill="#ffffff" />
                  )}
                </g>
              </g>
            );
          })}
        </g>
      )}

      <g key={p.rutaKey} pointerEvents="none">
        {p.ruta?.map((x, i) => {
          const v = p.vias[x.tramo_id];
          if (!v) return null;
          const anim = reducir
            ? { duration: 0 }
            : {
                pathLength: { delay: 0.1 + i * 0.25, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
                opacity: { delay: 0.1 + i * 0.25, duration: 0.05 },
              };
          return (
            <g key={`${x.tramo_id}-${i}`}>
              {c.noche && (
                <motion.path
                  d={v.d}
                  fill="none"
                  stroke={MARCA.rueda}
                  strokeOpacity={0.3}
                  strokeWidth={Math.max(18, 11 * k)}
                  strokeLinecap="round"
                  initial={reducir ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={anim}
                />
              )}
              <motion.path
                d={v.d}
                fill="none"
                stroke={c.bordeRuta}
                strokeWidth={Math.max(10, 7 * k)}
                strokeLinecap="round"
                initial={reducir ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={anim}
              />
              <motion.path
                ref={(el: SVGPathElement | null) => {
                  rutaRefs.current[i] = el;
                }}
                d={v.d}
                fill="none"
                stroke={MARCA.rueda}
                strokeWidth={Math.max(6, 4.2 * k)}
                strokeLinecap="round"
                initial={reducir ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={anim}
              />
            </g>
          );
        })}
        {p.rutaTarde &&
          p.ruta?.map((x, i) => {
            const v = p.vias[x.tramo_id];
            if (!v) return null;
            const g = Math.max(1, k * 0.7);
            return (
              <motion.path
                key={`tarde-${x.tramo_id}-${i}`}
                d={v.d}
                fill="none"
                stroke={c.bordeRuta}
                strokeWidth={Math.max(6.5, 4.6 * k)}
                strokeDasharray={`${6 * g} ${14 * g}`}
                initial={reducir ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reducir ? 0 : durRuta, duration: 0.3 }}
              />
            );
          })}
        {animar && hayRuta && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: durRuta, duration: 0.4 }}>
            {p.ruta?.map((x, i) => {
              const v = p.vias[x.tramo_id];
              if (!v) return null;
              const periodo = 18 * Math.max(1, k * 0.8);
              return (
                <path
                  key={`rf-${x.tramo_id}-${i}`}
                  d={v.d}
                  fill="none"
                  stroke={MARCA.rueda100}
                  strokeWidth={Math.max(3, 2.2 * k)}
                  strokeDasharray={`0.1 ${periodo}`}
                  strokeLinecap="round"
                  className="flujo-via"
                  style={{ ["--periodo" as string]: `${periodo}px`, ["--dur" as string]: "0.9s" }}
                />
              );
            })}
          </motion.g>
        )}
      </g>

      {p.tramoResaltado && p.vias[p.tramoResaltado] && (
        <path
          d={p.vias[p.tramoResaltado].d}
          fill="none"
          stroke={enRuta.has(p.tramoResaltado) ? "#ffffff" : c.texto}
          strokeOpacity={enRuta.has(p.tramoResaltado) ? 0.9 : 0.4}
          strokeWidth={Math.max(3, 1.6 * k)}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}
      {p.tramoSel && p.vias[p.tramoSel] && (
        <g pointerEvents="none">
          <path
            d={p.vias[p.tramoSel].d}
            fill="none"
            stroke={MARCA.rueda}
            strokeOpacity={0.28}
            strokeWidth={Math.max(18, 10 * k)}
            strokeLinecap="round"
          />
          <g transform={`translate(${p.vias[p.tramoSel].medio.x} ${p.vias[p.tramoSel].medio.y}) scale(${k})`}>
            <g filter="url(#sombra-pin)">
              <circle r={12} fill="#ffffff" stroke={MARCA.rueda} strokeWidth={2.5} />
              <circle cy={-4.4} r={2.7} fill={MARCA.rueda} />
              <path d="M -4.2 6.5 L -3.2 0.2 Q 0 -1.8 3.2 0.2 L 4.2 6.5 Z" fill={MARCA.rueda} />
            </g>
          </g>
        </g>
      )}

      <g>
        {p.red.tramos.map((t) => {
          const v = p.vias[t.id];
          if (!v) return null;
          return (
            <path
              key={`h${t.id}`}
              d={v.d}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(12, 16 * k)}
              style={{ cursor: "pointer" }}
              onPointerEnter={() => p.onHoverTramo(t.id)}
              onPointerLeave={() => p.onHoverTramo(null)}
              onClick={() => {
                if (!fueArrastre()) p.onTramo(t.id);
              }}
            >
              <title>
                {t.id} · {tramos.get(t.id)?.tipo.replace(/_/g, " ")} · {t.distancia_m} m
              </title>
            </path>
          );
        })}
      </g>

      {etiquetas && (
        <g pointerEvents="none">
          {p.red.tramos.map((t) => {
            const v = p.vias[t.id];
            if (!v) return null;
            const horizontal = Math.abs(Math.cos((v.angulo * Math.PI) / 180)) > 0.7;
            const off = 14 * k;
            const dx = horizontal ? 0 : v.doble ? (v.angulo > 0 ? -off : off) : off;
            const dy = horizontal ? (v.doble ? (v.angulo === 0 ? -off : off) : -off) : 0;
            return (
              <g key={`e${t.id}`} transform={`translate(${v.medio.x + dx} ${v.medio.y + dy}) scale(${k})`}>
                <rect x={-15} y={-8.5} width={30} height={17} rx={8.5} fill={c.noche ? c.via : "#ffffff"} stroke={c.bordeVia} strokeWidth={1} />
                <text textAnchor="middle" dy="0.35em" fontSize={10.5} fontWeight={600} fill={c.textoSuave}>
                  {t.id}
                </text>
              </g>
            );
          })}
        </g>
      )}

      <g>
        {p.red.nodos.map((n) => {
          const esO = n.id === p.origen;
          const esD = n.id === p.destino;
          const sel = n.id === p.nodoSel;
          const hov = n.id === nodoHover;
          const clave = esO || esD || sel;
          const parq = Boolean(p.vivo && p.parqueaderos?.has(n.id));
          const verNombre = clave || hov || parq || k < 1.15;
          const ok = conCobertura.has(n.id);
          const sep = p.vivo ? (esD ? 22 : parq && !esO ? 19 : 16) : esD ? 17 : 11;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x} ${n.y}) scale(${k})`}
              style={{ cursor: "pointer" }}
              opacity={hayRuta && !clave && !enRutaNodo.has(n.id) ? 0.75 : 1}
              onClick={(e) => {
                e.stopPropagation();
                if (!fueArrastre()) p.onNodo(n.id);
              }}
              onPointerEnter={() => setNodoHover(n.id)}
              onPointerLeave={() => setNodoHover((h) => (h === n.id ? null : h))}
              onFocus={() => setNodoHover(n.id)}
              onBlur={() => setNodoHover((h) => (h === n.id ? null : h))}
              role="button"
              tabIndex={0}
              aria-label={`${n.nombre}${parq ? ", bici-parqueadero" : ""}${esO ? ", origen" : ""}${esD ? ", destino" : ""}${p.vivo && !ok ? ", sin salidas seguras a esta hora" : ""}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  p.onNodo(n.id);
                }
              }}
            >
              <circle r={p.vivo ? 20 : 16} fill="transparent" />
              {sel && <circle r={p.vivo ? 19 : 14} fill={c.noche ? "#2c4a37" : MARCA.bosque100} />}
              {p.vivo && esD ? (
                <motion.g
                  filter="url(#sombra-pin)"
                  initial={reducir ? false : { y: -16, opacity: 0, scale: 1.25 }}
                  animate={{ y: 0, opacity: 1, scale: hov ? 1.4 : 1.25 }}
                  transition={{ type: "spring", stiffness: 420, damping: 16 }}
                  style={{ transformOrigin: "50% 100%" }}
                >
                  <path d={PIN} fill={MARCA.bosque} stroke={c.noche ? "#ede8dc" : "#ffffff"} strokeWidth={1.4} />
                  <path d="M -8.6 -27.2 A 9 9 0 0 1 8.6 -27.2" fill="none" stroke={MARCA.rueda} strokeWidth={3.2} strokeLinecap="round" />
                  <circle cy={-22} r={4.4} fill="#ffffff" />
                </motion.g>
              ) : p.vivo && esO ? (
                <g>
                  <motion.g
                    filter="url(#sombra-pin)"
                    animate={{ scale: hov ? 1.25 : 1 }}
                    transition={reducir ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 18 }}
                  >
                    <circle r={11} fill="#ffffff" stroke={MARCA.bosque} strokeWidth={5} />
                  </motion.g>
                </g>
              ) : parq && !esO && !esD ? (
                <motion.g
                  filter="url(#sombra-pin)"
                  animate={{ scale: hov || sel ? 1.3 : 1 }}
                  transition={reducir ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 18 }}
                >
                  <rect x={-13} y={-13} width={26} height={26} rx={7} fill={MARCA.bosque} stroke="#ffffff" strokeWidth={2.5} />
                  <text textAnchor="middle" dy="0.36em" fontSize={15} fontWeight={800} fill="#ffffff" pointerEvents="none">
                    P
                  </text>
                  <circle cx={10} cy={-10} r={4.5} fill={ok ? MARCA.bosque600 : MARCA.bloqueado} stroke="#ffffff" strokeWidth={1.6} />
                </motion.g>
              ) : p.vivo && !esO && !esD ? (
                <motion.g
                  filter="url(#sombra-pin)"
                  animate={{ scale: hov || sel ? 1.3 : 1 }}
                  transition={reducir ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 18 }}
                >
                  {ok ? (
                    <>
                      <circle r={10} fill="#ffffff" stroke={c.noche ? c.ciclo : MARCA.salvia} strokeWidth={2.5} />
                      <circle r={4.2} fill={c.noche ? c.ciclo : MARCA.bosque600} />
                    </>
                  ) : (
                    <>
                      <circle r={10} fill={MARCA.bloqueado} stroke="#ffffff" strokeWidth={2} />
                      <rect x={-5} y={-1.4} width={10} height={2.8} rx={1} fill="#ffffff" />
                    </>
                  )}
                </motion.g>
              ) : esD ? (
                <motion.g
                  filter="url(#sombra-pin)"
                  initial={reducir ? false : { y: -16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 16 }}
                >
                  <path d={PIN} fill={MARCA.bosque} stroke={c.noche ? "#ede8dc" : "#ffffff"} strokeWidth={1.4} />
                  <path d="M -8.6 -27.2 A 9 9 0 0 1 8.6 -27.2" fill="none" stroke={MARCA.rueda} strokeWidth={3.2} strokeLinecap="round" />
                  <circle cy={-22} r={4.4} fill="#ffffff" />
                </motion.g>
              ) : esO ? (
                <g filter="url(#sombra-pin)">
                  <circle r={8} fill="#ffffff" stroke={MARCA.bosque} strokeWidth={4} />
                </g>
              ) : (
                <circle r={4.6} fill={c.punto} stroke={c.noche ? c.tierra : "#ffffff"} strokeWidth={2} />
              )}
              {parq && (esO || esD) && (
                <g transform={esD ? "translate(-18 -30)" : "translate(12 -12)"} pointerEvents="none">
                  <rect x={-7.5} y={-7.5} width={15} height={15} rx={4} fill={MARCA.bosque} stroke="#ffffff" strokeWidth={1.6} />
                  <text textAnchor="middle" dy="0.36em" fontSize={10} fontWeight={800} fill="#ffffff">
                    P
                  </text>
                </g>
              )}
              {verNombre && (
                <text
                  x={sep}
                  y={esD ? (p.vivo ? -26 : -20) : 4.5}
                  fontSize={p.vivo ? (clave || hov ? 14 : 12.5) : clave ? 13 : 12}
                  fontWeight={clave ? 700 : 600}
                  fill={c.texto}
                  stroke={c.halo}
                  strokeWidth={3.5}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {n.nombre}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {bici && (
        <g transform={`translate(${bici.x} ${bici.y}) scale(${k})`} pointerEvents="none">
          <IconoBici />
        </g>
      )}

      {verCiclista && (
        <motion.g
          key={`ciclista-${p.rutaKey}`}
          pointerEvents="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: durRuta, duration: 0.3 }}
        >
          <animateMotion
            ref={ciclista}
            dur={`${Math.min(12, Math.max(4, minRuta * 0.5))}s`}
            repeatCount="indefinite"
            path={rutaD}
            begin="indefinite"
          />
          <g transform={`scale(${k})`}>
            <IconoBici />
          </g>
        </motion.g>
      )}
    </svg>
  );
}

function IconoBici() {
  return (
    <>
      <circle r={17} fill={MARCA.rueda} opacity={0.22} />
      <circle r={11.5} fill={MARCA.rueda} stroke="#ffffff" strokeWidth={2.5} filter="url(#sombra-pin)" />
      <g fill="none" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={-4.2} cy={2.4} r={3} />
        <circle cx={4.2} cy={2.4} r={3} />
        <path d="M -4.2 2.4 L -1.4 -2.6 L 2.6 -2.6 L 4.2 2.4 M -1.4 -2.6 L 0.6 2.4 L 2.6 -2.6 M -2.4 -4.4 L -0.4 -4.4" />
      </g>
    </>
  );
}
