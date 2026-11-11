import json
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from bicirutas.consulta import candidatos, consultar, motivo_sin_ruta, rutas_distintas, salidas_permitidas
from bicirutas.datos import cargar_escenario, listar_escenarios
from bicirutas.estrategia import PESO_CONGESTION, repartir
from bicirutas.generar import validar_con_evaluador
from bicirutas.lote import a_resultado_json, construir_ocupacion, metricas, referencia_lote
from bicirutas.modelo import RutaInvalida, pasar_tramo
from bicirutas.tiempo import a_hora, a_minutos

app = FastAPI(title="BiciRutas API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

HORA = r"^([01]\d|2[0-3]):[0-5]\d$"


@lru_cache(maxsize=16)
def _escenario(escenario_id: str):
    try:
        return cargar_escenario(escenario_id)
    except ValueError:
        raise HTTPException(404, f"Escenario desconocido: {escenario_id}") from None


def _recorrido(r) -> dict | None:
    if r is None:
        return None
    return dict(
        viaje_id=r.viaje_id,
        estado=r.estado,
        salida=a_hora(r.salida),
        llegada=a_hora(r.llegada),
        duracion_min=r.duracion_min,
        tardanza_min=r.tardanza_min,
        pasos=[dict(tramo_id=p.tramo_id, entrada=a_hora(p.entrada), salida=a_hora(p.salida)) for p in r.pasos],
    )


@lru_cache(maxsize=32)
def _reparto(escenario_id: str, peso: int):
    esc = _escenario(escenario_id)
    return repartir(esc, peso_congestion=peso)


@lru_cache(maxsize=16)
def _ocupacion(escenario_id: str):
    return construir_ocupacion(_escenario(escenario_id), _reparto(escenario_id, PESO_CONGESTION))


def _asignaciones(asignaciones: list) -> list:
    return [
        dict(viaje_id=a.viaje_id, estado=a.estado, recorrido=_recorrido(a.recorrido)) for a in asignaciones
    ]


def _mapa_calor(esc, asignaciones: list) -> list:
    filas = construir_ocupacion(esc, asignaciones).detalle()
    return [f for f in filas if f["carga_total"] > 0]


@app.get("/api/salud")
def salud():
    return {"estado": "ok"}


@app.get("/api/escenarios")
def escenarios():
    return listar_escenarios()


@app.get("/api/escenarios/{escenario_id}/red")
def red(escenario_id: str):
    esc = _escenario(escenario_id)
    return dict(
        escenario_id=esc.id,
        config=esc.config,
        nodos=esc.nodos,
        tramos=list(esc.tramos.values()),
        restricciones=[r for lista in esc.restricciones.values() for r in lista],
        viajes=esc.viajes,
    )


class ConsultaIn(BaseModel):
    origen: str
    destino: str
    salida_desde: str = Field(pattern=HORA)
    llegada_limite: str = Field(pattern=HORA)
    salida_hasta: str | None = Field(default=None, pattern=HORA)
    criterio: Literal["rapido", "equilibrado"] = "rapido"


@app.post("/api/escenarios/{escenario_id}/consulta")
def consulta(escenario_id: str, datos: ConsultaIn):
    esc = _escenario(escenario_id)
    nodos = {n["id"] for n in esc.nodos}
    if datos.origen not in nodos or datos.destino not in nodos:
        raise HTTPException(422, "Origen o destino desconocido")
    if datos.origen == datos.destino:
        raise HTTPException(422, "Origen y destino deben ser distintos")
    viaje = dict(
        id="CONSULTA",
        origen=datos.origen,
        destino=datos.destino,
        salida_desde=datos.salida_desde,
        salida_hasta=datos.salida_hasta or datos.salida_desde,
        llegada_limite=datos.llegada_limite,
    )
    if a_minutos(viaje["salida_hasta"]) < a_minutos(viaje["salida_desde"]):
        raise HTTPException(422, "salida_hasta no puede ser anterior a salida_desde")
    if datos.criterio == "equilibrado":
        ocupacion = _ocupacion(escenario_id)
        c = consultar(esc, viaje, ocupacion)
        out = dict(
            estado=c.estado, alternativas=c.alternativas, recorrido=_recorrido(c.recorrido),
            criterio=datos.criterio, congestion=c.congestion,
            opciones=[
                dict(etiqueta=o.etiqueta, congestion=o.congestion, recorrido=_recorrido(o.recorrido))
                for o in c.opciones
            ],
        )
    else:
        c = consultar(esc, viaje)
        out = dict(estado=c.estado, alternativas=c.alternativas, recorrido=_recorrido(c.recorrido))
    out["rutas_seguras"] = rutas_distintas(candidatos(esc, viaje))
    out["salidas_evaluadas"] = len(salidas_permitidas(esc, viaje))
    if c.estado == "SIN_RUTA_SEGURA":
        out["motivo_sin_ruta"] = motivo_sin_ruta(esc, viaje)
    return out


def _evaluador_ok(esc, asignaciones: list) -> bool:
    # Runs the official evaluator on the plan shown, so the page can prove it is valid.
    with tempfile.TemporaryDirectory() as carpeta:
        archivo = Path(carpeta) / f"{esc.id}.json"
        plan = a_resultado_json(esc, asignaciones, "BiciRutas")
        archivo.write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")
        return validar_con_evaluador(esc.id, archivo)


@lru_cache(maxsize=32)
def _lote(escenario_id: str, peso: int):
    esc = _escenario(escenario_id)
    propio, base = _reparto(escenario_id, peso), referencia_lote(esc)
    return dict(
        escenario_id=esc.id,
        peso_congestion=peso,
        equipo=dict(
            metricas=metricas(esc, propio),
            asignaciones=_asignaciones(propio),
            ocupacion=_mapa_calor(esc, propio),
            evaluador_ok=_evaluador_ok(esc, propio),
        ),
        referencia=dict(
            metricas=metricas(esc, base),
            asignaciones=_asignaciones(base),
            ocupacion=_mapa_calor(esc, base),
        ),
    )


@app.get("/api/escenarios/{escenario_id}/lote")
def lote(escenario_id: str, peso: int = Query(PESO_CONGESTION, ge=1, le=100000)):
    return _lote(escenario_id, peso)


@lru_cache(maxsize=16)
def _linea_tiempo(escenario_id: str):
    esc = _escenario(escenario_id)
    inicio = a_minutos(esc.config["inicio"])
    fin = a_minutos(esc.config["fin"])
    paso = esc.config["intervalo_min"]
    horas = []
    for minuto in range(inicio, fin, paso):
        bloqueados = []
        for tid in esc.tramos:
            try:
                pasar_tramo(esc, tid, minuto)
            except RutaInvalida as exc:
                bloqueados.append(dict(tramo_id=tid, motivo=str(exc)))
        horas.append(dict(hora=a_hora(minuto), bloqueados=bloqueados))
    return dict(intervalo_min=paso, horas=horas)


@app.get("/api/escenarios/{escenario_id}/linea-tiempo")
def linea_tiempo(escenario_id: str):
    return _linea_tiempo(escenario_id)


@app.get("/api/escenarios/{escenario_id}/estado-tramos")
def estado_tramos(escenario_id: str, hora: str = Query(pattern=HORA)):
    esc = _escenario(escenario_id)
    minuto = a_minutos(hora)
    if not a_minutos(esc.config["inicio"]) <= minuto < a_minutos(esc.config["fin"]):
        raise HTTPException(422, "Hora fuera del horizonte de la simulación")
    filas = []
    for tid in esc.tramos:
        try:
            pasar_tramo(esc, tid, minuto)
            filas.append(dict(tramo_id=tid, seguro=True, motivo=None))
        except RutaInvalida as exc:
            filas.append(dict(tramo_id=tid, seguro=False, motivo=str(exc)))
    return dict(hora=hora, tramos=filas)
