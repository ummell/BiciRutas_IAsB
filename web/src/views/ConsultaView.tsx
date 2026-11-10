import { useMutation } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type ConsultaOut, type Red } from "../lib/api";
import { useEstadoTramos } from "../lib/hooks";
import { aHora, aMin } from "../lib/time";
import { plural } from "../lib/texto";
import { MapaInteractivo } from "../components/MapaInteractivo";
import { Resultado } from "../components/Resultado";
import { Campo, Card, CLASE_INPUT, ErrorAviso } from "../components/ui";

const FLEX_BASE = [0, 15, 30, 60];

function etiquetaFlex(min: number): string {
  return min === 0 ? "Salir exactamente a esa hora" : `Poder salir hasta ${min} min después`;
}

export function ConsultaView({ escenario, red }: { escenario: string; red: Red }) {
  const ultimo = aHora(aMin(red.config.fin) - red.config.intervalo_min);

  const [origen, setOrigen] = useState("N01");
  const [destino, setDestino] = useState("N05");
  const [salida, setSalida] = useState("17:00");
  const [limite, setLimite] = useState("18:00");
  const [flex, setFlex] = useState(0);
  const [hora, setHora] = useState("17:00");
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

  function intercambiar() {
    setOrigen(destino);
    setDestino(origen);
    setResultado(null);
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

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 gap-y-3">
            <div className="grid gap-3">
              <Campo etiqueta="Origen" id="origen">
                {selectNodos("origen", origen, setOrigen)}
              </Campo>
              <Campo etiqueta="Destino" id="destino">
                {selectNodos("destino", destino, setDestino)}
              </Campo>
            </div>
            <button
              type="button"
              onClick={intercambiar}
              aria-label="Intercambiar origen y destino"
              className="mb-[1.35rem] grid size-9 place-items-center rounded-full border border-line text-navy transition-colors hover:border-navy hover:bg-blue-soft"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 2v12M5 14l-3-3M5 14l3-3M11 14V2M11 2 8 5M11 2l3 3" />
              </svg>
            </button>
          </div>
          <p className="-mt-2 text-[13px] text-muted">
            También puedes tocar un punto del mapa y elegir <strong className="text-navy">Salir desde aquí</strong> o{" "}
            <strong className="text-navy">Ir hasta aquí</strong>.
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
            <Campo etiqueta="Límite de llegada" id="limite">
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
            <MapaInteractivo
              escenario={escenario}
              red={red}
              modo="usuario"
              hora={hora}
              onHora={setHora}
              origen={origen || undefined}
              destino={destino || undefined}
              ruta={r?.pasos}
              rutaTarde={r?.estado === "TARDE"}
              rutaKey={`${version}`}
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
              className="h-[min(640px,72vh)] min-h-[460px]"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
