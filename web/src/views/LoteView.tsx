import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { Asignacion, Estado, LoteLado, Metricas, Red } from "../lib/api";
import { ApiError } from "../lib/api";
import { useLote } from "../lib/hooks";
import { aHora, aMin } from "../lib/time";
import { ETIQUETA_ESTADO, plural } from "../lib/texto";
import { LeyendaMapa, NetworkMap } from "../components/NetworkMap";
import { AnimatedNumber, Card, ErrorAviso, EstadoChip } from "../components/ui";

const PESOS = [1, 2, 3, 10, 1000];

type Lado = "equipo" | "referencia";
type Filtro = "TODOS" | Estado;

function calorPorTramo(lado: LoteLado): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of lado.ocupacion) out[f.tramo_id] = (out[f.tramo_id] ?? 0) + f.sobrecarga;
  return out;
}

function serieTemporal(lado: LoteLado, inicio: number, n: number, dt: number): number[] {
  const porHora = new Map<string, number>();
  for (const f of lado.ocupacion) porHora.set(f.inicio, (porHora.get(f.inicio) ?? 0) + f.sobrecarga);
  return Array.from({ length: n }, (_, i) => porHora.get(aHora(inicio + i * dt)) ?? 0);
}

function Esqueleto({ alto }: { alto: string }) {
  return <div className={`skeleton rounded-2xl ${alto}`} aria-hidden="true" />;
}

