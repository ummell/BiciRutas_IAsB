"""Pruebas de la consulta de ruta y hora de salida."""
import pytest
from test_modelo import ESCENARIOS, oficial

from bicirutas.consulta import candidatos, consultar, consultar_libre, mejor_individual
from bicirutas.datos import cargar_escenario
from bicirutas.tiempo import a_hora


def test_escenario_01_primer_viaje_a_tiempo():
    esc = cargar_escenario("01_viaje_normal")
    c = consultar(esc, esc.viajes[0])
    assert c.estado == "A_TIEMPO"
    assert c.recorrido.llegada <= 17 * 60 + 35
    assert c.alternativas > 0


def test_escenario_05_todo_sin_ruta_segura():
    esc = cargar_escenario("05_destino_sin_acceso")
    assert [consultar(esc, v).estado for v in esc.viajes] == ["SIN_RUTA_SEGURA"] * 3
    assert all(consultar(esc, v).recorrido is None for v in esc.viajes)


def test_escenario_06_todo_tarde_con_ruta_segura():
    esc = cargar_escenario("06_hora_imposible")
    resultados = [consultar(esc, v) for v in esc.viajes]
    assert [c.estado for c in resultados] == ["TARDE"] * 3
    assert all(c.recorrido is not None for c in resultados)


def test_cierre_t03_no_se_usa_durante_el_cierre():
    """Escenario 03: ningún candidato cruza T03 solapado con [17:00, 17:30)."""
    esc = cargar_escenario("03_cierre_temporal")
    for viaje in esc.viajes:
        for r in candidatos(esc, viaje):
            for p in r.pasos:
                if p.tramo_id == "T03":
                    assert not (p.entrada < 17 * 60 + 30 and 17 * 60 < p.salida)


def test_consulta_libre_sale_exactamente_a_la_hora():
    esc = cargar_escenario("01_viaje_normal")
    c = consultar_libre(esc, "N01", "N05", "17:00", "17:35")
    assert (a_hora(c.recorrido.salida), c.estado) == ("17:00", "A_TIEMPO")


@pytest.mark.parametrize("escenario", ESCENARIOS)
def test_mejor_individual_coincide_con_la_referencia_oficial(escenario):
    """Salida, tramos y estado idénticos a referencia.py para todos los viajes."""
    from referencia import crear_referencia

    esc = cargar_escenario(escenario)
    esperado = {f["viaje_id"]: f for f in crear_referencia(oficial.cargar(escenario))["viajes"]}
    for viaje in esc.viajes:
        r = mejor_individual(esc, viaje)
        fila = esperado[viaje["id"]]
        if r is None:
            assert fila["estado"] == "SIN_RUTA_SEGURA", (escenario, viaje["id"])
        else:
            assert a_hora(r.salida) == fila["salida"], (escenario, viaje["id"])
            assert [p.tramo_id for p in r.pasos] == fila["tramos"], (escenario, viaje["id"])
            assert r.estado == fila["estado"], (escenario, viaje["id"])
