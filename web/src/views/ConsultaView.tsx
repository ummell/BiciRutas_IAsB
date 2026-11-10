import { useMutation } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type ConsultaOut, type Red } from "../lib/api";
import { useEstadoTramos } from "../lib/hooks";
import { aHora, aMin } from "../lib/time";
import { plural } from "../lib/texto";
import { LeyendaMapa, NetworkMap } from "../components/NetworkMap";
import { Resultado } from "../components/Resultado";
import { Campo, Card, CLASE_INPUT, ErrorAviso, SelectorHora } from "../components/ui";

const FLEX_BASE = [0, 15, 30, 60];

function etiquetaFlex(min: number): string {
  return min === 0 ? "Salir exactamente a esa hora" : `Poder salir hasta ${min} min después`;
}

export function ConsultaView({ escenario, red, admin }: { escenario: string; red: Red; admin: boolean }) {
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
  const nodosRuta = useMemo(() => {
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
  const horas = useMemo(() => Object.fromEntries(nodosRuta.map((p) => [p.id, p.hora])), [nodosRuta]);

  const mismoNodo = origen !== "" && origen === destino;
  const incompleto = origen === "" || destino === "";
  const puedeCalcular = !mismoNodo && !incompleto && !mutacion.isPending;
  const puedeAmpliar =
    resultado !== null && resultado.estado !== "A_TIEMPO" && !ampliado && aMin(limite) > aMin(salida);

  const horaSpan = aMin(red.config.fin) - aMin(red.config.inicio);
  const nocheIni = ((aMin(red.config.inicio_noche) - aMin(red.config.inicio)) / horaSpan) * 100;
  const nocheAncho = ((aMin(red.config.fin_noche) - aMin(red.config.inicio_noche)) / horaSpan) * 100;
  const bloqueados = (estadoQ.data?.tramos ?? []).filter((t) => !t.seguro).length;

  const selectNodos = (id: string, valor: string, alCambiar: (v: string) => void) => (
    <select
      id={id}
      className={CLASE_INPUT}
      value={valor}
      onChange={(e) => {
        alCambiar(e.target.value);
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
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card titulo="Consultar ruta y sugerir salida" className="xl:sticky xl:top-5">
        <form
          className="grid gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (puedeCalcular) mutacion.mutate({ ampliar: false });
          }}
        >
          {admin && (
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
          )}

          <div className="grid gap-3">
            <Campo etiqueta="Origen" id="origen">
              {selectNodos("origen", origen, setOrigen)}
            </Campo>
            <Campo etiqueta="Destino" id="destino">
              {selectNodos("destino", destino, setDestino)}
            </Campo>
          </div>
          <p className="-mt-2 text-[13px] text-muted">
            También puedes tocar los nodos del plano:{" "}
            <strong className="text-navy">{turno === "origen" ? "el siguiente será el origen" : "el siguiente será el destino"}</strong>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Hora de salida" id="salida">
              <SelectorHora
                id="salida"
                valor={salida}
                desde={red.config.inicio}
                hasta={ultimo}
                paso={red.config.intervalo_min}
                alCambiar={(v) => {
                  setSalida(v);
                  setHora(v);
                  setResultado(null);
                }}
              />
            </Campo>
            <Campo etiqueta="Límite de llegada" id="limite">
              <SelectorHora
                id="limite"
                valor={limite}
                desde={aHora(aMin(red.config.inicio) + red.config.intervalo_min)}
                hasta={red.config.fin}
                paso={red.config.intervalo_min}
                alCambiar={(v) => {
                  setLimite(v);
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
            className="rounded-xl bg-navy px-5 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-45"
          >
            {mutacion.isPending ? "Calculando…" : "Calcular recorrido"}
          </button>
        </form>
      </Card>

      <div className="flex min-w-0 flex-col gap-6">
        <AnimatePresence mode="wait">
          {resultado ? (
            <Resultado
              key={version}
              resultado={resultado}
              red={red}
              limite={limite}
              ampliado={ampliado}
              puedeAmpliar={puedeAmpliar}
              pendiente={mutacion.isPending}
              onAmpliar={() => mutacion.mutate({ ampliar: true })}
              nodosRuta={nodosRuta}
            />
          ) : (
            <div key="espera" className="skeleton h-44 rounded-2xl" aria-hidden="true" />
          )}
        </AnimatePresence>

        <Card className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
            <h2 className="text-[15px] font-bold text-navy">Red de ciclorrutas</h2>
            <p
              className={`tnum rounded-full px-3 py-1 text-[13px] font-bold ${
                bloqueados > 0 ? "bg-rose-soft text-rose-deep" : "bg-blue-soft text-blue-deep"
              }`}
            >
              {bloqueados > 0
                ? `${plural(bloqueados, "tramo bloqueado", "tramos bloqueados")} a las ${hora}`
                : `Ningún tramo bloqueado a las ${hora}`}
            </p>
          </div>

          <div className="p-3">
            <NetworkMap
              red={red}
              origen={origen || undefined}
              destino={destino || undefined}
              ruta={r?.pasos}
              rutaTarde={r?.estado === "TARDE"}
              rutaKey={`${version}`}
              horas={horas}
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
                className="grid size-11 shrink-0 place-items-center rounded-full bg-navy text-white transition-colors hover:bg-navy-deep"
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
    </div>
  );
}
