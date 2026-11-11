import { useMutation } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type ConsultaOut, type Red } from "../lib/api";
import { useEstadoTramos } from "../lib/hooks";
import { aHora, aMin } from "../lib/time";
import { plural } from "../lib/texto";
import { LeyendaMapa, NetworkMap } from "../components/NetworkMap";
import { ControlHora } from "../components/ControlHora";
import { Resultado, type PuntoRuta } from "../components/Resultado";
import { Campo, Card, CLASE_INPUT, ErrorAviso, Segmentado, SelectorHora } from "../components/ui";

const FLEX_BASE = [0, 15, 30, 60];

export function ConsultaView({ escenario, red, admin }: { escenario: string; red: Red; admin: boolean }) {
  const ultimo = aHora(aMin(red.config.fin) - red.config.intervalo_min);

  const [origen, setOrigen] = useState("N01");
  const [destino, setDestino] = useState("N05");
  const [turno, setTurno] = useState<"origen" | "destino">("origen");
  const [salida, setSalida] = useState("17:00");
  const [limite, setLimite] = useState("18:00");
  const [flex, setFlex] = useState(0);
  const [hora, setHora] = useState("17:00");
  const [ampliado, setAmpliado] = useState(false);
  const [resultado, setResultado] = useState<ConsultaOut | null>(null);
  const [version, setVersion] = useState(0);
  const [viajeSel, setViajeSel] = useState("");
  const [calcular, setCalcular] = useState(false);

  useEffect(() => {
    setAmpliado(false);
    if (red.viajes.length) cargarViaje(red.viajes[0].id);
    else mutacion.mutate({ ampliar: false });
  }, [escenario]);

  useEffect(() => {
    if (!calcular) return;
    setCalcular(false);
    mutacion.mutate({ ampliar: false });
  }, [calcular, origen, destino, salida, limite, flex]);

  const opcionesFlex = useMemo(
    () => (FLEX_BASE.includes(flex) ? FLEX_BASE : [...FLEX_BASE, flex].sort((a, b) => a - b)),
    [flex],
  );

  const estadoQ = useEstadoTramos(escenario, hora);
  const estado = useMemo(
    () => Object.fromEntries((estadoQ.data?.tramos ?? []).map((t) => [t.tramo_id, t])),
    [estadoQ.data],
  );

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
    setViajeSel(id);
    setCalcular(true);
  }

  function clicNodo(id: string) {
    setViajeSel("");
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
    const lista: PuntoRuta[] = [];
    r.pasos.forEach((p, i) => {
      const t = mapa.get(p.tramo_id);
      if (!t) return;
      const sale = { tramo: p.tramo_id, min: aMin(p.salida) - aMin(p.entrada) };
      if (i === 0) lista.push({ id: t.origen, hora: p.entrada, sale });
      else lista[lista.length - 1].sale = sale;
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

  const bloqueados = (estadoQ.data?.tramos ?? []).filter((t) => !t.seguro).length;

  const selectNodos = (id: string, valor: string, alCambiar: (v: string) => void) => (
    <select
      id={id}
      className={CLASE_INPUT}
      value={valor}
      onChange={(e) => {
        alCambiar(e.target.value);
        setResultado(null);
        setViajeSel("");
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
          className="grid gap-6 p-5"
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
                value={viajeSel}
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

          <fieldset className="grid gap-3">
            <legend className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Trayecto</legend>
            <Campo
              etiqueta={
                <span className="inline-flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-navy" aria-hidden="true" />
                  Origen
                </span>
              }
              id="origen"
            >
              {selectNodos("origen", origen, setOrigen)}
            </Campo>
            <Campo
              etiqueta={
                <span className="inline-flex items-center gap-2">
                  <span className="size-2.5 rounded-full border-2 border-blue bg-white" aria-hidden="true" />
                  Destino
                </span>
              }
              id="destino"
            >
              {selectNodos("destino", destino, setDestino)}
            </Campo>
            <p className="flex items-start gap-2 rounded-xl bg-blue-soft px-3 py-2.5 text-[13px] leading-snug text-navy">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
                <path d="M3 2l4.5 11 1.6-4.4L13.5 7z" />
              </svg>
              <span>
                Toca un nodo del plano para elegir{" "}
                <strong>{turno === "origen" ? "el origen" : "el destino"}</strong>.
              </span>
            </p>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Horario</legend>
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
                  if (aMin(limite) <= aMin(v)) {
                    setLimite(aHora(Math.min(aMin(v) + 60, aMin(red.config.fin))));
                  }
                  setResultado(null);
                  setViajeSel("");
                }}
              />
            </Campo>
            <Campo etiqueta="Límite de llegada" id="limite">
              <SelectorHora
                id="limite"
                valor={limite}
                desde={aHora(aMin(salida) + red.config.intervalo_min)}
                hasta={red.config.fin}
                paso={red.config.intervalo_min}
                alCambiar={(v) => {
                  setLimite(v);
                  setResultado(null);
                  setViajeSel("");
                }}
              />
            </Campo>
            </div>
          </fieldset>

          <fieldset className="grid gap-2.5">
            <legend className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Flexibilidad de salida</legend>
            <Segmentado
              id="flex"
              etiqueta="Flexibilidad de salida"
              valor={flex}
              opciones={opcionesFlex.map((m) => ({ valor: m, texto: m === 0 ? "Exacta" : `+${m} min` }))}
              alCambiar={(v) => {
                setFlex(v);
                setResultado(null);
                setViajeSel("");
              }}
            />
            <p className="tnum text-[13px] text-muted">
              {flex === 0 ? (
                <>
                  Saldrás exactamente a las <strong className="text-navy">{salida}</strong>.
                </>
              ) : (
                <>
                  Puede salir entre <strong className="text-navy">{salida}</strong> y{" "}
                  <strong className="text-navy">{aHora(Math.min(aMin(salida) + flex, aMin(ultimo)))}</strong>.
                </>
              )}
            </p>
          </fieldset>

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

          <ControlHora
            red={red}
            escenario={escenario}
            hora={hora}
            alCambiar={setHora}
            viaje={r ? { salida: r.salida, llegada: r.llegada } : null}
          />

          <div className="border-t border-line px-5 py-3.5">
            <LeyendaMapa modo="consulta" />
          </div>
        </Card>
      </div>
    </div>
  );
}
