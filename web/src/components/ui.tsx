import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Estado } from "../lib/api";
import { aHora, aMin } from "../lib/time";
import { ETIQUETA_ESTADO } from "../lib/texto";

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const reducir = useReducedMotion();
  const [mostrado, setMostrado] = useState(value);
  const previo = useRef(value);

  useEffect(() => {
    if (reducir) {
      setMostrado(value);
      previo.current = value;
      return;
    }
    const control = animate(previo.current, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setMostrado(Math.round(v)),
    });
    previo.current = value;
    return () => control.stop();
  }, [value, reducir]);

  return <span className={`tnum ${className ?? ""}`}>{mostrado}</span>;
}

const ESTILO_CHIP: Record<Estado, string> = {
  A_TIEMPO: "bg-blue-soft text-navy-deep",
  TARDE: "bg-amber text-navy-deep",
  SIN_RUTA_SEGURA: "bg-rose-deep text-white",
};

export function EstadoChip({ estado, grande }: { estado: Estado; grande?: boolean }) {
  const icono =
    estado === "A_TIEMPO" ? (
      <path d="M3 8.5 6.5 12 13 4.5" />
    ) : estado === "TARDE" ? (
      <path d="M8 3v5l3 2" />
    ) : (
      <path d="M4 4l8 8M12 4l-8 8" />
    );
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${ESTILO_CHIP[estado]} ${
        grande ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        width={grande ? 16 : 13}
        height={grande ? 16 : 13}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {icono}
      </svg>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}

export function Card({
  children,
  className = "",
  titulo,
  accion,
}: {
  children: ReactNode;
  className?: string;
  titulo?: string;
  accion?: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-white shadow-card ${className}`}>
      {titulo && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 className="text-[15px] font-bold text-navy">{titulo}</h2>
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}

export function Campo({ etiqueta, children, id }: { etiqueta: string; children: ReactNode; id: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-muted">
        {etiqueta}
      </label>
      {children}
    </div>
  );
}

export const CLASE_INPUT =
  "w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] font-medium text-ink transition-colors hover:border-[#b7c3d6] focus:border-blue";

export function SelectorHora({
  id,
  valor,
  desde,
  hasta,
  paso,
  alCambiar,
}: {
  id: string;
  valor: string;
  desde: string;
  hasta: string;
  paso: number;
  alCambiar: (v: string) => void;
}) {
  const opciones: number[] = [];
  for (let m = aMin(desde); m <= aMin(hasta); m += paso) opciones.push(m);
  if (valor && !opciones.includes(aMin(valor))) opciones.push(aMin(valor));
  opciones.sort((a, b) => a - b);
  return (
    <select id={id} className={`${CLASE_INPUT} tnum`} value={valor} onChange={(e) => alCambiar(e.target.value)}>
      {opciones.map((m) => (
        <option key={m} value={aHora(m)}>
          {aHora(m)}
        </option>
      ))}
    </select>
  );
}

export function ErrorAviso({ mensaje }: { mensaje: string }) {
  return (
    <div role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-semibold text-rose-deep">
      {mensaje}
    </div>
  );
}
