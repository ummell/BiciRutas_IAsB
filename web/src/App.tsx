import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ErrorAviso } from "./components/ui";
import { ApiError } from "./lib/api";
import { useEscenarios, useRed } from "./lib/hooks";
import { ConsultaView } from "./views/ConsultaView";
import { LoteView } from "./views/LoteView";

type Vista = "consulta" | "lote";

const VISTAS: { id: Vista; nombre: string }[] = [
  { id: "consulta", nombre: "Consulta de ruta" },
  { id: "lote", nombre: "Lote y comparación" },
];

function leerHash(): { vista: Vista; escenario: string } {
  const [v, e] = window.location.hash.slice(1).split("/");
  return {
    vista: v === "lote" ? "lote" : "consulta",
    escenario: /^\d{2}_[a-z_]+$/.test(e ?? "") ? e : "01_viaje_normal",
  };
}

function Marca() {
  return (
    <div className="flex items-center gap-3.5">
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        <rect width="44" height="44" rx="12" fill="#febd04" />
        <path d="M9 31 L18 14 L26 24 L35 10" fill="none" stroke="#023365" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="31" r="3.2" fill="#023365" />
        <circle cx="35" cy="10" r="3.2" fill="#fff" stroke="#023365" strokeWidth="2" />
      </svg>
      <div className="leading-tight">
        <p className="text-2xl font-extrabold tracking-tight text-white">BiciRutas</p>
        <p className="text-xs font-semibold text-white/70">prototipo para ias software</p>
      </div>
    </div>
  );
}

function Trama() {
  return (
    <svg
      className="pointer-events-none absolute inset-y-0 right-[27rem] hidden h-full w-[34%] xl:block"
      viewBox="0 0 520 120"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="2" strokeLinecap="round">
        <path d="M30 90 H150 L210 40 H330 L390 80 H500" />
        <path d="M150 90 V118 M330 40 V6 M390 80 V118" />
      </g>
      <g fill="#023365" stroke="#fff" strokeOpacity="0.28" strokeWidth="2">
        <circle cx="30" cy="90" r="6" />
        <circle cx="150" cy="90" r="6" />
        <circle cx="210" cy="40" r="6" />
        <circle cx="330" cy="40" r="6" />
        <circle cx="390" cy="80" r="6" />
      </g>
      <circle cx="500" cy="80" r="7" fill="#0997e6" fillOpacity="0.9" />
    </svg>
  );
}

export default function App() {
  const reducir = useReducedMotion();
  const inicial = leerHash();
  const [vista, setVistaEstado] = useState<Vista>(inicial.vista);
  const [escenario, setEscenarioEstado] = useState(inicial.escenario);
  const setVista = (v: Vista) => {
    setVistaEstado(v);
    window.location.hash = `${v}/${escenario}`;
  };
  const setEscenario = (e: string) => {
    setEscenarioEstado(e);
    window.location.hash = `${vista}/${e}`;
  };
  const escenarios = useEscenarios();
  const red = useRed(escenario);
  const actual = escenarios.data?.find((e) => e.id === escenario);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative overflow-hidden bg-navy">
        <Trama />
        <div className="relative mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Marca />
          <nav aria-label="Vistas" className="flex rounded-2xl bg-white/10 p-1 backdrop-blur-sm">
            {VISTAS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVista(v.id)}
                aria-current={vista === v.id ? "page" : undefined}
                className={`relative rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${
                  vista === v.id ? "text-navy" : "text-white/80 hover:text-white"
                }`}
              >
                {vista === v.id && (
                  <motion.span
                    layoutId="vista-activa"
                    className="absolute inset-0 rounded-xl bg-white"
                    transition={reducir ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{v.nombre}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-6 px-5 pb-10 pt-6 lg:px-8">
        <section aria-label="Escenario" className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(escenarios.data ?? []).map((e) => (
              <button
                key={e.id}
                onClick={() => setEscenario(e.id)}
                aria-pressed={escenario === e.id}
                className={`rounded-full border px-4 py-2 text-[13px] font-bold transition-colors ${
                  escenario === e.id
                    ? "border-navy bg-navy text-white"
                    : "border-line bg-white text-muted hover:border-navy hover:text-navy"
                }`}
              >
                {e.id.slice(0, 2)} · {e.nombre}
                <span className="tnum ml-2 font-semibold opacity-75">{e.cantidad_viajes}</span>
              </button>
            ))}
          </div>
          {actual && <p className="max-w-3xl text-sm text-muted">{actual.objetivo}</p>}
        </section>

        <main className="flex-1">
          {escenarios.isError && (
            <ErrorAviso
              mensaje={escenarios.error instanceof ApiError ? escenarios.error.message : "No se pudo conectar con la API."}
            />
          )}
          {red.isError && (
            <ErrorAviso mensaje={red.error instanceof ApiError ? red.error.message : "No se pudo cargar la red."} />
          )}
          {red.data ? (
            <motion.div
              key={`${vista}-${escenario}`}
              initial={reducir ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {vista === "consulta" ? (
                <ConsultaView escenario={escenario} red={red.data} />
              ) : (
                <LoteView escenario={escenario} red={red.data} />
              )}
            </motion.div>
          ) : (
            !red.isError && <div className="skeleton h-[32rem] rounded-2xl" aria-hidden="true" />
          )}
        </main>
      </div>
    </div>
  );
}
