"""Tiempo de paso, seguridad y simulación de un recorrido (reglas 1 a 3)."""
import math
from dataclasses import dataclass

from .datos import Escenario
from .tiempo import a_hora, a_minutos, solapa


class RutaInvalida(ValueError):
    """El tramo o recorrido incumple una regla de seguridad o de formato."""


@dataclass
class Paso:
    tramo_id: str
    entrada: int  # minutos desde medianoche
    salida: int


@dataclass
class Recorrido:
    viaje_id: str
    salida: int
    llegada: int
    pasos: list
    estado: str  # A_TIEMPO | TARDE
    duracion_min: int
    tardanza_min: int


def condicion_vigente(esc: Escenario, tramo_id: str, minuto: int) -> dict:
    """Condición cuyo intervalo [inicio, fin) contiene el minuto de entrada."""
    filas = [
        c
        for c in esc.condiciones[tramo_id]
        if a_minutos(c["inicio"]) <= minuto < a_minutos(c["fin"])
    ]
    if len(filas) != 1:
        raise RutaInvalida(f"Sin condición única: {tramo_id} {a_hora(minuto)}")
    return filas[0]


def duracion_tramo(esc: Escenario, tramo_id: str, entrada: int) -> int:
    """ceil(base x factor x (1 + coef x carga_inicial / capacidad))."""
    t = esc.tramos[tramo_id]
    c = condicion_vigente(esc, tramo_id, entrada)
    coef = esc.config["coeficiente_carga_inicial"]
    return math.ceil(
        t["tiempo_base_min"]
        * c["factor_vehicular"]
        * (1 + coef * c["carga_inicial_bicis"] / t["capacidad_bicis"])
    )


def pasar_tramo(esc: Escenario, tramo_id: str, entrada: int) -> int:
    """Devuelve el minuto de salida del tramo o lanza RutaInvalida si no es seguro."""
    cfg = esc.config
    fin_horizonte = a_minutos(cfg["fin"])
    if entrada >= fin_horizonte:
        raise RutaInvalida(f"Paso fuera del horizonte: {tramo_id}")

    salida = entrada + duracion_tramo(esc, tramo_id, entrada)
    if salida > fin_horizonte:
        raise RutaInvalida(f"Llegada fuera del horizonte: {tramo_id}")

    t = esc.tramos[tramo_id]
    if not t["habilitado_bicicletas"]:
        raise RutaInvalida(f"Tramo no habilitado: {tramo_id}")
    if not t["iluminado"] and solapa(
        entrada, salida, a_minutos(cfg["inicio_noche"]), a_minutos(cfg["fin_noche"])
    ):
        raise RutaInvalida(f"Sin iluminación nocturna: {tramo_id}")
    for r in esc.restricciones[tramo_id]:
        if solapa(entrada, salida, a_minutos(r["inicio"]), a_minutos(r["fin"])):
            raise RutaInvalida(f"Restricción {r['motivo']}: {tramo_id}")
    return salida


def simular_recorrido(esc: Escenario, viaje: dict, salida: int, tramos: list) -> Recorrido:
    """Valida y calcula un recorrido completo. Lanza RutaInvalida si incumple algo."""
    cfg = esc.config
    inicio = a_minutos(cfg["inicio"])
    if not a_minutos(viaje["salida_desde"]) <= salida <= a_minutos(viaje["salida_hasta"]):
        raise RutaInvalida("Salida fuera de ventana")
    if salida < inicio or (salida - inicio) % cfg["intervalo_min"]:
        raise RutaInvalida("Salida fuera de grilla")
    if not tramos:
        raise RutaInvalida("Ruta vacía")

    actual, visitados, pasos, t = viaje["origen"], {viaje["origen"]}, [], salida
    for tid in tramos:
        if tid not in esc.tramos:
            raise RutaInvalida(f"Tramo desconocido: {tid}")
        e = esc.tramos[tid]
        if e["origen"] != actual:
            raise RutaInvalida(f"Ruta discontinua o sentido incorrecto: {tid}")
        if e["destino"] in visitados:
            raise RutaInvalida("Ciclo no permitido")
        fin = pasar_tramo(esc, tid, t)
        pasos.append(Paso(tid, t, fin))
        t, actual = fin, e["destino"]
        visitados.add(actual)
    if actual != viaje["destino"]:
        raise RutaInvalida("No termina en destino")

    limite = a_minutos(viaje["llegada_limite"])
    return Recorrido(
        viaje_id=viaje["id"],
        salida=salida,
        llegada=t,
        pasos=pasos,
        estado="A_TIEMPO" if t <= limite else "TARDE",
        duracion_min=t - salida,
        tardanza_min=max(0, t - limite),
    )
