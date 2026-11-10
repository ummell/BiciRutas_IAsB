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
    <div className="flex items-center gap-3">
      <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
        <rect width="38" height="38" rx="10" fill="#023365" />
        <path d="M8 27 L16 12 L23 21 L31 9" fill="none" stroke="#febd04" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="27" r="2.6" fill="#fff" />
        <circle cx="31" cy="9" r="2.6" fill="#0997e6" />
      </svg>
      <div className="leading-tight">
        <p className="text-xl font-extrabold tracking-tight text-navy">BiciRutas</p>
        <p className="text-xs font-semibold text-muted">prototipo para ias software</p>
      </div>
    </div>
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
    <div className="mx-auto flex min-h-screen max-w-[1480px] flex-col gap-6 px-5 py-5 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Marca />
        <nav aria-label="Vistas" className="flex rounded-2xl border border-line bg-white p-1 shadow-card">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              aria-current={vista === v.id ? "page" : undefined}
              className={`relative rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${
                vista === v.id ? "text-white" : "text-muted hover:text-navy"
              }`}
            >
              {vista === v.id && (
                <motion.span
                  layoutId="vista-activa"
                  className="absolute inset-0 rounded-xl bg-navy"
                  transition={reducir ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{v.nombre}</span>
            </button>
          ))}
        </nav>
      </header>

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

      <main className="flex-1 pb-8">
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
  );
}
