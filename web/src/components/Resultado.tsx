import { motion, useReducedMotion } from "motion/react";
import type { ConsultaOut, Red } from "../lib/api";
import { aMin } from "../lib/time";
import { plural } from "../lib/texto";
import { EstadoChip } from "./ui";

export interface PuntoRuta {
  id: string;
  hora: string;
  sale?: { tramo: string; min: number };
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <dt className="font-semibold text-white/80">{etiqueta}</dt>
      <span aria-hidden="true" className="min-w-2 flex-1 border-b border-dashed border-white/30" />
      <dd className="tnum font-bold text-white">{valor}</dd>
    </div>
  );
}

const PUNTOS = {
  backgroundImage: "radial-gradient(circle closest-side, rgba(255,255,255,0.55) 90%, transparent)",
  backgroundSize: "9px 4px",
  backgroundRepeat: "repeat-x",
};

interface Props {
  resultado: ConsultaOut;
  red: Red;
  limite: string;
  ampliado: boolean;
  puedeAmpliar: boolean;
  pendiente: boolean;
  onAmpliar: () => void;
  nodosRuta: PuntoRuta[];
}

export function Resultado({ resultado, red, limite, ampliado, puedeAmpliar, pendiente, onAmpliar, nodosRuta }: Props) {
  const reducir = useReducedMotion();
  const r = resultado.recorrido;
  const nombre = (id: string) => red.nodos.find((n) => n.id === id)?.nombre ?? id;

  return (
    <motion.section
      aria-live="polite"
      className="overflow-hidden rounded-2xl bg-navy text-white shadow-card"
      initial={reducir ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducir ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="grid gap-y-6 p-6">
        <div>
          <EstadoChip estado={resultado.estado} grande />
          {r ? (
            <>
              <div className="mt-4 flex items-end gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-white/60">Sale</p>
                  <p className="tnum text-[56px] font-extrabold leading-none">{r.salida}</p>
                </div>
                <svg width="34" height="22" viewBox="0 0 34 22" className="mb-3 text-amber" aria-hidden="true">
                  <path d="M2 11h28M22 3l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-white/60">Llega</p>
                  <p className="tnum text-[56px] font-extrabold leading-none">{r.llegada}</p>
                </div>
              </div>
              <p className="tnum mt-3 text-[15px] font-medium text-white/90">
                {r.duracion_min} min de viaje ·{" "}
                {r.tardanza_min > 0 ? (
                  <strong className="text-amber">{r.tardanza_min} min después del límite ({limite})</strong>
                ) : (
                  <>{aMin(limite) - aMin(r.llegada)} min antes del límite ({limite})</>
                )}
              </p>
              <p className="mt-1 text-[13px] text-white/65">
                {plural(resultado.alternativas, "opción segura evaluada", "opciones seguras evaluadas")}
              </p>
            </>
          ) : (
            <div className="mt-4 max-w-md space-y-2">
              <p className="text-xl font-extrabold leading-snug">No existe una ruta segura para esa ventana de salida.</p>
              <p className="text-sm text-white/75">
                Todos los recorridos posibles usan algún tramo bloqueado a esa hora. Cambiar la hora solo ayuda si el riesgo
                deja de estar vigente.
              </p>
            </div>
          )}
        </div>

        {r && (
          <ol className="flex min-w-0 overflow-x-auto border-t border-white/15 pb-1 pt-5" aria-label="Recorrido">
            {nodosRuta.map((p, i) => (
              <motion.li
                key={`${p.id}-${i}`}
                className="relative flex min-w-[128px] flex-1 flex-col items-stretch"
                initial={reducir ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.07, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="tnum h-5 text-sm font-bold text-amber">{p.hora}</span>
                <div className="relative mt-1.5 flex h-4 items-center">
                  <span
                    className={`relative z-10 size-4 shrink-0 rounded-full border-2 border-navy ${
                      i === 0 || i === nodosRuta.length - 1 ? "bg-white" : "bg-[#7f9cc0]"
                    }`}
                    aria-hidden="true"
                  />
                  {i < nodosRuta.length - 1 && (
                    <span className="ml-1 h-1 flex-1" style={PUNTOS} aria-hidden="true" />
                  )}
                </div>
                <span className="mt-2 pr-3 text-[13px] font-semibold leading-tight text-white/95">{nombre(p.id)}</span>
                {p.sale ? (
                  <dl className="mt-2 space-y-1 pr-4">
                    <Fila etiqueta="Tramo" valor={p.sale.tramo} />
                    <Fila etiqueta="Tiempo" valor={`${p.sale.min} min`} />
                  </dl>
                ) : (
                  <p className="mt-2 pr-3 text-xs font-semibold text-amber">Destino</p>
                )}
              </motion.li>
            ))}
          </ol>
        )}
      </div>

      {(ampliado || puedeAmpliar) && (
        <div className="flex flex-wrap items-center gap-4 border-t border-white/15 bg-navy-deep/60 px-6 py-3.5">
          {ampliado && r && (
            <p className="text-sm font-semibold">
              Salida sugerida probando otras horas: <span className="tnum text-amber">{r.salida}</span>
            </p>
          )}
          {ampliado && !r && (
            <p className="text-sm font-semibold">Probamos todas las salidas hasta el límite y ninguna tiene ruta segura.</p>
          )}
          {puedeAmpliar && (
            <button
              type="button"
              onClick={onAmpliar}
              disabled={pendiente}
              className="rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-deep transition-colors hover:bg-[#ffd04d] disabled:opacity-50"
            >
              {pendiente ? "Probando…" : "Probar otra hora de salida"}
            </button>
          )}
        </div>
      )}
    </motion.section>
  );
}
