"""Lote: ocupación por tramo e intervalo, sobrecarga y métricas (regla 4)."""
from collections import defaultdict
from dataclasses import dataclass

from .consulta import mejor_individual
from .datos import Escenario
from .modelo import Recorrido, condicion_vigente
from .tiempo import a_hora, a_minutos


@dataclass
class Asignacion:
    """Decisión sobre un viaje: un recorrido seguro o None (SIN_RUTA_SEGURA)."""

    viaje_id: str
    recorrido: Recorrido | None

    @property
    def estado(self) -> str:
        return self.recorrido.estado if self.recorrido else "SIN_RUTA_SEGURA"


class Ocupacion:
    """Viajes asignados por (tramo, intervalo de 5 min) y su sobrecarga acumulada.

    La carga inicial y la capacidad vienen del escenario; la sobrecarga de un par es
    max(0, inicial + asignada - capacidad) y el indicador es la suma de todos los pares.
    """

    def __init__(self, esc: Escenario):
        self.esc = esc
        self.inicio = a_minutos(esc.config["inicio"])
        self.fin = a_minutos(esc.config["fin"])
        self.dt = esc.config["intervalo_min"]
        self.asignada: dict = defaultdict(int)
        self.inicial: dict = {}
        self.capacidad = {tid: t["capacidad_bicis"] for tid, t in esc.tramos.items()}
        for tid in esc.tramos:
            for t in range(self.inicio, self.fin, self.dt):
                self.inicial[(tid, t)] = condicion_vigente(esc, tid, t)["carga_inicial_bicis"]
        self.sobrecarga_total = sum(
            max(0, self.inicial[(tid, t)] - self.capacidad[tid]) for tid, t in self.inicial
        )

    def pares(self, recorrido: Recorrido):
        """Pares (tramo, inicio de intervalo) que toca el recorrido, uno por paso e intervalo."""
        for p in recorrido.pasos:
            t = self.inicio + ((p.entrada - self.inicio) // self.dt) * self.dt
            while t < p.salida:
                yield (p.tramo_id, t)
                t += self.dt

    def _sobrecarga(self, par, asignada: int) -> int:
        return max(0, self.inicial[par] + asignada - self.capacidad[par[0]])

    def costo_marginal(self, recorrido: Recorrido) -> int:
        """Cuánto subiría la sobrecarga total si se agrega el recorrido (sin agregarlo)."""
        return sum(
            self._sobrecarga(par, self.asignada[par] + 1) - self._sobrecarga(par, self.asignada[par])
            for par in self.pares(recorrido)
        )

    def agregar(self, recorrido: Recorrido) -> None:
        self.sobrecarga_total += self.costo_marginal(recorrido)
        for par in self.pares(recorrido):
            self.asignada[par] += 1

    def quitar(self, recorrido: Recorrido) -> None:
        for par in self.pares(recorrido):
            self.sobrecarga_total += self._sobrecarga(par, self.asignada[par] - 1) - self._sobrecarga(
                par, self.asignada[par]
            )
            self.asignada[par] -= 1

    def detalle(self) -> list:
        """Una fila por par tramo/intervalo, con el mismo contenido que el evaluador oficial."""
        filas = []
        for (tid, t), inicial in self.inicial.items():
            n = self.asignada[(tid, t)]
            cap = self.capacidad[tid]
            filas.append(
                dict(
                    tramo_id=tid,
                    inicio=a_hora(t),
                    fin=a_hora(t + self.dt),
                    carga_inicial=inicial,
                    carga_asignada=n,
                    carga_total=inicial + n,
                    capacidad=cap,
                    sobrecarga=max(0, inicial + n - cap),
                )
            )
        return filas


def construir_ocupacion(esc: Escenario, asignaciones: list) -> Ocupacion:
    ocupacion = Ocupacion(esc)
    for a in asignaciones:
        if a.recorrido:
            ocupacion.agregar(a.recorrido)
    return ocupacion


def metricas(esc: Escenario, asignaciones: list) -> dict:
    """Mismos indicadores que el resumen del evaluador oficial."""
    ocupacion = construir_ocupacion(esc, asignaciones)
    filas = ocupacion.detalle()
    con_ruta = [a.recorrido for a in asignaciones if a.recorrido]
    return dict(
        sobrecarga_acumulada_bici_intervalo=sum(f["sobrecarga"] for f in filas),
        pares_saturados=sum(f["sobrecarga"] > 0 for f in filas),
        maxima_relacion_carga_capacidad=round(max(f["carga_total"] / f["capacidad"] for f in filas), 4),
        minutos_totales_viaje=sum(r.duracion_min for r in con_ruta),
        minutos_totales_tardanza=sum(r.tardanza_min for r in con_ruta),
        viajes_a_tiempo=sum(a.estado == "A_TIEMPO" for a in asignaciones),
        viajes_tarde=sum(a.estado == "TARDE" for a in asignaciones),
        viajes_sin_ruta_segura=sum(a.estado == "SIN_RUTA_SEGURA" for a in asignaciones),
    )


def referencia_lote(esc: Escenario) -> list:
    """Cada viaje por su cuenta, con la menor duración segura (sin repartir demanda)."""
    return [Asignacion(v["id"], mejor_individual(esc, v)) for v in esc.viajes]


def a_resultado_json(esc: Escenario, asignaciones: list, equipo: str) -> dict:
    """Resultado en el formato de entrega del diccionario de datos."""
    filas = []
    for a in asignaciones:
        if a.recorrido is None:
            filas.append(dict(viaje_id=a.viaje_id, salida=None, tramos=[], estado="SIN_RUTA_SEGURA"))
        else:
            filas.append(
                dict(
                    viaje_id=a.viaje_id,
                    salida=a_hora(a.recorrido.salida),
                    tramos=[p.tramo_id for p in a.recorrido.pasos],
                    estado=a.recorrido.estado,
                )
            )
    return dict(escenario_id=esc.id, equipo=equipo, viajes=filas)
