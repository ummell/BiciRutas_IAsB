import math
from dataclasses import dataclass, field

import networkx as nx

from .datos import Escenario
from .modelo import Recorrido, RutaInvalida, simular_recorrido
from .tiempo import a_hora, a_minutos


def rutas_simples(esc: Escenario, origen: str, destino: str) -> list:
    clave = (origen, destino)
    if clave not in esc.cache_rutas:
        esc.cache_rutas[clave] = [
            [tid for _, _, tid in camino]
            for camino in nx.all_simple_edge_paths(esc.grafo, origen, destino)
        ]
    return esc.cache_rutas[clave]


def salidas_permitidas(esc: Escenario, viaje: dict) -> range:
    paso = esc.config["intervalo_min"]
    return range(a_minutos(viaje["salida_desde"]), a_minutos(viaje["salida_hasta"]) + 1, paso)


def candidatos(esc: Escenario, viaje: dict) -> list[Recorrido]:
    seguros = []
    for tramos in rutas_simples(esc, viaje["origen"], viaje["destino"]):
        for salida in salidas_permitidas(esc, viaje):
            try:
                seguros.append(simular_recorrido(esc, viaje, salida, tramos))
            except RutaInvalida:
                continue
    seguros.sort(key=lambda r: (r.duracion_min, r.salida, [p.tramo_id for p in r.pasos]))
    return seguros


def motivo_sin_ruta(esc: Escenario, viaje: dict) -> str:
    for tramos in rutas_simples(esc, viaje["origen"], viaje["destino"]):
        for salida in salidas_permitidas(esc, viaje):
            try:
                simular_recorrido(esc, viaje, salida, tramos)
            except RutaInvalida as e:
                if "horizonte" in str(e):
                    return "horizonte"
    paso = esc.config["intervalo_min"]
    todo_el_dia = dict(
        viaje,
        salida_desde=esc.config["inicio"],
        salida_hasta=a_hora(a_minutos(esc.config["fin"]) - paso),
        llegada_limite=esc.config["fin"],
    )
    return "bloqueo" if candidatos(esc, todo_el_dia) else "sin_acceso"


def rutas_distintas(recorridos: list[Recorrido]) -> int:
    return len({tuple(p.tramo_id for p in r.pasos) for r in recorridos})


def mejor_individual(esc: Escenario, viaje: dict) -> Recorrido | None:
    seguros = candidatos(esc, viaje)
    return seguros[0] if seguros else None


@dataclass
class Opcion:
    etiqueta: str
    recorrido: Recorrido
    congestion: int


@dataclass
class Consulta:
    estado: str
    recorrido: Recorrido | None
    alternativas: int
    opciones: list = field(default_factory=list)
    congestion: int | None = None


def consultar(esc: Escenario, viaje: dict, ocupacion=None) -> Consulta:
    seguros = candidatos(esc, viaje)
    if not seguros:
        return Consulta("SIN_RUTA_SEGURA", None, 0)
    a_tiempo = [r for r in seguros if r.estado == "A_TIEMPO"]

    if ocupacion is None:
        if a_tiempo:
            return Consulta("A_TIEMPO", a_tiempo[0], len(seguros))
        llega_antes = min(seguros, key=lambda r: (r.llegada, r.duracion_min, r.salida))
        return Consulta("TARDE", llega_antes, len(seguros))

    if a_tiempo:
        d0 = a_tiempo[0].duracion_min
        margen = d0 + max(8, math.ceil(0.5 * d0))
        dentro_margen = [r for r in a_tiempo if r.duracion_min <= margen]
        recomendada = min(
            dentro_margen,
            key=lambda r: (ocupacion.costo_marginal(r), r.duracion_min, r.salida, [p.tramo_id for p in r.pasos]),
        )
        mas_rapida = a_tiempo[0]
        menos_congestion = min(
            a_tiempo,
            key=lambda r: (ocupacion.costo_marginal(r), r.duracion_min, r.salida, [p.tramo_id for p in r.pasos]),
        )
        opciones = []
        visto = set()
        for etiqueta, r in [
            ("recomendada", recomendada),
            ("mas_rapida", mas_rapida),
            ("menos_congestion", menos_congestion),
        ]:
            key = tuple(p.tramo_id for p in r.pasos)
            if key not in visto:
                visto.add(key)
                opciones.append(Opcion(etiqueta, r, ocupacion.costo_marginal(r)))
        return Consulta(
            "A_TIEMPO", recomendada, len(seguros),
            opciones=opciones, congestion=ocupacion.costo_marginal(recomendada),
        )

    llega_antes = min(seguros, key=lambda r: (r.llegada, r.duracion_min, r.salida))
    return Consulta(
        "TARDE", llega_antes, len(seguros),
        opciones=[Opcion("recomendada", llega_antes, ocupacion.costo_marginal(llega_antes))],
        congestion=ocupacion.costo_marginal(llega_antes),
    )


def consultar_libre(
    esc: Escenario,
    origen: str,
    destino: str,
    salida_desde: str,
    llegada_limite: str,
    salida_hasta: str | None = None,
) -> Consulta:
    viaje = {
        "id": "CONSULTA",
        "origen": origen,
        "destino": destino,
        "salida_desde": salida_desde,
        "salida_hasta": salida_hasta or salida_desde,
        "llegada_limite": llegada_limite,
    }
    return consultar(esc, viaje)
