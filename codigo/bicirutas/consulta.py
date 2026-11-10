"""Consulta de un viaje: rutas candidatas, salidas permitidas y estado."""
from dataclasses import dataclass

import networkx as nx

from .datos import Escenario
from .modelo import Recorrido, RutaInvalida, simular_recorrido
from .tiempo import a_minutos


def rutas_simples(esc: Escenario, origen: str, destino: str) -> list:
    """Todas las rutas sin ciclos entre dos nodos, como listas de ids de tramo."""
    clave = (origen, destino)
    if clave not in esc.cache_rutas:
        esc.cache_rutas[clave] = [
            [tid for _, _, tid in camino]
            for camino in nx.all_simple_edge_paths(esc.grafo, origen, destino)
        ]
    return esc.cache_rutas[clave]


def salidas_permitidas(esc: Escenario, viaje: dict) -> range:
    """Salidas candidatas: grilla de 5 min dentro de la ventana, extremos incluidos."""
    paso = esc.config["intervalo_min"]
    return range(a_minutos(viaje["salida_desde"]), a_minutos(viaje["salida_hasta"]) + 1, paso)


def candidatos(esc: Escenario, viaje: dict) -> list[Recorrido]:
    """Todos los recorridos seguros (ruta y salida) del viaje.

    Orden estable: menor duración, salida más temprana y luego lista de tramos.
    """
    seguros = []
    for tramos in rutas_simples(esc, viaje["origen"], viaje["destino"]):
        for salida in salidas_permitidas(esc, viaje):
            try:
                seguros.append(simular_recorrido(esc, viaje, salida, tramos))
            except RutaInvalida:
                continue
    seguros.sort(key=lambda r: (r.duracion_min, r.salida, [p.tramo_id for p in r.pasos]))
    return seguros


def mejor_individual(esc: Escenario, viaje: dict) -> Recorrido | None:
    """Menor duración segura sin mirar a los demás viajes (criterio de la referencia)."""
    seguros = candidatos(esc, viaje)
    return seguros[0] if seguros else None


@dataclass
class Consulta:
    estado: str  # A_TIEMPO | TARDE | SIN_RUTA_SEGURA
    recorrido: Recorrido | None
    alternativas: int  # cuántos (ruta, salida) seguros existen


def consultar(esc: Escenario, viaje: dict) -> Consulta:
    """Recomendación para una consulta suelta.

    Si hay opciones a tiempo, la de menor duración. Si todas llegan tarde, la que
    llega antes. Sin opciones seguras en toda la ventana: SIN_RUTA_SEGURA.
    """
    seguros = candidatos(esc, viaje)
    if not seguros:
        return Consulta("SIN_RUTA_SEGURA", None, 0)
    a_tiempo = [r for r in seguros if r.estado == "A_TIEMPO"]
    if a_tiempo:
        return Consulta("A_TIEMPO", a_tiempo[0], len(seguros))
    llega_antes = min(seguros, key=lambda r: (r.llegada, r.duracion_min, r.salida))
    return Consulta("TARDE", llega_antes, len(seguros))


def consultar_libre(
    esc: Escenario,
    origen: str,
    destino: str,
    salida_desde: str,
    llegada_limite: str,
    salida_hasta: str | None = None,
) -> Consulta:
    """Consulta del formulario: sin `salida_hasta` se sale exactamente a `salida_desde`."""
    viaje = {
        "id": "CONSULTA",
        "origen": origen,
        "destino": destino,
        "salida_desde": salida_desde,
        "salida_hasta": salida_hasta or salida_desde,
        "llegada_limite": llegada_limite,
    }
    return consultar(esc, viaje)
