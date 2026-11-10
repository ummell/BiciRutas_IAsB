import pytest
from test_modelo import ESCENARIOS, oficial

from bicirutas.datos import cargar_escenario
from bicirutas.lote import Ocupacion, a_resultado_json, construir_ocupacion, metricas, referencia_lote


@pytest.mark.parametrize("escenario", ESCENARIOS)
def test_metricas_de_la_referencia_coinciden_con_el_evaluador_oficial(escenario):
    esc = cargar_escenario(escenario)
    asignaciones = referencia_lote(esc)
    plan = a_resultado_json(esc, asignaciones, "REFERENCIA")

    oficial_eval = oficial.evaluar(oficial.cargar(escenario), plan)
    assert oficial_eval["valido"], oficial_eval.get("errores")
    assert metricas(esc, asignaciones) == oficial_eval["resumen"]

    propio = sorted(construir_ocupacion(esc, asignaciones).detalle(), key=lambda f: (f["tramo_id"], f["inicio"]))
    esperado = sorted(oficial_eval["ocupacion"], key=lambda f: (f["tramo_id"], f["inicio"]))
    assert propio == esperado


def test_ejemplo_manual_de_congestion():
    esc = cargar_escenario("01_viaje_normal")
    viaje = esc.viajes[0]
    from bicirutas.modelo import simular_recorrido
    from bicirutas.tiempo import a_minutos

    r = simular_recorrido(esc, viaje, a_minutos("17:00"), ["T01", "T02", "T03", "T04"])
    ocupacion = Ocupacion(esc)
    base = ocupacion.sobrecarga_total
    for _ in range(3):
        ocupacion.agregar(r)
    t01_1700 = next(
        f for f in ocupacion.detalle() if f["tramo_id"] == "T01" and f["inicio"] == "17:00"
    )
    assert (t01_1700["carga_total"], t01_1700["sobrecarga"]) == (4, 1)
    assert ocupacion.sobrecarga_total > base


def test_un_viaje_que_termina_justo_en_el_limite_no_ocupa_el_intervalo_siguiente():
    esc = cargar_escenario("01_viaje_normal")
    from bicirutas.modelo import simular_recorrido
    from bicirutas.tiempo import a_minutos

    viaje = dict(esc.viajes[0], destino="N02")
    r = simular_recorrido(esc, viaje, a_minutos("17:00"), ["T01"])
    pares = list(Ocupacion(esc).pares(r))
    assert pares == [("T01", a_minutos("17:00"))]


def test_agregar_y_quitar_es_reversible_y_costo_marginal_coherente():
    esc = cargar_escenario("02_demanda_concentrada")
    ocupacion = Ocupacion(esc)
    base = ocupacion.sobrecarga_total
    recorridos = [a.recorrido for a in referencia_lote(esc) if a.recorrido]
    for r in recorridos:
        antes = ocupacion.sobrecarga_total
        costo = ocupacion.costo_marginal(r)
        ocupacion.agregar(r)
        assert ocupacion.sobrecarga_total == antes + costo
    for r in reversed(recorridos):
        ocupacion.quitar(r)
    assert ocupacion.sobrecarga_total == base
    assert sum(f["sobrecarga"] for f in ocupacion.detalle()) == base
