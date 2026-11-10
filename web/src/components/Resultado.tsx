import { motion, useReducedMotion } from "motion/react";
import type { ConsultaOut, Red } from "../lib/api";
import { aMin } from "../lib/time";
import { plural } from "../lib/texto";
import { EstadoChip } from "./ui";

interface Props {
  resultado: ConsultaOut;
  red: Red;
  limite: string;
  ampliado: boolean;
  puedeAmpliar: boolean;
  pendiente: boolean;
  onAmpliar: () => void;
  nodosRuta: { id: string; hora: string }[];
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
      <div className="grid gap-x-10 gap-y-6 p-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        <div>
          <EstadoChip estado={resultado.estado} grande />
          {r ? (
            <>
              <div className="mt-4 flex items-end gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-white/60">Sale</p>
                  <p className="font-display tnum text-[56px] font-extrabold leading-none">{r.salida}</p>
                </div>
                <svg width="34" height="22" viewBox="0 0 34 22" className="mb-3 text-amber-light" aria-hidden="true">
                  <path d="M2 11h28M22 3l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-white/60">Llega</p>
                  <p className="font-display tnum text-[56px] font-extrabold leading-none">{r.llegada}</p>
                </div>
              </div>
              <p className="tnum mt-3 text-[15px] font-medium text-white/90">
                {r.duracion_min} min de viaje ·{" "}
                {r.tardanza_min > 0 ? (
                  <strong className="text-amber-light">{r.tardanza_min} min después del límite ({limite})</strong>
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
          <ol className="flex min-w-0 overflow-x-auto pb-1" aria-label="Recorrido">
            {nodosRuta.map((p, i) => (
              <motion.li
                key={`${p.id}-${i}`}
                className="relative flex min-w-[104px] flex-1 flex-col items-center text-center"
                initial={reducir ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.07, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="tnum h-5 text-sm font-bold text-amber-light">{p.hora}</span>
                {i < nodosRuta.length - 1 && (
                  <span className="absolute left-1/2 top-[34px] h-0.5 w-full -translate-y-1/2 bg-white/25" aria-hidden="true" />
                )}
                <span
                  className={`relative z-10 mt-1.5 size-4 rounded-full border-2 border-navy ${
                    i === 0 || i === nodosRuta.length - 1 ? "bg-white" : "bg-[#9db59f]"
                  }`}
                  aria-hidden="true"
                />
                <span className="mt-2 px-1 text-[13px] font-semibold leading-tight text-white/95">{nombre(p.id)}</span>
              </motion.li>
            ))}
          </ol>
        )}
      </div>

      {(ampliado || puedeAmpliar) && (
        <div className="flex flex-wrap items-center gap-4 border-t border-white/15 bg-navy-deep/60 px-6 py-3.5">
          {ampliado && r && (
            <p className="text-sm font-semibold">
              Salida sugerida probando otras horas: <span className="tnum text-amber-light">{r.salida}</span>
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
              className="rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-deep transition-colors hover:bg-[#ee9248] disabled:opacity-50"
            >
              {pendiente ? "Probando…" : "Probar otra hora de salida"}
            </button>
          )}
        </div>
      )}
    </motion.section>
  );
}
