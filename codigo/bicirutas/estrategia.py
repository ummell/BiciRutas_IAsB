import random

from .consulta import candidatos
from .datos import Escenario
from .lote import Asignacion, Ocupacion
from .modelo import Recorrido

# Each bike-interval of overload costs as much as 3 minutes of lateness. Chosen by sweeping
# weights 1 to 1000 with the official evaluator: 3 gives the lowest total overload in all six
# scenarios (02: 138 vs 143 with 1000; the other five are identical). The greedy search is not
# monotonic in this weight, so a larger weight does not always mean less overload.
PESO_CONGESTION = 3


def _puntaje(ocupacion: Ocupacion, r: Recorrido, peso_congestion: int) -> tuple:
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

    for v in orden:
        cand = opciones[v["id"]]
        if not cand:
            asignaciones[v["id"]] = Asignacion(v["id"], None)
            continue
        elegido = _mejor(ocupacion, cand, peso_congestion)
        ocupacion.agregar(elegido)
        asignaciones[v["id"]] = Asignacion(v["id"], elegido)

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
    viajes = esc.viajes
    opciones = {v["id"]: candidatos(esc, v) for v in viajes}

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
