import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { ApiError, type ConsultaOut, type Red } from "../lib/api";
import { useEstadoTramos } from "../lib/hooks";
import { api } from "../lib/api";
import { aHora, aMin } from "../lib/time";
import { plural } from "../lib/texto";
import { LeyendaMapa, NetworkMap } from "../components/NetworkMap";
import { Campo, Card, CLASE_INPUT, ErrorAviso, EstadoChip } from "../components/ui";

const FLEX_BASE = [0, 15, 30, 60];

function etiquetaFlex(min: number): string {
  return min === 0 ? "Salir exactamente a esa hora" : `Poder salir hasta ${min} min después`;
}

export function ConsultaView({ escenario, red }: { escenario: string; red: Red }) {
  const reducir = useReducedMotion();
  const ultimo = aHora(aMin(red.config.fin) - red.config.intervalo_min);

  const [origen, setOrigen] = useState("N01");
  const [destino, setDestino] = useState("N05");
  const [turno, setTurno] = useState<"origen" | "destino">("origen");
  const [salida, setSalida] = useState("17:00");
  const [limite, setLimite] = useState("18:00");
  const [flex, setFlex] = useState(0);
  const [hora, setHora] = useState("17:00");
  const [reproduciendo, setReproduciendo] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  const [resultado, setResultado] = useState<ConsultaOut | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setAmpliado(false);
    mutacion.mutate({ ampliar: false });
  }, [escenario]);

  const opcionesFlex = useMemo(
    () => (FLEX_BASE.includes(flex) ? FLEX_BASE : [...FLEX_BASE, flex].sort((a, b) => a - b)),
    [flex],
  );

  const estadoQ = useEstadoTramos(escenario, hora);
  const estado = useMemo(
    () => Object.fromEntries((estadoQ.data?.tramos ?? []).map((t) => [t.tramo_id, t])),
    [estadoQ.data],
  );

  useEffect(() => {
    if (!reproduciendo) return;
    const id = window.setInterval(() => {
      setHora((h) => {
        const siguiente = aMin(h) + red.config.intervalo_min;
        if (siguiente > aMin(ultimo)) {
          setReproduciendo(false);
          return h;
        }
        return aHora(siguiente);
      });
    }, 160);
    return () => window.clearInterval(id);
  }, [reproduciendo, red.config.intervalo_min, ultimo]);

  const nombre = (id: string) => red.nodos.find((n) => n.id === id)?.nombre ?? id;

  const mutacion = useMutation({
    mutationFn: ({ ampliar }: { ampliar: boolean }) => {
      const tope = aMin(limite) < aMin(ultimo) ? limite : ultimo;
      const hasta = ampliar
        ? aMin(tope) >= aMin(salida)
          ? tope
          : salida
        : aHora(Math.min(aMin(salida) + flex, aMin(ultimo)));
      return api.consulta(escenario, {
        origen,
        destino,
        salida_desde: salida,
        salida_hasta: hasta,
        llegada_limite: limite,
      });
    },
    onSuccess: (r, { ampliar }) => {
      setResultado(r);
      setAmpliado(ampliar);
      setVersion((v) => v + 1);
      if (r.recorrido) setHora(r.recorrido.salida);
    },
  });

  function cargarViaje(id: string) {
    const v = red.viajes.find((x) => x.id === id);
    if (!v) return;
    setOrigen(v.origen);
    setDestino(v.destino);
    setSalida(v.salida_desde);
    setLimite(v.llegada_limite);
    setFlex(aMin(v.salida_hasta) - aMin(v.salida_desde));
    setHora(v.salida_desde);
    setResultado(null);
    setAmpliado(false);
  }

  function clicNodo(id: string) {
    if (turno === "origen") {
      setOrigen(id);
      if (id === destino) setDestino("");
      setTurno("destino");
    } else {
      setDestino(id);
      if (id === origen) setOrigen("");
      setTurno("origen");
    }
  }

  const r = resultado?.recorrido ?? null;
  const rutaNodos = useMemo(() => {
    if (!r) return [];
    const mapa = new Map(red.tramos.map((t) => [t.id, t]));
    const lista: { id: string; hora: string }[] = [];
    r.pasos.forEach((p, i) => {
      const t = mapa.get(p.tramo_id);
      if (!t) return;
      if (i === 0) lista.push({ id: t.origen, hora: p.entrada });
      lista.push({ id: t.destino, hora: p.salida });
    });
    return lista;
  }, [r, red.tramos]);

  const mismoNodo = origen !== "" && origen === destino;
  const incompleto = origen === "" || destino === "";
  const puedeCalcular = !mismoNodo && !incompleto && !mutacion.isPending;
  const puedeAmpliar =
    resultado !== null && resultado.estado !== "A_TIEMPO" && !ampliado && aMin(limite) > aMin(salida);

  const horaSpan = aMin(red.config.fin) - aMin(red.config.inicio);
  const nocheIni = ((aMin(red.config.inicio_noche) - aMin(red.config.inicio)) / horaSpan) * 100;
  const nocheAncho = ((aMin(red.config.fin_noche) - aMin(red.config.inicio_noche)) / horaSpan) * 100;
  const bloqueados = (estadoQ.data?.tramos ?? []).filter((t) => !t.seguro).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <Card titulo="Consultar ruta y sugerir salida">
          <form
            className="grid gap-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (puedeCalcular) mutacion.mutate({ ampliar: false });
            }}
          >
            <Campo etiqueta="Cargar viaje del escenario" id="viaje">
              <select
                id="viaje"
                className={CLASE_INPUT}
                defaultValue=""
                onChange={(e) => e.target.value && cargarViaje(e.target.value)}
              >
                <option value="">Elegir un viaje…</option>
                {red.viajes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} · {v.origen} → {v.destino} · {v.salida_desde}–{v.salida_hasta}
                  </option>
                ))}
              </select>
            </Campo>

            <div className="grid gap-3">
              <Campo etiqueta="Origen" id="origen">
                <select
                  id="origen"
                  className={CLASE_INPUT}
                  value={origen}
                  onChange={(e) => {
                    setOrigen(e.target.value);
                    setResultado(null);
                  }}
                >
                  <option value="" disabled>
                    Elegir…
                  </option>
                  {red.nodos.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.id} · {n.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Destino" id="destino">
                <select
                  id="destino"
                  className={CLASE_INPUT}
                  value={destino}
                  onChange={(e) => {
                    setDestino(e.target.value);
                    setResultado(null);
                  }}
                >
                  <option value="" disabled>
                    Elegir…
                  </option>
                  {red.nodos.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.id} · {n.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <p className="-mt-2 text-[13px] text-muted">
              También puedes tocar los nodos del plano:{" "}
              <strong className="text-navy">{turno === "origen" ? "el siguiente será el origen" : "el siguiente será el destino"}</strong>.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Hora de salida" id="salida">
                <input
                  id="salida"
                  type="time"
                  step={300}
                  min={red.config.inicio}
                  max={ultimo}
                  required
                  className={`${CLASE_INPUT} tnum`}
                  value={salida}
                  onChange={(e) => {
                    setSalida(e.target.value);
                    if (e.target.value) setHora(e.target.value);
                    setResultado(null);
                  }}
                />
              </Campo>
              <Campo etiqueta="Hora límite de llegada" id="limite">
                <input
                  id="limite"
                  type="time"
                  step={300}
                  min={red.config.inicio}
                  max={red.config.fin}
                  required
                  className={`${CLASE_INPUT} tnum`}
                  value={limite}
                  onChange={(e) => {
                    setLimite(e.target.value);
                    setResultado(null);
                  }}
                />
              </Campo>
            </div>

            <Campo etiqueta="Flexibilidad de salida" id="flex">
              <select
                id="flex"
                className={CLASE_INPUT}
                value={flex}
                onChange={(e) => {
                  setFlex(Number(e.target.value));
                  setResultado(null);
                }}
              >
                {opcionesFlex.map((m) => (
                  <option key={m} value={m}>
                    {etiquetaFlex(m)}
                  </option>
                ))}
              </select>
            </Campo>

            {mismoNodo && <ErrorAviso mensaje="El origen y el destino deben ser distintos." />}
            {mutacion.isError && (
              <ErrorAviso mensaje={mutacion.error instanceof ApiError ? mutacion.error.message : "No se pudo calcular."} />
            )}

            <button
              type="submit"
              disabled={!puedeCalcular}
              className="rounded-xl bg-navy px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-45"
            >
              {mutacion.isPending ? "Calculando…" : "Calcular recorrido"}
            </button>
          </form>
        </Card>

        <AnimatePresence mode="wait">
          {resultado && (
            <motion.section
              key={version}
              aria-live="polite"
              className="overflow-hidden rounded-2xl bg-navy text-white shadow-card"
              initial={reducir ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducir ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[15px] font-bold text-white/90">Recomendación</h2>
                  <EstadoChip estado={resultado.estado} grande />
                </div>

                {r ? (
                  <>
                    <div className="mt-4 flex items-end gap-4">
                      <div>
                        <p className="text-[13px] font-semibold text-white/70">Sale</p>
                        <p className="tnum text-[44px] font-extrabold leading-none">{r.salida}</p>
                      </div>
                      <svg width="34" height="22" viewBox="0 0 34 22" className="mb-2 text-amber" aria-hidden="true">
                        <path d="M2 11h28M22 3l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div>
                        <p className="text-[13px] font-semibold text-white/70">Llega</p>
                        <p className="tnum text-[44px] font-extrabold leading-none">{r.llegada}</p>
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
                    {ampliado && (
                      <p className="mt-3 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-semibold">
                        Salida sugerida probando otras horas: <span className="tnum text-amber">{r.salida}</span>
                      </p>
                    )}
                    <p className="mt-3 text-[13px] text-white/70">
                      {plural(resultado.alternativas, "opción segura evaluada", "opciones seguras evaluadas")} dentro de la ventana de salida.
                    </p>

                    <ol className="mt-4 space-y-0 border-t border-white/15 pt-4">
                      {rutaNodos.map((p, i) => (
                        <motion.li
                          key={`${p.id}-${i}`}
                          className="flex items-center gap-3 py-1.5"
                          initial={reducir ? false : { opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.25 + i * 0.07, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <span className="tnum w-12 text-sm font-bold text-amber">{p.hora}</span>
                          <span
                            className={`size-2.5 rounded-full ${i === 0 || i === rutaNodos.length - 1 ? "bg-white" : "bg-white/40"}`}
                            aria-hidden="true"
                          />
                          <span className="text-sm font-semibold">{nombre(p.id)}</span>
                        </motion.li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="text-lg font-bold">No existe una ruta segura para esa ventana de salida.</p>
                    <p className="text-sm text-white/80">
                      Todos los recorridos posibles usan algún tramo bloqueado a esa hora. Cambiar la hora solo ayuda si el
                      riesgo deja de estar vigente.
                    </p>
                  </div>
                )}

                {puedeAmpliar && (
                  <button
                    type="button"
                    onClick={() => mutacion.mutate({ ampliar: true })}
                    disabled={mutacion.isPending}
                    className="mt-5 w-full rounded-xl bg-amber px-4 py-3 text-[15px] font-bold text-navy-deep transition-colors hover:bg-[#ffd04d] disabled:opacity-50"
                  >
                    {mutacion.isPending ? "Probando…" : "Probar otra hora de salida"}
                  </button>
                )}
                {ampliado && !r && (
                  <p className="mt-4 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-semibold">
                    Probamos todas las salidas hasta el límite y ninguna tiene ruta segura.
                  </p>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <Card className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
          <h2 className="text-[15px] font-bold text-navy">Red de ciclorrutas</h2>
          <p className="tnum rounded-full bg-rose-soft px-3 py-1 text-[13px] font-bold text-rose-deep">
            {plural(bloqueados, "tramo bloqueado", "tramos bloqueados")} a las {hora}
          </p>
        </div>

        <div className="px-3 pb-1 pt-2">
          <NetworkMap
            red={red}
            origen={origen || undefined}
            destino={destino || undefined}
            ruta={r?.pasos}
            rutaTarde={r?.estado === "TARDE"}
            rutaKey={`${version}`}
            estado={estado}
            onNodo={clicNodo}
          />
        </div>

        <div className="mx-5 mb-4 rounded-xl bg-ground px-4 py-3.5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (!reproduciendo && aMin(hora) >= aMin(ultimo)) setHora(red.config.inicio);
                setReproduciendo((p) => !p);
              }}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-navy text-white transition-colors hover:bg-navy-deep"
              aria-label={reproduciendo ? "Pausar" : "Reproducir la hora"}
            >
              {reproduciendo ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <rect x="2" y="1" width="3.5" height="12" rx="1" />
                  <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <path d="M3 1.5v11l9-5.5z" />
                </svg>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between">
                <label htmlFor="hora" className="text-[13px] font-semibold text-muted">
                  Hora en la red
                </label>
                <span className="tnum text-2xl font-extrabold text-navy">{hora}</span>
              </div>
              <div className="relative mt-1">
                <div
                  className="pointer-events-none absolute -top-0.5 h-1.5 rounded-full bg-navy/25"
                  style={{ left: `${nocheIni}%`, width: `${nocheAncho}%` }}
                  title="Horario nocturno"
                />
                <input
                  id="hora"
                  type="range"
                  className="mt-1.5 w-full"
                  min={aMin(red.config.inicio)}
                  max={aMin(ultimo)}
                  step={red.config.intervalo_min}
                  value={aMin(hora)}
                  onChange={(e) => {
                    setReproduciendo(false);
                    setHora(aHora(Number(e.target.value)));
                  }}
                />
              </div>
              <div className="tnum flex justify-between text-xs font-medium text-muted">
                <span>{red.config.inicio}</span>
                <span>noche desde {red.config.inicio_noche}</span>
                <span>{red.config.fin}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-line px-5 py-3.5">
          <LeyendaMapa modo="consulta" />
        </div>
      </Card>
    </div>
  );
}
