import { useQueries } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { Asignacion, Estado, LoteLado, Metricas, Red } from "../lib/api";
import { api, ApiError, PESO_PLAN } from "../lib/api";
import { useLote } from "../lib/hooks";
import { aHora, aMin } from "../lib/time";
import { ETIQUETA_CAMBIO, ETIQUETA_ESTADO, explicarLote, planDominante, plural, tipoCambio, veces } from "../lib/texto";
import { LeyendaMapa, NetworkMap } from "../components/NetworkMap";
import { AnimatedNumber, Card, ErrorAviso, EstadoChip } from "../components/ui";

const PESOS = [1, 2, PESO_PLAN, 10, 1000];

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
  const [idxPeso, setIdxPeso] = useState(PESOS.indexOf(PESO_PLAN));
  const [lado, setLado] = useState<Lado>("equipo");
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [sel, setSel] = useState<string | null>(null);

  const consulta = useLote(escenario, PESOS[idxPeso]);
  const datos = consulta.data;
  const niveles = useQueries({
    queries: PESOS.map((p) => ({
      queryKey: ["lote", escenario, p],
      queryFn: () => api.lote(escenario, p),
      staleTime: Infinity,
    })),
  });
  const metricasNiveles = niveles.every((q) => q.data) ? niveles.map((q) => q.data!.equipo.metricas) : null;
  const dominante = metricasNiveles ? planDominante(metricasNiveles) : null;

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
  const explicacion = mRef && mEq ? explicarLote(mRef, mEq, { maxPuntualidad: idxPeso === 0 }) : null;

  return (
    <div className="flex flex-col gap-6">
      {datos && mEq && (
        <SelloEvaluador
          ok={datos.equipo.evaluador_ok}
          total={mEq.viajes_a_tiempo + mEq.viajes_tarde + mEq.viajes_sin_ruta_segura}
        />
      )}

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
            <p className="mt-0.5 text-[13px] text-muted">bicis por encima de la capacidad de cada tramo, sumadas cada 5 min · menos es mejor</p>
            <div className="mt-4 flex items-end gap-5">
              <div>
                <p className="text-[13px] font-semibold text-muted">Referencia</p>
                <p className="font-display text-4xl font-extrabold text-muted">
                  <AnimatedNumber value={refSobre} />
                </p>
              </div>
              <svg width="26" height="18" viewBox="0 0 26 18" className="mb-2 text-muted" aria-hidden="true">
                <path d="M1 9h22M16 2l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <p className="text-[13px] font-semibold text-navy">Con estrategia</p>
                <p className="font-display text-5xl font-extrabold text-navy">
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
            {explicacion && <p className="mt-2 text-[13px] leading-snug text-muted">{explicacion.sobrecarga}</p>}
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-bold text-navy">Puntualidad</h2>
            <p className="mt-0.5 text-[13px] text-muted">todos los viajes siguen en la simulación</p>
            <div className="mt-4 space-y-4">
              <BarraEstados titulo="Referencia" m={mRef} reducir={!!reducir} />
              <BarraEstados titulo="Con estrategia" m={mEq} reducir={!!reducir} fuerte />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-bold text-navy">Costo en tiempo</h2>
            <p className="mt-0.5 text-[13px] text-muted">lo que cuesta repartir la demanda</p>
            <dl className="mt-4 grid grid-cols-[1fr_auto_auto] items-baseline gap-x-5 gap-y-3 text-sm">
              <dt />
              <dd className="text-right text-xs font-bold text-muted">Ref.</dd>
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
              <dt className="font-semibold text-ink">Tramo más cargado</dt>
              <dd className="tnum text-right font-semibold text-muted">{veces(mRef.maxima_relacion_carga_capacidad)}</dd>
              <dd className="tnum text-right text-lg font-extrabold text-navy">{veces(mEq.maxima_relacion_carga_capacidad)}</dd>
            </dl>
            {explicacion && explicacion.costos.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-line pt-3 text-[13px] leading-snug text-muted">
                {explicacion.costos.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Card className="p-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div>
            <h2 className="text-[15px] font-bold text-navy">Qué pesa más</h2>
            <p className="mt-1 text-sm text-muted">
              Reducir la congestión puede obligar a algunos viajes a salir en otro momento o por otro corredor. Cada nivel
              reparte los viajes con más peso para la congestión; el reparto es aproximado, así que subir el peso no siempre baja
              la sobrecarga. Compara los números de cada nivel antes de elegir.
            </p>
          </div>
          <div>
            <div role="group" aria-label="Equilibrio entre puntualidad y reducción de congestión" className="grid grid-cols-5 gap-1.5">
              {PESOS.map((p, i) => {
                const mn = metricasNiveles?.[i];
                const peor = dominante?.[i];
                const activo = i === idxPeso;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setIdxPeso(i)}
                    className={`min-w-0 rounded-xl border px-2 py-2 text-left transition-colors ${
                      activo ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-navy/40"
                    }`}
                  >
                    <span className={`block text-[11px] font-bold ${activo ? "text-white/70" : "text-muted"}`}>
                      {p === PESO_PLAN ? "Plan entregado" : `Nivel ${i + 1}`}
                    </span>
                    {mn ? (
                      <>
                        <span className="tnum block text-[15px] font-extrabold leading-tight">{mn.sobrecarga_acumulada_bici_intervalo}</span>
                        <span className={`tnum block text-[11px] leading-tight ${activo ? "text-white/80" : "text-muted"}`}>
                          {mn.viajes_tarde} tarde · {mn.minutos_totales_tardanza} min
                        </span>
                        {peor != null && (
                          <span className={`mt-1 block text-[11px] font-semibold leading-tight ${activo ? "text-amber-light" : "text-amber"}`}>
                            Peor que {PESOS[peor] === PESO_PLAN ? "el plan entregado" : `el nivel ${peor + 1}`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="skeleton mt-1 block h-8 rounded" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-between text-xs font-semibold text-muted">
              <span>Más puntualidad</span>
              <span>Más peso a la congestión</span>
            </div>
            <p className="mt-1 text-xs text-muted">Número grande: sobrecarga acumulada. Debajo: viajes tarde y minutos de tardanza.</p>
          </div>
        </div>
      </Card>

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
                    <span className="relative">{l === "equipo" ? "Con estrategia" : "Referencia"}</span>
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
                    <th className="px-3 py-2 font-bold">Referencia</th>
                    <th className="px-3 py-2 font-bold">Con estrategia</th>
                    <th className="px-3 py-2 font-bold">Cambio</th>
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
                    const cambio = tipoCambio(b.recorrido, a.recorrido);
                    const tardanza = a.recorrido?.tardanza_min ?? 0;
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
                        <td className={`px-3 py-2 ${cambio && cambio !== "igual" ? "font-semibold text-navy" : "text-muted"}`}>
                          {cambio ? ETIQUETA_CAMBIO[cambio] : "—"}
                        </td>
                        <td className="rounded-r-lg px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <EstadoChip estado={a.estado} />
                            {tardanza > 0 && <span className="tnum text-xs font-bold text-amber">+{tardanza} min</span>}
                          </span>
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

export function SelloEvaluador({ ok, total }: { ok?: boolean; total: number }) {
  if (ok === undefined) return null;
  return ok ? (
    <p className="flex items-center gap-2 rounded-xl bg-bosque-100 px-4 py-3 text-sm font-semibold text-bosque">
      <span aria-hidden="true">✓</span>
      Validado por el evaluador oficial: rutas seguras, salidas dentro de su ventana y {total} de {total} viajes en el
      resultado.
    </p>
  ) : (
    <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-semibold text-rose-deep">
      El evaluador oficial rechaza este plan.
    </p>
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
          <span className="inline-block h-3 w-3 rounded-sm bg-[#dca79e]" aria-hidden="true" /> Referencia
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-navy" aria-hidden="true" /> Con estrategia
        </span>
        <span className="tnum">Máximo en un intervalo: {max}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Sobrecarga por intervalo de 5 minutos, en la referencia y con estrategia">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={margen.izq} x2={W - margen.der} y1={y(max * f)} y2={y(max * f)} stroke="#ece7dc" />
            <text x={margen.izq - 6} y={y(max * f) + 4} textAnchor="end" fontSize="11" fontWeight={600} fill="#566259">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        {refV.map((v, i) => (
          <motion.rect
            key={`r${i}`}
            x={margen.izq + i * paso + 0.5}
            width={Math.max(1, paso - 1)}
            fill="#dca79e"
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
            fill="#193a27"
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
              fill="#566259"
            >
              {aHora(m)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