export function LoteView({ escenario, red }: { escenario: string; red: Red }) {
  const reducir = useReducedMotion();
  const [idxPeso, setIdxPeso] = useState(PESOS.length - 1);
  const [lado, setLado] = useState<Lado>("equipo");
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [sel, setSel] = useState<string | null>(null);

  const consulta = useLote(escenario, PESOS[idxPeso]);
  const datos = consulta.data;

  const inicio = aMin(red.config.inicio);
  const dt = red.config.intervalo_min;
  const nIntervalos = (aMin(red.config.fin) - inicio) / dt;

  const calc = useMemo(() => {
    if (!datos) return null;
    const calorEq = calorPorTramo(datos.equipo);
    const calorRef = calorPorTramo(datos.referencia);
    const max = Math.max(0, ...Object.values(calorEq), ...Object.values(calorRef));
    return {
      calorEq,
      calorRef,
      max,
      serieEq: serieTemporal(datos.equipo, inicio, nIntervalos, dt),
      serieRef: serieTemporal(datos.referencia, inicio, nIntervalos, dt),
    };
  }, [datos, inicio, nIntervalos, dt]);

  const filas = useMemo(() => {
    if (!datos) return [];
    const ref = new Map(datos.referencia.asignaciones.map((a) => [a.viaje_id, a]));
    const viajes = new Map(red.viajes.map((v) => [v.id, v]));
    return datos.equipo.asignaciones.map((a) => ({
      equipo: a,
      referencia: ref.get(a.viaje_id) as Asignacion,
      viaje: viajes.get(a.viaje_id)!,
    }));
  }, [datos, red.viajes]);

  const visibles = filas.filter((f) => filtro === "TODOS" || f.equipo.estado === filtro);
  const seleccion = filas.find((f) => f.equipo.viaje_id === sel);
  const asigSel = seleccion ? seleccion[lado === "equipo" ? "equipo" : "referencia"] : undefined;
  const rutaSel = asigSel?.recorrido ?? null;

  if (consulta.isError) {
    return (
      <ErrorAviso
        mensaje={consulta.error instanceof ApiError ? consulta.error.message : "No se pudo cargar el escenario."}
      />
    );
  }

  const mEq = datos?.equipo.metricas;
  const mRef = datos?.referencia.metricas;
  const refSobre = mRef?.sobrecarga_acumulada_bici_intervalo ?? 0;
  const eqSobre = mEq?.sobrecarga_acumulada_bici_intervalo ?? 0;
  const mejora = refSobre === 0 ? null : (100 * (refSobre - eqSobre)) / refSobre;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div>
            <h2 className="text-[15px] font-bold text-navy">Qué pesa más</h2>
            <p className="mt-1 text-sm text-muted">
              Reducir la congestión puede obligar a algunos viajes a salir en otro momento o por otro corredor. Ajusta el
              equilibrio con la puntualidad.
            </p>
          </div>
          <div>
            <input
              type="range"
              className="w-full"
              min={0}
              max={PESOS.length - 1}
              step={1}
              value={idxPeso}
              onChange={(e) => setIdxPeso(Number(e.target.value))}
              aria-label="Equilibrio entre puntualidad y reducción de congestión"
              aria-valuetext={idxPeso === PESOS.length - 1 ? "Prioriza reducir la congestión" : `Nivel ${idxPeso + 1} de ${PESOS.length}`}
            />
            <div className="mt-1 flex justify-between text-xs font-semibold text-muted">
              <span>Más puntualidad</span>
              <span>Más reducción de congestión</span>
            </div>
          </div>
        </div>
      </Card>

      {!datos || !mEq || !mRef || !calc ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-3">
          <Esqueleto alto="h-44" />
          <Esqueleto alto="h-44" />
          <Esqueleto alto="h-44" />
        </div>
      ) : (
        <div className={`grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-3 ${consulta.isFetching ? "opacity-70" : ""}`} style={{ transition: "opacity 200ms" }}>
          <Card className="p-5">
            <h2 className="text-[15px] font-bold text-navy">Sobrecarga acumulada</h2>
            <p className="mt-0.5 text-[13px] text-muted">bici-intervalos de 5 min, menos es mejor</p>
            <div className="mt-4 flex items-end gap-5">
              <div>
                <p className="text-[13px] font-semibold text-muted">Sin estrategia</p>
                <p className="text-4xl font-extrabold text-muted">
                  <AnimatedNumber value={refSobre} />
                </p>
              </div>
              <svg width="26" height="18" viewBox="0 0 26 18" className="mb-2 text-muted" aria-hidden="true">
                <path d="M1 9h22M16 2l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <p className="text-[13px] font-semibold text-navy">Con estrategia</p>
                <p className="text-5xl font-extrabold text-navy">
                  <AnimatedNumber value={eqSobre} />
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-navy">
              {mejora === null ? (
                "Mejora: no aplica, la referencia ya vale 0."
              ) : (
                <>
                  Baja <span className="tnum rounded-md bg-blue-soft px-1.5 py-0.5 text-blue-deep">{mejora.toFixed(1).replace(".", ",")} %</span>{" "}
                  frente a la referencia.
                </>
              )}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-bold text-navy">Puntualidad</h2>
            <p className="mt-0.5 text-[13px] text-muted">todos los viajes siguen en la simulación</p>
            <div className="mt-4 space-y-4">
              <BarraEstados titulo="Sin estrategia" m={mRef} reducir={!!reducir} />
              <BarraEstados titulo="Con estrategia" m={mEq} reducir={!!reducir} fuerte />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-bold text-navy">Costo en tiempo</h2>
            <p className="mt-0.5 text-[13px] text-muted">lo que cuesta repartir la demanda</p>
            <dl className="mt-4 grid grid-cols-[1fr_auto_auto] items-baseline gap-x-5 gap-y-3 text-sm">
              <dt />
              <dd className="text-right text-xs font-bold text-muted">Sin</dd>
              <dd className="text-right text-xs font-bold text-navy">Con</dd>
              <dt className="font-semibold text-ink">Minutos de viaje</dt>
              <dd className="tnum text-right font-semibold text-muted">{mRef.minutos_totales_viaje}</dd>
              <dd className="tnum text-right text-lg font-extrabold text-navy">{mEq.minutos_totales_viaje}</dd>
              <dt className="font-semibold text-ink">Minutos de tardanza</dt>
              <dd className="tnum text-right font-semibold text-muted">{mRef.minutos_totales_tardanza}</dd>
              <dd className="tnum text-right text-lg font-extrabold text-navy">{mEq.minutos_totales_tardanza}</dd>
              <dt className="font-semibold text-ink">Pares saturados</dt>
              <dd className="tnum text-right font-semibold text-muted">{mRef.pares_saturados}</dd>
              <dd className="tnum text-right text-lg font-extrabold text-navy">{mEq.pares_saturados}</dd>
            </dl>
          </Card>
        </div>
      )}

      {calc && (
        <Card titulo="Sobrecarga a lo largo del día" className="pb-4">
          <Serie
            ref_={calc.serieRef}
            eq={calc.serieEq}
            inicio={inicio}
            dt={dt}
            reducir={!!reducir}
          />
        </Card>
      )}

      {datos && calc && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Card className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
              <h2 className="text-[15px] font-bold text-navy">Dónde se concentra la sobrecarga</h2>
              <div role="tablist" aria-label="Vista del mapa" className="flex rounded-xl bg-ground p-1">
                {(["equipo", "referencia"] as Lado[]).map((l) => (
                  <button
                    key={l}
                    role="tab"
                    aria-selected={lado === l}
                    onClick={() => setLado(l)}
                    className={`relative rounded-lg px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                      lado === l ? "text-white" : "text-muted hover:text-navy"
                    }`}
                  >
                    {lado === l && (
                      <motion.span
                        layoutId="lado-activo"
                        className="absolute inset-0 rounded-lg bg-navy"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative">{l === "equipo" ? "Con estrategia" : "Sin estrategia"}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-3 pb-1 pt-2">
              <NetworkMap
                red={red}
                origen={seleccion?.viaje.origen}
                destino={seleccion?.viaje.destino}
                ruta={rutaSel?.pasos}
                rutaTarde={rutaSel?.estado === "TARDE"}
                rutaKey={`${sel}-${lado}`}
                calor={lado === "equipo" ? calc.calorEq : calc.calorRef}
                calorMax={calc.max}
              />
            </div>
            <div className="border-t border-line px-5 py-3.5">
              <LeyendaMapa modo="calor" />
            </div>
          </Card>

          <Card className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
              <h2 className="text-[15px] font-bold text-navy">Viajes ({plural(visibles.length, "viaje", "viajes")})</h2>
              <div className="flex flex-wrap gap-1.5">
                {(["TODOS", "A_TIEMPO", "TARDE", "SIN_RUTA_SEGURA"] as Filtro[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    aria-pressed={filtro === f}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                      filtro === f ? "bg-navy text-white" : "bg-ground text-muted hover:text-navy"
                    }`}
                  >
                    {f === "TODOS" ? "Todos" : ETIQUETA_ESTADO[f]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 max-h-[26rem] min-h-0 flex-1 overflow-auto px-2 pb-3">
              <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
                <thead className="sticky top-0 bg-white text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-bold">Viaje</th>
                    <th className="px-3 py-2 font-bold">Sin estrategia</th>
                    <th className="px-3 py-2 font-bold">Con estrategia</th>
                    <th className="px-3 py-2 font-bold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((f) => {
                    const a = f.equipo;
                    const b = f.referencia;
                    const activo = sel === a.viaje_id;
                    const tramoTxt = (x: Asignacion) =>
                      x.recorrido ? `${x.recorrido.salida} → ${x.recorrido.llegada}` : "—";
                    return (
                      <tr
                        key={a.viaje_id}
                        onClick={() => setSel(activo ? null : a.viaje_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSel(activo ? null : a.viaje_id);
                          }
                        }}
                        tabIndex={0}
                        aria-selected={activo}
                        className={`cursor-pointer transition-colors ${activo ? "bg-blue-soft" : "hover:bg-ground"}`}
                      >
                        <td className="rounded-l-lg px-3 py-2">
                          <span className="font-bold text-navy">{a.viaje_id}</span>
                          <span className="tnum ml-2 text-muted">
                            {f.viaje.origen}→{f.viaje.destino}
                          </span>
                        </td>
                        <td className="tnum px-3 py-2 text-muted">{tramoTxt(b)}</td>
                        <td className="tnum px-3 py-2 font-semibold text-ink">{tramoTxt(a)}</td>
                        <td className="rounded-r-lg px-3 py-2">
                          <EstadoChip estado={a.estado} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibles.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">Ningún viaje con este estado.</p>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function BarraEstados({
  titulo,
  m,
  reducir,
  fuerte,
}: {
  titulo: string;
  m: Metricas;
  reducir: boolean;
  fuerte?: boolean;
}) {
  const total = m.viajes_a_tiempo + m.viajes_tarde + m.viajes_sin_ruta_segura || 1;
  const partes = [
    { n: m.viajes_a_tiempo, clase: "bg-blue", nombre: "a tiempo" },
    { n: m.viajes_tarde, clase: "bg-amber", nombre: "tarde" },
    { n: m.viajes_sin_ruta_segura, clase: "bg-rose-deep", nombre: "sin ruta" },
  ];
  return (
    <div>
      <p className={`mb-1.5 text-[13px] font-semibold ${fuerte ? "text-navy" : "text-muted"}`}>{titulo}</p>
      <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-ground">
        {partes
          .filter((p) => p.n > 0)
          .map((p) => (
            <motion.div
              key={p.nombre}
              className={p.clase}
              initial={reducir ? false : { width: 0 }}
              animate={{ width: `${(p.n / total) * 100}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
      </div>
      <p className="tnum mt-1.5 text-[13px] font-medium text-ink">
        {partes
          .filter((p) => p.n > 0)
          .map((p) => `${p.n} ${p.nombre}`)
          .join(" · ")}
      </p>
    </div>
  );
}

function Serie({
  ref_,
  eq,
  inicio,
  dt,
  reducir,
}: {
  ref_: number[];
  eq: number[];
  inicio: number;
  dt: number;
  reducir: boolean;
}) {
  const W = 880;
  const H = 190;
  const margen = { izq: 34, der: 8, arr: 10, aba: 28 };
  const ancho = W - margen.izq - margen.der;
  const alto = H - margen.arr - margen.aba;
  const activos = ref_.map((v, i) => (v > 0 || eq[i] > 0 ? i : -1)).filter((i) => i >= 0);
  const desde = activos.length ? Math.max(0, activos[0] - 4) : 0;
  const hasta = activos.length ? Math.min(ref_.length, activos[activos.length - 1] + 5) : ref_.length;
  const refV = ref_.slice(desde, hasta);
  const eqV = eq.slice(desde, hasta);
  const iniV = inicio + desde * dt;
  const finV = inicio + hasta * dt;
  const salto = hasta - desde > 30 ? 60 : 15;
  const max = Math.max(1, ...refV, ...eqV);
  const n = refV.length;
  const paso = ancho / n;
  const horas: number[] = [];
  for (let m = Math.ceil(iniV / salto) * salto; m <= finV; m += salto) horas.push(m);
  const y = (v: number) => margen.arr + alto - (v / max) * alto;

  return (
    <div className="px-5 pt-2">
      <div className="mb-1 flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-medium text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-[#f4a3bb]" aria-hidden="true" /> Sin estrategia
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-navy" aria-hidden="true" /> Con estrategia
        </span>
        <span className="tnum">Máximo en un intervalo: {max}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Sobrecarga por intervalo de 5 minutos, con y sin estrategia">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={margen.izq} x2={W - margen.der} y1={y(max * f)} y2={y(max * f)} stroke="#e6ecf4" />
            <text x={margen.izq - 6} y={y(max * f) + 4} textAnchor="end" fontSize="11" fontWeight={600} fill="#56627a">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        {refV.map((v, i) => (
          <motion.rect
            key={`r${i}`}
            x={margen.izq + i * paso + 0.5}
            width={Math.max(1, paso - 1)}
            fill="#f4a3bb"
            initial={reducir ? false : { y: y(0), height: 0 }}
            animate={{ y: y(v), height: y(0) - y(v) }}
            transition={{ duration: 0.6, delay: reducir ? 0 : i * 0.004, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
        {eqV.map((v, i) => (
          <motion.rect
            key={`e${i}`}
            x={margen.izq + i * paso + paso * 0.2}
            width={Math.max(1, paso * 0.6)}
            fill="#023365"
            initial={reducir ? false : { y: y(0), height: 0 }}
            animate={{ y: y(v), height: y(0) - y(v) }}
            transition={{ duration: 0.6, delay: reducir ? 0 : 0.15 + i * 0.004, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
        {horas.map((m) => {
          const x = margen.izq + ((m - iniV) / dt) * paso;
          return (
            <text
              key={m}
              x={x}
              y={H - 8}
              textAnchor={x > W - 30 ? "end" : "middle"}
              fontSize="11"
              fontWeight={600}
              fill="#56627a"
            >
              {aHora(m)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
