import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ErrorAviso } from "./components/ui";
import { ApiError } from "./lib/api";
import { useEscenarios, useRed } from "./lib/hooks";
import { useRol, type Rol } from "./lib/rol";
import { ConsultaView } from "./views/ConsultaView";
import { LoteView } from "./views/LoteView";
import { UsuarioView } from "./views/UsuarioView";

type Vista = "consulta" | "lote";

const ROLES: { id: Rol; nombre: string; rol: string }[] = [
  { id: "usuario", nombre: "Planear mi viaje", rol: "Usuario" },
  { id: "administracion", nombre: "Consulta y lote", rol: "Administración" },
];

const ESCENARIO_USUARIO = "01_viaje_normal";

const PESTANAS_ADMIN: { id: Vista; nombre: string }[] = [
  { id: "consulta", nombre: "Consulta avanzada" },
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
      <span className="grid size-12 place-items-center rounded-2xl bg-white shadow-sm">
        <img src="/marca/logo.png" alt="" className="h-9 w-auto" />
      </span>
      <div className="leading-tight">
        <p className="font-display text-[26px] font-extrabold tracking-tight text-white">BiciRutas</p>
        <p className="text-xs font-medium text-white/70">Rutas seguras en bicicleta</p>
      </div>
    </div>
  );
}

function Trama() {
  const camino = "M10 98 C 90 98, 120 70, 190 76 S 300 100, 360 86 S 450 58, 520 68";
  const recorrido = "M10 98 C 90 98, 120 70, 190 76 S 248 90, 262 90";
  return (
    <svg
      className="trama pointer-events-none absolute inset-y-0 right-[27rem] hidden h-full w-[38%] xl:block"
      viewBox="0 0 560 120"
      preserveAspectRatio="xMaxYMid meet"
      aria-hidden="true"
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={camino} stroke="#a9bba6" strokeOpacity="0.55" strokeWidth="2.4" strokeDasharray="1 9" className="trama-camino" />
        <path d={recorrido} stroke="#e07a2b" strokeWidth="2.6" />

        <g stroke="#ffffff" strokeOpacity="0.32" strokeWidth="1.8">
          <path d="M70 92 V80" />
          <circle cx="70" cy="73" r="7" />
          <path d="M150 74 V64" />
          <circle cx="150" cy="58" r="6" />
          <path d="M408 70 V58" />
          <circle cx="408" cy="51" r="7" />
          <path d="M438 66 V40 H458 V66 M462 66 V30 H480 V66" />
          <path d="M443 47 H453 M443 55 H453 M466 38 H476 M466 46 H476 M466 54 H476" strokeOpacity="0.5" />
        </g>

        <g className="trama-ciclista" transform="translate(268 78)" stroke="#ffffff" strokeWidth="2.2">
          <circle cx="-16" cy="0" r="11" />
          <circle cx="16" cy="0" r="11" />
          <path d="M-16 0 L-4 -14 L10 -14 L16 0 M-4 -14 L0 0 L10 -14" />
          <path d="M-4 -14 L-6 -19 M-9 -19 H-3" />
          <path d="M10 -14 L8 -21 L13 -21" />
          <path d="M-5 -19 L3 -33 M3 -31 L11 -22 M-5 -19 L4 -9 L0 0" />
          <circle cx="7" cy="-38" r="4.5" />
          <circle cx="-16" cy="0" r="2" fill="#e07a2b" stroke="none" />
          <circle cx="16" cy="0" r="2" fill="#e07a2b" stroke="none" />
        </g>

        <g transform="translate(520 70)">
          <path d="M0 0 C -4 -9 -14 -15 -14 -27 A 14 14 0 1 1 14 -27 C 14 -15 4 -9 0 0 Z" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2.2" />
          <path d="M -9.5 -31 A 10.5 10.5 0 0 1 9.5 -31" stroke="#e07a2b" strokeWidth="3" />
          <circle cy="-26" r="4" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2" />
        </g>
      </g>
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
  const [rol, setRol] = useRol();
  const admin = rol === "administracion";
  const elegirRol = (r: Rol) => setRol(r);
  const elegirPestana = (v: Vista) => setVista(v);
  const escenarioActivo = admin ? escenario : ESCENARIO_USUARIO;
  const escenarios = useEscenarios();
  const red = useRed(escenarioActivo);
  const actual = escenarios.data?.find((e) => e.id === escenario);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative overflow-hidden bg-navy">
        <Trama />
        <div className="relative mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Marca />
          <nav aria-label="Vistas" className="flex rounded-2xl bg-white/10 p-1 backdrop-blur-sm">
            {ROLES.map((v) => (
              <button
                key={v.id}
                onClick={() => elegirRol(v.id)}
                aria-current={rol === v.id ? "page" : undefined}
                className={`relative rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${
                  rol === v.id ? "text-navy" : "text-white/80 hover:text-white"
                }`}
              >
                {rol === v.id && (
                  <motion.span
                    layoutId="vista-activa"
                    className="absolute inset-0 rounded-xl bg-white"
                    transition={reducir ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative block text-left leading-tight">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider opacity-70">{v.rol}</span>
                  {v.nombre}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-6 px-5 pb-10 pt-6 lg:px-8">
        {admin && (
        <div className="flex flex-col gap-4">
        <div role="tablist" aria-label="Secciones de administración" className="flex w-fit gap-1 rounded-2xl border border-line bg-white p-1 shadow-card">
          {PESTANAS_ADMIN.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={vista === t.id}
              onClick={() => elegirPestana(t.id)}
              className={`rounded-xl px-4 py-2 text-[14px] font-bold transition-colors ${
                vista === t.id ? "bg-bosque text-white" : "text-muted hover:text-bosque"
              }`}
            >
              {t.nombre}
            </button>
          ))}
        </div>
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
        </div>
        )}

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
              key={`${rol}-${vista}-${escenarioActivo}`}
              initial={reducir ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {!admin ? (
                <UsuarioView escenario={escenarioActivo} red={red.data} />
              ) : vista === "consulta" ? (
                <ConsultaView escenario={escenario} red={red.data} admin />
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
