import { motion, useReducedMotion } from "motion/react";
import { useMemo, type ReactNode } from "react";
import type { EstadoTramo, Red, Restriccion, Tramo } from "../lib/api";
import { formatoDistancia, TIPO_TRAMO } from "../lib/mapa";
import { motivoBloqueo, motivoRestriccion } from "../lib/texto";

const W = 640;
const H = 320;
const HY = 136;
const VX = 320;
const MEDIO = 250;

const gx = (u: number, s: number) => VX + u * MEDIO * s;
const gy = (s: number) => HY + (H - HY) * s;
const pt = (u: number, s: number, alto = 0) => `${gx(u, s)},${gy(s) - alto * s}`;

function franja(u1: number, u2: number, s1: number, s2: number) {
  return `${pt(u1, s1)} ${pt(u2, s1)} ${pt(u2, s2)} ${pt(u1, s2)}`;
}

function aleatorio(n: number) {
  const s = Math.sin(n * 91.7 + 13.1) * 43758.5453;
  return s - Math.floor(s);
}

function Edificios({ lado, noche, semilla }: { lado: 1 | -1; noche: boolean; semilla: number }) {
  const cortes = [1.25, 0.82, 0.58, 0.42, 0.31, 0.23, 0.17, 0.12];
  const colores = noche ? ["#16301f", "#1c3a28", "#122a1b"] : ["#667f63", "#7a9276", "#8fa58b", "#4f6a4c"];
  return (
    <g>
      {cortes.slice(0, -1).map((s1, i) => {
        const s2 = cortes[i + 1];
        const alto = 120 + aleatorio(semilla + i * 3 + lado) * 260;
        const u = lado * 1.55;
        const fill = colores[Math.floor(aleatorio(semilla + i + lado * 7) * colores.length)];
        const caraFrente = `${pt(u, s1)} ${pt(u, s2)} ${pt(u, s2, alto)} ${pt(u, s1, alto)}`;
        const ventanas = [];
        for (let f = 0; f < 4; f++) {
          for (let c = 0; c < 3; c++) {
            const a = s1 + ((s2 - s1) * (c + 0.25)) / 3;
            const b = s1 + ((s2 - s1) * (c + 0.75)) / 3;
            const h1 = alto * (0.2 + f * 0.2);
            const h2 = h1 + alto * 0.1;
            const prendida = noche && aleatorio(semilla * 3 + i * 17 + f * 5 + c + lado) > 0.45;
            ventanas.push(
              <polygon
                key={`${f}-${c}`}
                points={`${pt(u, a, h1)} ${pt(u, b, h1)} ${pt(u, b, h2)} ${pt(u, a, h2)}`}
                fill={prendida ? "#ffd9b0" : noche ? "#0b1a12" : "#dde6d8"}
                opacity={noche ? 0.95 : 0.5}
              />,
            );
          }
        }
        return (
          <g key={i}>
            <polygon points={caraFrente} fill={fill} stroke={noche ? "#0a1a10" : "#4f6a4c"} strokeWidth={0.6} />
            {ventanas}
          </g>
        );
      })}
    </g>
  );
}

function Ciclista({ u, s, color = "#193a27" }: { u: number; s: number; color?: string }) {
  const x = gx(u, s);
  const y = gy(s);
  const k = s * 1.5;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={-9} cy={-7} r={7} />
      <circle cx={9} cy={-7} r={7} />
      <path d="M -9 -7 L -3 -18 L 6 -18 L 9 -7 M -3 -18 L 1 -7 L 6 -18" />
      <path d="M -1 -19 L 2 -30 L 6 -24" />
      <circle cx={3} cy={-35} r={4} fill={color} stroke="none" />
    </g>
  );
}

