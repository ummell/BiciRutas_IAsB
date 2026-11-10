import pytest
from test_modelo import ESCENARIOS, oficial

from bicirutas.datos import cargar_escenario
from bicirutas.estrategia import repartir
from bicirutas.lote import a_resultado_json, metricas, referencia_lote


@pytest.fixture(scope="module")
def repartos():
    salida = {}
    for escenario in ESCENARIOS:
        esc = cargar_escenario(escenario)
        salida[escenario] = (esc, repartir(esc), referencia_lote(esc))
    return salida


@pytest.mark.parametrize("escenario", ESCENARIOS)
def test_el_resultado_es_valido_para_el_evaluador_oficial(repartos, escenario):
    esc, asignaciones, _ = repartos[escenario]
    plan = a_resultado_json(esc, asignaciones, "Mi equipo")
    evaluacion = oficial.evaluar(oficial.cargar(escenario), plan)
    assert evaluacion["valido"], evaluacion.get("errores")
    assert metricas(esc, asignaciones) == evaluacion["resumen"]


@pytest.mark.parametrize("escenario", ESCENARIOS)
def test_no_empeora_la_congestion_ni_descarta_viajes(repartos, escenario):
    esc, asignaciones, referencia = repartos[escenario]
    propio, base = metricas(esc, asignaciones), metricas(esc, referencia)
    assert propio["sobrecarga_acumulada_bici_intervalo"] <= base["sobrecarga_acumulada_bici_intervalo"]
    assert propio["viajes_sin_ruta_segura"] == base["viajes_sin_ruta_segura"]
    assert len(asignaciones) == len(esc.viajes)


def test_reduce_la_sobrecarga_en_la_demanda_concentrada(repartos):
    esc, asignaciones, referencia = repartos["02_demanda_concentrada"]
    propio = metricas(esc, asignaciones)["sobrecarga_acumulada_bici_intervalo"]
    base = metricas(esc, referencia)["sobrecarga_acumulada_bici_intervalo"]
    assert propio < base


def test_los_viajes_respetan_su_ventana_de_salida(repartos):
    from bicirutas.tiempo import a_minutos

    esc, asignaciones, _ = repartos["02_demanda_concentrada"]
    por_id = {v["id"]: v for v in esc.viajes}
    for a in asignaciones:
        if a.recorrido:
            v = por_id[a.viaje_id]
            assert a_minutos(v["salida_desde"]) <= a.recorrido.salida <= a_minutos(v["salida_hasta"])


def test_es_reproducible():
    esc = cargar_escenario("02_demanda_concentrada")
    a = a_resultado_json(esc, repartir(esc), "x")
    b = a_resultado_json(esc, repartir(esc), "x")
    assert a == b
