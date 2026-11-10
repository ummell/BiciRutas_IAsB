import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { EstadoTramo, Paso, Red } from "../lib/api";
import { buildEdges, NODE_R } from "../lib/geometry";
import { motivoBloqueo, motivoRestriccion } from "../lib/texto";

const C = {
  libre: "#8b98ad",
  restringido: "#d99a00",
  bloqueado: "#fb2f70",
  ruta: "#0997e6",
  rutaTarde: "#febd04",
  navy: "#023365",
};
const CALOR = ["#8b98ad", "#e0a100", "#f26b3a", "#d61f5f"];

function colorCalor(valor: number, max: number): string {
  if (valor <= 0 || max <= 0) return CALOR[0];
  const r = valor / max;
  if (r > 0.66) return CALOR[3];
  if (r > 0.33) return CALOR[2];
  return CALOR[1];
}

interface Props {
  red: Red;
  origen?: string;
  destino?: string;
  ruta?: Paso[];
  rutaTarde?: boolean;
  estado?: Record<string, EstadoTramo>;
  calor?: Record<string, number>;
  calorMax?: number;
  onNodo?: (id: string) => void;
  rutaKey?: string;
}

export function NetworkMap({
  red,
  origen,
  destino,
  ruta,
  rutaTarde,
  estado,
  calor,
  calorMax = 0,
  onNodo,
  rutaKey,
}: Props) {
  const reducir = useReducedMotion();
  const [foco, setFoco] = useState<string | null>(null);
  const geom = useMemo(() => buildEdges(red.nodos, red.tramos), [red.nodos, red.tramos]);
  const tramos = useMemo(() => new Map(red.tramos.map((t) => [t.id, t])), [red.tramos]);
  const nodos = useMemo(() => new Map(red.nodos.map((n) => [n.id, n])), [red.nodos]);

  const restringidos = useMemo(() => {
    const s = new Set<string>(red.restricciones.map((r) => r.tramo_id));
    red.tramos.filter((t) => !t.iluminado).forEach((t) => s.add(t.id));
    return s;
  }, [red]);

  const enRuta = new Set(ruta?.map((p) => p.tramo_id));
  const hayRuta = enRuta.size > 0;
  const colores = [...CALOR, C.libre, C.restringido, C.bloqueado, C.ruta, C.rutaTarde];
  const colorRuta = rutaTarde ? C.rutaTarde : C.ruta;

  function estiloBase(id: string) {
    const bloqueado = estado?.[id]?.seguro === false;
    if (calor) {
      const v = calor[id] ?? 0;
      return { color: colorCalor(v, calorMax), ancho: v > 0 ? 3.5 : 2, dash: undefined as string | undefined };
    }
    if (bloqueado) return { color: C.bloqueado, ancho: 2.5, dash: "2 5" };
    if (restringidos.has(id)) return { color: C.restringido, ancho: 2.5, dash: "8 5" };
    return { color: C.libre, ancho: 2, dash: undefined };
  }

  const tramoFoco = foco ? tramos.get(foco) : undefined;
  const restriccionesFoco = foco ? red.restricciones.filter((r) => r.tramo_id === foco) : [];

  return (
    <div className="relative">
      <svg
        viewBox="0 -40 880 640"
        className="block h-auto w-full"
        role="img"
        aria-label="Red de ciclorrutas con 16 nodos y 28 tramos dirigidos"
      >
        <defs>
          {colores.map((c) => (
            <g key={c}>
              <marker
                id={`flecha-${c.slice(1)}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="10"
                markerHeight="10"
                orient="auto"
              >
                <path d="M0 0 L10 5 L0 10 z" fill={c} />
              </marker>
              <marker
                id={`flechaR-${c.slice(1)}`}
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="15"
                markerHeight="15"
                orient="auto"
              >
                <path d="M0 0 L10 5 L0 10 z" fill={c} />
              </marker>
            </g>
          ))}
        </defs>

        <g>
          {red.tramos.map((t) => {
            const g = geom[t.id];
            if (!g) return null;
            const { color, ancho, dash } = estiloBase(t.id);
            const tenue = hayRuta && !enRuta.has(t.id);
            return (
              <g key={t.id} opacity={tenue ? 0.38 : 1} style={{ transition: "opacity 200ms" }}>
                <path
                  d={g.d}
                  fill="none"
                  stroke={color}
                  strokeWidth={ancho}
                  strokeDasharray={dash}
                  strokeLinecap="round"
                  markerEnd={`url(#flecha-${color.slice(1)})`}
                  style={{ transition: "stroke 250ms" }}
                />
                <path
                  d={g.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  onMouseEnter={() => setFoco(t.id)}
                  onMouseLeave={() => setFoco((f) => (f === t.id ? null : f))}
                />
                <text
                  x={g.lx}
                  y={g.ly - 5}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight={600}
                  fill="#56627a"
                  stroke="#fff"
                  strokeWidth={3}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {t.id}
                </text>
              </g>
            );
          })}
        </g>

        <g key={rutaKey} pointerEvents="none">
          {ruta?.map((p, i) => {
            const g = geom[p.tramo_id];
            if (!g) return null;
            return (
              <motion.path
                key={`${p.tramo_id}-${i}`}
                d={g.d}
                fill="none"
                stroke={colorRuta}
                strokeWidth={6}
                strokeLinecap="round"
                markerEnd={`url(#flechaR-${colorRuta.slice(1)})`}
                initial={reducir ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={
                  reducir
                    ? { duration: 0 }
                    : {
                        pathLength: { delay: 0.12 + i * 0.28, duration: 0.42, ease: [0.16, 1, 0.3, 1] },
                        opacity: { delay: 0.12 + i * 0.28, duration: 0.05 },
                      }
                }
              />
            );
          })}
        </g>

        <g>
          {red.nodos.map((n) => {
            const esOrigen = n.id === origen;
            const esDestino = n.id === destino;
            const relleno = esOrigen ? C.navy : esDestino ? C.ruta : "#fff";
            const sobre = esOrigen || esDestino;
            const num = n.id.slice(1);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                onClick={onNodo ? () => onNodo(n.id) : undefined}
                onKeyDown={
                  onNodo
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onNodo(n.id);
                        }
                      }
                    : undefined
                }
                tabIndex={onNodo ? 0 : undefined}
                role={onNodo ? "button" : undefined}
                aria-label={`${n.nombre}${esOrigen ? ", origen" : ""}${esDestino ? ", destino" : ""}`}
                style={{ cursor: onNodo ? "pointer" : "default" }}
              >
                <motion.circle
                  r={NODE_R}
                  fill={relleno}
                  stroke={C.navy}
                  strokeWidth={2.5}
                  animate={{ scale: sobre ? 1.12 : 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                />
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  fontSize="13"
                  fontWeight={700}
                  fill={sobre ? "#fff" : C.navy}
                  pointerEvents="none"
                >
                  {num}
                </text>
                <text
                  y={NODE_R + 17}
                  textAnchor="middle"
                  fontSize="12.5"
                  fontWeight={600}
                  fill="#14213d"
                  stroke="#fff"
                  strokeWidth={4}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {n.nombre}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div
        className="pointer-events-none absolute bottom-2 left-2 min-h-0 max-w-[22rem] rounded-xl bg-navy px-4 py-3 text-sm text-white shadow-card transition-opacity duration-150"
        style={{ opacity: tramoFoco ? 1 : 0 }}
        aria-hidden={!tramoFoco}
      >
        {tramoFoco && (
          <>
            <p className="font-bold">
              {tramoFoco.id} · {nodos.get(tramoFoco.origen)?.nombre} → {nodos.get(tramoFoco.destino)?.nombre}
            </p>
            <p className="tnum mt-0.5 text-white/80">
              {tramoFoco.tiempo_base_min} min base · capacidad {tramoFoco.capacidad_bicis} bicis ·{" "}
              {tramoFoco.iluminado ? "iluminado" : "sin iluminación"}
            </p>
            {estado?.[tramoFoco.id]?.seguro === false && (
              <p className="mt-1 font-semibold text-[#ffd0de]">
                No se puede usar ahora: {motivoBloqueo(estado[tramoFoco.id].motivo)}
              </p>
            )}
            {restriccionesFoco.map((r) => (
              <p key={r.id} className="tnum mt-1 text-white/85">
                {motivoRestriccion(r.motivo)} · {r.inicio}–{r.fin}
              </p>
            ))}
            {calor && (
              <p className="tnum mt-1 text-white/85">Sobrecarga acumulada: {calor[tramoFoco.id] ?? 0}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function LeyendaMapa({ modo }: { modo: "consulta" | "calor" }) {
  const item = (color: string, dash: string | undefined, ancho: number, texto: string) => (
    <li className="flex items-center gap-2">
      <svg width="34" height="10" aria-hidden="true">
        <line x1="2" y1="5" x2="32" y2="5" stroke={color} strokeWidth={ancho} strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      <span>{texto}</span>
    </li>
  );
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] font-medium text-muted">
      {modo === "consulta" ? (
        <>
          {item(C.libre, undefined, 2, "Tramo libre")}
          {item(C.restringido, "8 5", 2.5, "Restringido en algún horario")}
          {item(C.bloqueado, "2 5", 2.5, "Bloqueado a esta hora")}
          {item(C.ruta, undefined, 6, "Ruta recomendada")}
          {item(C.rutaTarde, undefined, 6, "Ruta que llega tarde")}
        </>
      ) : (
        <>
          {item(CALOR[0], undefined, 2, "Sin sobrecarga")}
          {item(CALOR[1], undefined, 3.5, "Baja")}
          {item(CALOR[2], undefined, 3.5, "Media")}
          {item(CALOR[3], undefined, 3.5, "Alta")}
          {item(C.ruta, undefined, 6, "Viaje seleccionado")}
        </>
      )}
    </ul>
  );
}
