"""Estrategia de reparto: greedy por costo marginal y mejora local.

Idea: cada recomendación cambia la carga que verán los demás viajes. En vez de dar
a todos la ruta más corta, se asigna cada viaje al (ruta, salida) seguro que menos
sobrecarga agrega dado lo ya asignado, y luego se reconsidera cada viaje con el resto
fijo hasta que ya no hay mejora.

Garantías (las reglas del reto no se negocian):
- Solo se usan candidatos seguros y dentro de la ventana de salida.
- Si un viaje tiene ruta segura se le asigna una, aunque llegue tarde.
- SIN_RUTA_SEGURA solo cuando no existe ningún candidato seguro.
"""
import random

from .consulta import candidatos
from .datos import Escenario
from .lote import Asignacion, Ocupacion
from .modelo import Recorrido

# Con este peso la congestión manda y la tardanza solo desempata (orden lexicográfico).
PESO_CONGESTION = 1000


def _puntaje(ocupacion: Ocupacion, r: Recorrido, peso_congestion: int) -> tuple:
    """Menor es mejor: congestión ponderada + minutos tarde; luego duración y desempates."""
    costo = ocupacion.costo_marginal(r) * peso_congestion + r.tardanza_min
    return (costo, r.duracion_min, r.salida, [p.tramo_id for p in r.pasos])


def _mejor(ocupacion: Ocupacion, opciones: list, peso_congestion: int) -> Recorrido:
    return min(opciones, key=lambda r: _puntaje(ocupacion, r, peso_congestion))


def _objetivo(asignaciones: dict, ocupacion: Ocupacion) -> tuple:
    tardanza = sum(a.recorrido.tardanza_min for a in asignaciones.values() if a.recorrido)
    return (ocupacion.sobrecarga_total, tardanza)


def _una_corrida(esc, viajes, opciones, orden, peso_congestion, pasadas) -> tuple:
    ocupacion = Ocupacion(esc)
    asignaciones: dict = {}

    # 1. Greedy: cada viaje elige con la carga que dejaron los anteriores.
    for v in orden:
        cand = opciones[v["id"]]
        if not cand:
            asignaciones[v["id"]] = Asignacion(v["id"], None)
            continue
        elegido = _mejor(ocupacion, cand, peso_congestion)
        ocupacion.agregar(elegido)
        asignaciones[v["id"]] = Asignacion(v["id"], elegido)

    # 2. Mejora local: sacar un viaje, volver a elegir con el resto fijo.
    for _ in range(pasadas):
        antes = _objetivo(asignaciones, ocupacion)
        for v in orden:
            actual = asignaciones[v["id"]].recorrido
            if actual is None:
                continue
            ocupacion.quitar(actual)
            elegido = _mejor(ocupacion, opciones[v["id"]], peso_congestion)
            ocupacion.agregar(elegido)
            asignaciones[v["id"]] = Asignacion(v["id"], elegido)
        if _objetivo(asignaciones, ocupacion) >= antes:
            break

    return _objetivo(asignaciones, ocupacion), asignaciones


def repartir(
    esc: Escenario,
    peso_congestion: int = PESO_CONGESTION,
    pasadas: int = 10,
    reinicios: int = 8,
    semilla: int = 2026,
) -> list:
    """Reparte el lote del escenario y devuelve una Asignacion por viaje (orden original).

    Prueba el orden de menos a más opciones y `reinicios` órdenes al azar con semilla
    fija (resultado reproducible), y se queda con el de menor (sobrecarga, tardanza).
    """
    viajes = esc.viajes
    opciones = {v["id"]: candidatos(esc, v) for v in viajes}

    # Los viajes más restringidos eligen primero; así no pierden sus pocas opciones.
    ordenes = [sorted(viajes, key=lambda v: (len(opciones[v["id"]]), v["orden"]))]
    azar = random.Random(semilla)
    for _ in range(reinicios):
        barajado = list(viajes)
        azar.shuffle(barajado)
        ordenes.append(barajado)

    mejor = None
    for orden in ordenes:
        objetivo, asignaciones = _una_corrida(esc, viajes, opciones, orden, peso_congestion, pasadas)
        if mejor is None or objetivo < mejor[0]:
            mejor = (objetivo, asignaciones)
    return [mejor[1][v["id"]] for v in viajes]
