import { useEffect, useMemo, useState } from "react";
import type { Red } from "../lib/api";
import { calcularCambios, cambioAnterior, cambioEn, cambioSiguiente } from "../lib/cambios";
import { useLineaTiempo } from "../lib/hooks";
import { aHora, aMin } from "../lib/time";

interface Props {
  red: Red;
  escenario: string;
  hora: string;
  alCambiar: (hora: string) => void;
  viaje: { salida: string; llegada: string } | null;
}

const COLOR_CAMBIO = { bloqueo: "bg-rose", reapertura: "bg-blue", mixto: "bg-navy" } as const;

export function ControlHora({ red, escenario, hora, alCambiar, viaje }: Props) {
  const linea = useLineaTiempo(escenario);
  const cambios = useMemo(() => (linea.data ? calcularCambios(linea.data) : []), [linea.data]);
  const [jugando, setJugando] = useState(false);
  const [velocidad, setVelocidad] = useState<1 | 2>(1);

  const inicio = aMin(red.config.inicio);
  const paso = red.config.intervalo_min;
  const ultimo = aMin(red.config.fin) - paso;
  const span = ultimo - inicio;
  const pct = (minuto: number) => ((minuto - inicio) / span) * 100;

  const actual = cambioEn(cambios, hora);
  const siguiente = cambioSiguiente(cambios, hora);
  const anterior = cambioAnterior(cambios, hora);

  useEffect(() => {
    if (!jugando) return;
    if (aMin(hora) >= ultimo) {
      setJugando(false);
      return;
    }
    const espera = (cambioEn(cambios, hora) ? 1600 : 170) / velocidad;
    const temporizador = window.setTimeout(() => alCambiar(aHora(aMin(hora) + paso)), espera);
    return () => window.clearTimeout(temporizador);
  }, [jugando, hora, velocidad, cambios, paso, ultimo, alCambiar]);

  function alternarReproduccion() {
    if (!jugando && aMin(hora) >= ultimo) alCambiar(red.config.inicio);
    setJugando((j) => !j);
  }

  function ir(destino: string) {
    setJugando(false);
    alCambiar(destino);
  }

  const nocheInicio = pct(aMin(red.config.inicio_noche));
  const nocheFin = Math.min(100, pct(aMin(red.config.fin_noche)));
  const fueraDeSalida = viaje !== null && hora !== viaje.salida;

  return (
    <div className="mx-5 mb-4 rounded-xl bg-ground px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <label htmlFor="hora" className="text-[13px] font-semibold text-muted">
          Vista de la red a las
        </label>
        <div className="flex items-center gap-3">
          {fueraDeSalida && viaje && (
            <button
              type="button"
              onClick={() => ir(viaje.salida)}
              className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold text-navy transition-colors hover:border-navy"
            >
              Volver a la salida ({viaje.salida})
            </button>
          )}
          <span className="tnum text-3xl font-extrabold leading-none text-navy">{hora}</span>
        </div>
      </div>

      <div className="relative mt-3 h-[58px]">
        <div className="absolute inset-x-[11px] inset-y-0">
          <div className="absolute inset-x-0 top-[26px] h-2 overflow-hidden rounded-full bg-[#dde4ee]">
            <div
              className="absolute inset-y-0 bg-[#a9b9d2]"
              style={{ left: `${nocheInicio}%`, width: `${Math.max(0, nocheFin - nocheInicio)}%` }}
              title="Horario nocturno"
            />
            <div className="absolute inset-y-0 left-0 bg-navy" style={{ width: `${pct(aMin(hora))}%` }} />
          </div>

          {viaje && (
            <div
              className="absolute top-[42px] h-1.5 rounded-full bg-amber"
              style={{
                left: `${pct(aMin(viaje.salida))}%`,
                width: `${Math.max(1.2, pct(aMin(viaje.llegada)) - pct(aMin(viaje.salida)))}%`,
              }}
              title={`Tu viaje: ${viaje.salida} a ${viaje.llegada}`}
            />
          )}

          {cambios.map((c) => (
            <button
              key={c.hora}
              type="button"
              onClick={() => ir(c.hora)}
              title={`${c.hora} · ${c.texto}`}
              aria-label={`Ir a las ${c.hora}: ${c.texto}`}
              className="group absolute top-0 grid h-6 w-5 -translate-x-1/2 place-items-center"
              style={{ left: `${pct(c.minuto)}%` }}
            >
              <span
                className={`h-3.5 w-[3px] rounded-full ${COLOR_CAMBIO[c.tipo]} transition-transform group-hover:scale-y-125 ${
                  c.hora === hora ? "ring-2 ring-navy/30" : ""
                }`}
              />
            </button>
          ))}
        </div>

        <input
          id="hora"
          type="range"
          className="rango-hora absolute inset-x-0 top-4 h-7 w-full"
          min={inicio}
          max={ultimo}
          step={paso}
          value={aMin(hora)}
          aria-valuetext={`${hora}${actual ? `. ${actual.texto}` : ""}`}
          onChange={(e) => {
            setJugando(false);
            alCambiar(aHora(Number(e.target.value)));
          }}
          onKeyDown={(e) => {
            if (e.key === "PageUp" || e.key === "PageDown") {
              e.preventDefault();
              const destino = aMin(hora) + (e.key === "PageUp" ? 60 : -60);
              ir(aHora(Math.min(ultimo, Math.max(inicio, destino))));
            }
          }}
        />
      </div>

      <div className="tnum relative mt-1 h-4 text-xs font-medium text-muted">
        <span className="absolute left-0">{red.config.inicio}</span>
        <span
          className="absolute -translate-x-0 whitespace-nowrap"
          style={{ left: `calc(11px + (100% - 22px) * ${nocheInicio / 100})` }}
        >
          noche desde {red.config.inicio_noche}
        </span>
        <span className="absolute right-0">{red.config.fin}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!anterior}
          onClick={() => anterior && ir(anterior.hora)}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-xs font-bold text-navy transition-colors hover:border-navy disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 2 4 6l4 4" />
          </svg>
          Cambio anterior
        </button>
        <button
          type="button"
          onClick={alternarReproduccion}
          className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-navy-deep"
          aria-label={jugando ? "Pausar" : "Reproducir el día"}
        >
          {jugando ? (
            <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <rect x="2" y="1" width="3.5" height="12" rx="1" />
              <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M3 1.5v11l9-5.5z" />
            </svg>
          )}
          {jugando ? "Pausar" : "Reproducir"}
        </button>
        <button
          type="button"
          disabled={!siguiente}
          onClick={() => siguiente && ir(siguiente.hora)}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-xs font-bold text-navy transition-colors hover:border-navy disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cambio siguiente
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 2l4 4-4 4" />
          </svg>
        </button>
        <div role="radiogroup" aria-label="Velocidad" className="ml-auto flex rounded-full bg-white p-0.5 text-xs font-bold">
          {([1, 2] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={velocidad === v}
              onClick={() => setVelocidad(v)}
              className={`rounded-full px-3 py-1.5 transition-colors ${velocidad === v ? "bg-navy text-white" : "text-muted hover:text-navy"}`}
            >
              {v}×
            </button>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="mt-3 min-h-[2.5rem] text-sm leading-snug text-ink">
        {actual ? (
          <>
            <strong className="text-navy">A las {actual.hora}:</strong> {actual.texto}.
          </>
        ) : siguiente ? (
          <>
            <span className="text-muted">Próximo cambio a las </span>
            <strong className="tnum text-navy">{siguiente.hora}</strong>
            <span className="text-muted">: {siguiente.texto}.</span>
          </>
        ) : (
          <span className="text-muted">No hay más cambios hasta las {red.config.fin}.</span>
        )}
      </p>

      <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-muted">
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-[3px] rounded-full bg-rose" aria-hidden="true" /> Se bloquea un tramo
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-[3px] rounded-full bg-blue" aria-hidden="true" /> Se reabre
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-[#a9b9d2]" aria-hidden="true" /> Noche
        </li>
        {viaje && (
          <li className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-amber" aria-hidden="true" /> Tu viaje {viaje.salida} a {viaje.llegada}
          </li>
        )}
      </ul>
    </div>
  );
}