function Farol({ lado, s, noche, apagado }: { lado: 1 | -1; s: number; noche: boolean; apagado: boolean }) {
  const u = lado * 1.18;
  const alto = 175;
  const x = gx(u, s);
  const yb = gy(s);
  const yt = yb - alto * s;
  const brazo = -lado * 22 * s;
  return (
    <g>
      {noche && !apagado && (
        <>
          <ellipse cx={x + brazo} cy={yb} rx={70 * s} ry={14 * s} fill="#ffd9b0" opacity={0.26} />
          <circle cx={x + brazo} cy={yt + 4 * s} r={34 * s} fill="url(#halo-farol)" />
        </>
      )}
      <line x1={x} y1={yb} x2={x} y2={yt} stroke={noche ? "#2b5038" : "#4c524e"} strokeWidth={Math.max(1, 3.2 * s)} />
      <line x1={x} y1={yt} x2={x + brazo} y2={yt} stroke={noche ? "#2b5038" : "#4c524e"} strokeWidth={Math.max(1, 2.6 * s)} />
      <rect
        x={x + brazo - 6 * s}
        y={yt}
        width={12 * s}
        height={4 * s}
        rx={1.5 * s}
        fill={noche ? (apagado ? "#16301f" : "#ffe6c8") : "#6b746e"}
      />
    </g>
  );
}

export interface VistaCalleProps {
  red: Red;
  tramo: Tramo;
  hora: string;
  noche: boolean;
  estado?: EstadoTramo;
  restricciones: Restriccion[];
  carga?: { total: number; capacidad: number };
  enRuta: boolean;
  expandida: boolean;
  onExpandir: () => void;
  onCerrar: () => void;
  onIr: (tramoId: string) => void;
  siguienteEnRuta?: string;
  anteriorEnRuta?: string;
}

