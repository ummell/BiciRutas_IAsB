import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { MapaInteractivo } from "../components/MapaInteractivo";
import { ErrorAviso, EstadoChip } from "../components/ui";
import { api, ApiError, type ConsultaOut, type Recorrido, type Red } from "../lib/api";
import { formatoDistancia } from "../lib/mapa";
import { PARQUEADEROS } from "../lib/parqueaderos";
import { ETIQUETA_OPCION, nivelCongestion } from "../lib/texto";
import { aHora, aMin } from "../lib/time";

const CAMPO =
  "w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] font-medium text-ink transition-colors hover:border-[#c9c2b2] focus:border-bosque";

export function UsuarioView({ escenario, red }: { escenario: string; red: Red }) {
  const reducir = useReducedMotion();
  const ultimo = aHora(aMin(red.config.fin) - red.config.intervalo_min);
  const [origen, setOrigen] = useState("N01");
  const [destino, setDestino] = useState("N05");
  const [salida, setSalida] = useState("17:00");
  const [limite, setLimite] = useState("18:00");
  const [resultado, setResultado] = useState<ConsultaOut | null>(null);
  const [version, setVersion] = useState(0);
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(0);

  const mutacion = useMutation({
    mutationFn: () =>
      api.consulta(escenario, {
        origen,
        destino,
        salida_desde: salida,
        salida_hasta: salida,
        llegada_limite: limite,
        criterio: "equilibrado",
      }),
    onSuccess: (r) => {
      setResultado(r);
      setVersion((v) => v + 1);
      setIndiceSeleccionado(0);
    },
  });

  useEffect(() => {
    mutacion.mutate();
  }, [escenario]);

  const tramos = useMemo(() => new Map(red.tramos.map((t) => [t.id, t])), [red.tramos]);
  const nombre = (id: string) => red.nodos.find((n) => n.id === id)?.nombre ?? id;
  const opciones = resultado?.opciones;
  const r: Recorrido | null =
    opciones && opciones.length > 0
      ? opciones[indiceSeleccionado]?.recorrido ?? null
      : resultado?.recorrido ?? null;
  const chipEstado = opciones?.length && r ? r.estado : resultado?.estado ?? "SIN_RUTA_SEGURA";
  const distancia = r ? r.pasos.reduce((s, p) => s + (tramos.get(p.tramo_id)?.distancia_m ?? 0), 0) : 0;
  const mismo = origen !== "" && origen === destino;
  const puede = !mismo && origen !== "" && destino !== "" && !mutacion.isPending;

  const elegir = (id: string, valor: string, cambiar: (v: string) => void, etiqueta: string) => (
    <select
      id={id}
      aria-label={etiqueta}
      className={CAMPO}
      value={valor}
      onChange={(e) => {
        cambiar(e.target.value);
        setResultado(null);
      }}
    >
      <option value="" disabled>
        Elegir…
      </option>
      {red.nodos.map((n) => (
        <option key={n.id} value={n.id}>
          {n.nombre}
          {PARQUEADEROS.some((x) => x.nodo === n.id) ? " · bici-parqueadero" : ""}
        </option>
      ))}
    </select>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="flex flex-col gap-5 xl:sticky xl:top-5">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <h2 className="text-[22px] font-extrabold leading-tight text-bosque">¿A dónde vas?</h2>
          <p className="mt-1 text-[13.5px] text-muted">Te decimos por dónde ir de forma segura y a qué hora llegas.</p>

          <form
            className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (puede) mutacion.mutate();
            }}
          >
            <div className="relative grid grid-cols-[minmax(0,1fr)] gap-2 pr-11">
              <label className="grid gap-1 text-[13px] font-semibold text-muted">
                Desde
                {elegir("u-origen", origen, setOrigen, "Desde")}
              </label>
              <label className="grid gap-1 text-[13px] font-semibold text-muted">
                Hasta
                {elegir("u-destino", destino, setDestino, "Hasta")}
              </label>
              <button
                type="button"
                onClick={() => {
                  setOrigen(destino);
                  setDestino(origen);
                  setResultado(null);
                }}
                aria-label="Invertir origen y destino"
                className="absolute right-0 top-1/2 grid size-9 -translate-y-1/4 place-items-center rounded-full border border-line text-bosque transition-colors hover:border-bosque hover:bg-bosque-100"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 2v12M5 14l-3-3M5 14l3-3M11 14V2M11 2 8 5M11 2l3 3" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid min-w-0 gap-1 text-[13px] font-semibold text-muted">
                Salgo a las
                <input
                  type="time"
                  step={300}
                  min={red.config.inicio}
                  max={ultimo}
                  required
                  className={`${CAMPO} tnum`}
                  value={salida}
                  onChange={(e) => {
                    setSalida(e.target.value);
                    setResultado(null);
                  }}
                />
              </label>
              <label className="grid min-w-0 gap-1 text-[13px] font-semibold text-muted">
                Llego antes de
                <input
                  type="time"
                  step={300}
                  min={red.config.inicio}
                  max={red.config.fin}
                  required
                  className={`${CAMPO} tnum`}
                  value={limite}
                  onChange={(e) => {
                    setLimite(e.target.value);
                    setResultado(null);
                  }}
                />
              </label>
            </div>

            {mismo && <ErrorAviso mensaje="El punto de partida y el destino deben ser distintos." />}
            {mutacion.isError && (
              <ErrorAviso mensaje={mutacion.error instanceof ApiError ? mutacion.error.message : "No se pudo calcular la ruta."} />
            )}

            <button
              type="submit"
              disabled={!puede}
              className="mt-1 rounded-xl bg-bosque px-5 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-bosque-900 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {mutacion.isPending ? "Buscando ruta…" : "Buscar ruta"}
            </button>
          </form>
        </section>

        <AnimatePresence mode="wait">
          {resultado && (
            <motion.section
              key={version}
              aria-live="polite"
              className="rounded-2xl bg-bosque p-5 text-white shadow-card"
              initial={reducir ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducir ? undefined : { opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <EstadoChip estado={chipEstado} grande />
              {r ? (
                <>
                  <div className="mt-4 flex items-end gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-white/60">Sales</p>
                      <p className="font-display tnum text-[42px] font-extrabold leading-none">{r.salida}</p>
                    </div>
                    <svg width="30" height="20" viewBox="0 0 34 22" className="mb-2 text-amber-light" aria-hidden="true">
                      <path d="M2 11h28M22 3l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-white/60">Llegas</p>
                      <p className="font-display tnum text-[42px] font-extrabold leading-none">{r.llegada}</p>
                    </div>
                  </div>
                  <p className="tnum mt-3 text-[15px] font-medium text-white/90">
                    {r.duracion_min} min en bici · {formatoDistancia(distancia)}
                  </p>
                  <p className="mt-1 text-[14px] text-white/75">
                    {r.tardanza_min > 0 ? (
                      <strong className="text-amber-light">Llegas {r.tardanza_min} min tarde (tu límite es {limite}).</strong>
                    ) : (
                      <>Llegas {aMin(limite) - aMin(r.llegada)} min antes de las {limite}.</>
                    )}
                  </p>
                  <p className="mt-3 border-t border-white/15 pt-3 text-[13.5px] text-white/80">
                    De <strong className="text-white">{nombre(origen)}</strong> a <strong className="text-white">{nombre(destino)}</strong>
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[17px] font-bold">No hay una ruta segura a esa hora.</p>
                  <p className="mt-1 text-[13.5px] text-white/75">Prueba con otra hora de salida o con otro destino.</p>
                </>
              )}
              {opciones && opciones.length > 1 && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-white/50">Opciones de ruta</h3>
                  <div className="mt-2.5 grid gap-2">
                    {opciones.map((op, i) => (
                      <button
                        key={op.etiqueta}
                        type="button"
                        aria-pressed={i === indiceSeleccionado}
                        onClick={() => setIndiceSeleccionado(i)}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          i === indiceSeleccionado
                            ? "border-amber-light bg-white/15"
                            : "border-white/10 hover:border-white/25"
                        }`}
                      >
                        <span className="text-[13px] font-bold text-amber-light">
                          {ETIQUETA_OPCION[op.etiqueta]}
                        </span>
                        <div className="mt-1 flex items-center gap-3 text-[13px] text-white/80">
                          <span className="tnum font-medium">{op.recorrido.duracion_min} min</span>
                          <span className="tnum">llega {op.recorrido.llegada}</span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-white/60">
                          {nivelCongestion(op.congestion)} · {op.congestion} bici-intervalos
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <MapaInteractivo
        escenario={escenario}
        red={red}
        modo="usuario"
        simple
        hora={salida}
        origen={origen || undefined}
        destino={destino || undefined}
        ruta={r?.pasos}
        rutaTarde={r?.estado === "TARDE"}
        rutaKey={`${version}-${indiceSeleccionado}`}
        onOrigen={(id) => {
          setOrigen(id);
          if (id === destino) setDestino("");
          setResultado(null);
        }}
        onDestino={(id) => {
          setDestino(id);
          if (id === origen) setOrigen("");
          setResultado(null);
        }}
        className="h-[min(680px,76vh)] min-h-[460px] shadow-card"
      />
    </div>
  );
}