export function VistaCalle(p: VistaCalleProps) {
  const reducir = useReducedMotion();
  const { tramo, noche } = p;
  const nombre = (id: string) => p.red.nodos.find((n) => n.id === id)?.nombre ?? id;
  const bloqueado = p.estado?.seguro === false;
  const motivo = bloqueado ? motivoBloqueo(p.estado?.motivo ?? null) : null;
  const sinLuz = !tramo.iluminado && noche;
  const obras = bloqueado && !sinLuz && tramo.tipo !== "via_no_habilitada";
  const semilla = Number(tramo.id.replace(/\D/g, "")) || 1;

  const salidas = useMemo(
    () => p.red.tramos.filter((t) => t.origen === tramo.destino && t.destino !== tramo.origen),
    [p.red.tramos, tramo],
  );
  const vuelta = p.red.tramos.find((t) => t.origen === tramo.destino && t.destino === tramo.origen);

  const bicis = Math.min(7, p.carga?.total ?? 0);
  const posBicis = [0.78, 0.55, 0.4, 0.3, 0.24, 0.19, 0.15].slice(0, bicis);
  const saturado = p.carga ? p.carga.total > p.carga.capacidad : false;

  const asfalto = tramo.tipo === "via_no_habilitada" ? (noche ? "#1b2420" : "#4c524e") : noche ? "#22312a" : "#5f6a63";
  const anden = noche ? "#2c4a37" : "#e9e4d8";
  const pasto = noche ? "#1c3a28" : "#a9bba6";

  return (
    <motion.section
      layout={!reducir}
      aria-label={`Vista de calle del tramo ${tramo.id}`}
      className={`pointer-events-auto flex flex-col overflow-hidden bg-bosque-900 text-[#ede8dc] shadow-2xl ${
        p.expandida ? "absolute inset-0 z-30 rounded-none" : "w-full rounded-2xl"
      }`}
      initial={reducir ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reducir ? undefined : { opacity: 0, y: 16 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative min-h-0 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={`block w-full ${p.expandida ? "h-full" : "aspect-[2/1]"}`} role="img" aria-label={`${TIPO_TRAMO[tramo.tipo] ?? tramo.tipo} de ${nombre(tramo.origen)} a ${nombre(tramo.destino)} a las ${p.hora}`}>
          <defs>
            <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
              {noche ? (
                <>
                  <stop offset="0" stopColor="#07140d" />
                  <stop offset="1" stopColor="#1c3a28" />
                </>
              ) : (
                <>
                  <stop offset="0" stopColor="#c9d8c6" />
                  <stop offset="1" stopColor="#f4f1ea" />
                </>
              )}
            </linearGradient>
            <radialGradient id="halo-farol">
              <stop offset="0" stopColor="#ffd9b0" stopOpacity="0.9" />
              <stop offset="1" stopColor="#ffd9b0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="niebla" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={noche ? "#1c3a28" : "#f4f1ea"} stopOpacity="0.9" />
              <stop offset="1" stopColor={noche ? "#1c3a28" : "#f4f1ea"} stopOpacity="0" />
            </linearGradient>
          </defs>

          <rect width={W} height={HY + 1} fill="url(#cielo)" />
          {noche &&
            Array.from({ length: 26 }, (_, i) => (
              <circle key={i} cx={aleatorio(i + 1) * W} cy={aleatorio(i + 40) * (HY - 20)} r={aleatorio(i + 80) * 1.2 + 0.3} fill="#fff" opacity={0.7} />
            ))}
          {!noche && (
            <g fill="#fff" opacity={0.85}>
              <ellipse cx={130} cy={42} rx={38} ry={10} />
              <ellipse cx={160} cy={36} rx={24} ry={11} />
              <ellipse cx={480} cy={58} rx={46} ry={9} />
            </g>
          )}
          {noche && <circle cx={540} cy={36} r={12} fill="#f4f1de" opacity={0.9} />}

          <rect y={HY} width={W} height={H - HY} fill={pasto} />
          <Edificios lado={-1} noche={noche} semilla={semilla} />
          <Edificios lado={1} noche={noche} semilla={semilla + 50} />
          <rect y={HY - 18} width={W} height={20} fill="url(#niebla)" />

          <polygon points={franja(-1.5, -1, 1.3, 0)} fill={anden} />
          <polygon points={franja(1, 1.5, 1.3, 0)} fill={anden} />
          <polygon points={franja(-1, 1, 1.3, 0)} fill={asfalto} />

          {tramo.tipo === "ciclorruta" && (
            <>
              <polygon points={franja(0.12, 0.92, 1.3, 0)} fill={noche ? "#245f3b" : "#2f7a4b"} />
              <polygon points={franja(0.12, 0.16, 1.3, 0)} fill="#fff" opacity={0.9} />
              <polygon points={franja(0.88, 0.92, 1.3, 0)} fill="#fff" opacity={0.9} />
              <g opacity={0.95}>
                <Ciclista u={0.52} s={0.95} color="#ffffff" />
              </g>
            </>
          )}
          {tramo.tipo !== "via_no_habilitada" &&
            [1.1, 0.8, 0.6, 0.45, 0.34, 0.26, 0.2].map((s, i) => (
              <polygon key={i} points={franja(-0.02, 0.02, s, s * 0.86)} fill="#fff" opacity={0.85} />
            ))}
          {tramo.tipo === "via_no_habilitada" && (
            <>
              <polygon points={franja(-0.05, -0.02, 1.3, 0)} fill="#fbbc04" />
              <polygon points={franja(0.02, 0.05, 1.3, 0)} fill="#fbbc04" />
            </>
          )}
          {tramo.tipo === "via_mixta" && (
            <g opacity={0.9}>
              <polygon points={franja(0.4, 0.6, 0.62, 0.56)} fill="#fff" />
              <polygon points={franja(0.4, 0.6, 0.53, 0.49)} fill="#fff" />
              <Ciclista u={0.5} s={0.82} color="#ffffff" />
            </g>
          )}
          {tramo.tipo !== "ciclorruta" && (
            <g transform={`translate(${gx(-0.5, 0.45)} ${gy(0.45)}) scale(${0.45 * 1.6})`}>
              <rect x={-34} y={-30} width={68} height={24} rx={6} fill={tramo.tipo === "via_no_habilitada" ? "#b5322a" : "#667f63"} />
              <rect x={-24} y={-44} width={48} height={18} rx={5} fill={tramo.tipo === "via_no_habilitada" ? "#b5322a" : "#667f63"} />
              <rect x={-20} y={-41} width={40} height={11} rx={3} fill="#dde6d8" opacity={0.85} />
              <circle cx={-20} cy={-6} r={7} fill="#193a27" />
              <circle cx={20} cy={-6} r={7} fill="#193a27" />
              {noche && (
                <>
                  <circle cx={-28} cy={-20} r={3} fill="#ffe6c8" />
                  <circle cx={28} cy={-20} r={3} fill="#ffe6c8" />
                </>
              )}
            </g>
          )}

          {[0.95, 0.62, 0.42, 0.29, 0.2].map((s, i) => (
            <g key={i}>
              <Farol lado={-1} s={s} noche={noche} apagado={!tramo.iluminado} />
              <Farol lado={1} s={s} noche={noche} apagado={!tramo.iluminado} />
            </g>
          ))}

          {posBicis.map((s, i) => (
            <Ciclista key={i} u={tramo.tipo === "ciclorruta" ? 0.36 + (i % 2) * 0.3 : 0.55 + (i % 2) * 0.25} s={s} color={noche ? "#ede8dc" : "#193a27"} />
          ))}

          {tramo.tipo === "via_no_habilitada" && (
            <g transform={`translate(${gx(1.25, 0.7)} ${gy(0.7) - 150 * 0.7})`}>
              <line x1={0} y1={0} x2={0} y2={150 * 0.7} stroke="#4c524e" strokeWidth={3} />
              <circle r={24} fill="#fff" stroke="#b5322a" strokeWidth={6} />
              <g transform="scale(0.9)" fill="none" stroke="#193a27" strokeWidth={2.4} strokeLinecap="round">
                <circle cx={-8} cy={4} r={6} />
                <circle cx={8} cy={4} r={6} />
                <path d="M -8 4 L -3 -6 L 5 -6 L 8 4" />
              </g>
              <line x1={-17} y1={-17} x2={17} y2={17} stroke="#b5322a" strokeWidth={5} />
            </g>
          )}

          {obras && (
            <g>
              {[-0.8, -0.4, 0, 0.4, 0.8].map((u) => (
                <g key={u} transform={`translate(${gx(u, 0.55)} ${gy(0.55)}) scale(0.9)`}>
                  <path d="M -9 0 L 9 0 L 3 -30 L -3 -30 Z" fill="#b5322a" />
                  <rect x={-6} y={-18} width={12} height={4} fill="#fff" />
                </g>
              ))}
              <g transform={`translate(${VX} ${gy(0.62) - 70})`}>
                <rect x={-150} y={0} width={300} height={22} rx={4} fill="#fff" />
                {Array.from({ length: 10 }, (_, i) => (
                  <path key={i} d={`M ${-150 + i * 30} 22 L ${-135 + i * 30} 0 L ${-120 + i * 30} 0 L ${-135 + i * 30} 22 Z`} fill="#b5322a" />
                ))}
                <line x1={-135} y1={22} x2={-135} y2={62} stroke="#4c524e" strokeWidth={4} />
                <line x1={135} y1={22} x2={135} y2={62} stroke="#4c524e" strokeWidth={4} />
              </g>
            </g>
          )}

          {sinLuz && <rect width={W} height={H} fill="#05100a" opacity={0.6} />}

          <g opacity={0.9}>
            <path
              d={`M ${VX - 34} ${H - 34} L ${VX} ${H - 58} L ${VX + 34} ${H - 34}`}
              fill="none"
              stroke="#fff"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/65 to-transparent p-3.5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Vista de calle · {tramo.id}</p>
            <p className="truncate font-display text-[17px] font-extrabold leading-snug">
              {nombre(tramo.origen)} <span className="text-white/60">→</span> {nombre(tramo.destino)}
            </p>
            <p className="tnum text-[12px] font-semibold text-white/75">
              {p.hora} · {noche ? "de noche" : "de día"}
              {p.enRuta && <span className="ml-2 rounded bg-rueda px-1.5 py-0.5 text-[10px] font-bold text-bosque-900">EN TU RUTA</span>}
            </p>
          </div>
          <div className="pointer-events-auto flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={p.onExpandir}
              className="grid size-9 place-items-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/70"
              aria-label={p.expandida ? "Reducir vista de calle" : "Ampliar vista de calle"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {p.expandida ? <path d="M6 2v4H2M10 14v-4h4M14 6h-4V2M2 10h4v4" /> : <path d="M2 6V2h4M14 10v4h-4M10 2h4v4M6 14H2v-4" />}
              </svg>
            </button>
            <button
              type="button"
              onClick={p.onCerrar}
              className="grid size-9 place-items-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/70"
              aria-label="Cerrar vista de calle"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M2 2l10 10M12 2 2 12" />
              </svg>
            </button>
          </div>
        </div>

        {(bloqueado || sinLuz || saturado) && (
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1.5">
            {bloqueado && (
              <span className="rounded-full bg-[#b5322a] px-3 py-1 text-[12px] font-bold">No se puede usar: {motivo}</span>
            )}
            {saturado && p.carga && (
              <span className="tnum rounded-full bg-[#6e1e1a] px-3 py-1 text-[12px] font-bold">
                Saturado: {p.carga.total} bicis para {p.carga.capacidad} de capacidad
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 p-3.5">
        <dl className="tnum grid grid-cols-3 gap-2 text-center text-[12px]">
          <div className="rounded-xl bg-white/8 px-2 py-2">
            <dt className="text-white/60">Tipo</dt>
            <dd className="font-bold">{TIPO_TRAMO[tramo.tipo] ?? tramo.tipo}</dd>
          </div>
          <div className="rounded-xl bg-white/8 px-2 py-2">
            <dt className="text-white/60">Distancia</dt>
            <dd className="font-bold">
              {formatoDistancia(tramo.distancia_m)} · {tramo.tiempo_base_min} min
            </dd>
          </div>
          <div className="rounded-xl bg-white/8 px-2 py-2">
            <dt className="text-white/60">Bicis ahora</dt>
            <dd className={`font-bold ${saturado ? "text-[#f3b4ac]" : ""}`}>
              {p.carga ? `${p.carga.total} / ${p.carga.capacidad}` : `cap. ${tramo.capacidad_bicis}`}
            </dd>
          </div>
        </dl>
        <p className="text-[12.5px] text-white/75">
          {tramo.iluminado ? "Tramo iluminado." : `Sin iluminación: no se puede usar desde las ${p.red.config.inicio_noche}.`}{" "}
          {p.restricciones.length > 0 &&
            p.restricciones.map((r) => `${motivoRestriccion(r.motivo)} de ${r.inicio} a ${r.fin}.`).join(" ")}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {p.anteriorEnRuta && (
            <BotonIr onClick={() => p.onIr(p.anteriorEnRuta!)} flecha="atras">
              Tramo anterior
            </BotonIr>
          )}
          {p.siguienteEnRuta ? (
            <BotonIr onClick={() => p.onIr(p.siguienteEnRuta!)} flecha="adelante" primario>
              Seguir la ruta
            </BotonIr>
          ) : (
            salidas.map((t) => (
              <BotonIr key={t.id} onClick={() => p.onIr(t.id)} flecha="adelante">
                {t.id} hacia {nombre(t.destino)}
              </BotonIr>
            ))
          )}
          {vuelta && !p.siguienteEnRuta && (
            <BotonIr onClick={() => p.onIr(vuelta.id)} flecha="vuelta">
              Dar la vuelta
            </BotonIr>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function BotonIr({
  children,
  onClick,
  flecha,
  primario,
}: {
  children: ReactNode;
  onClick: () => void;
  flecha: "adelante" | "atras" | "vuelta";
  primario?: boolean;
}) {
  const d = flecha === "adelante" ? "M3 8h9M8 4l4 4-4 4" : flecha === "atras" ? "M13 8H4M8 4 4 8l4 4" : "M4 6a4 4 0 1 1 0 4M4 3v3h3";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
        primario ? "bg-rueda text-bosque-900 hover:bg-[#ee9248]" : "bg-white/12 text-[#ede8dc] hover:bg-white/22"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
      {children}
    </button>
  );
}
