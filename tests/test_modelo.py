"""Pruebas del modelo base: ejemplos manuales de la documentación y bordes."""
import sys

import pytest

from bicirutas.datos import cargar_escenario, carpeta_paquete
from bicirutas.modelo import RutaInvalida, pasar_tramo, simular_recorrido
from bicirutas.tiempo import a_hora, a_minutos, solapa

# Oráculo: el modelo oficial del paquete, solo para contrastar (no se importa en el código).
sys.path.insert(0, str(carpeta_paquete() / "herramientas"))
import modelo as oficial  # noqa: E402

ESCENARIOS = [
    "01_viaje_normal",
    "02_demanda_concentrada",
    "03_cierre_temporal",
    "04_recorrido_nocturno",
    "05_destino_sin_acceso",
    "06_hora_imposible",
]


def test_intervalos_excluyen_el_final():
    assert not solapa(10, 20, 20, 30)
    assert solapa(10, 21, 20, 30)
    assert a_hora(a_minutos("17:05")) == "17:05"


def test_ejemplo_manual_escenario_01():
    """N01 -> N05 saliendo 17:00 por T01-T04: cada tramo dura 3, llega 17:12 a tiempo."""
    esc = cargar_escenario("01_viaje_normal")
    viaje = esc.viajes[0]
    r = simular_recorrido(esc, viaje, a_minutos("17:00"), ["T01", "T02", "T03", "T04"])
    assert [(a_hora(p.entrada), a_hora(p.salida)) for p in r.pasos] == [
        ("17:00", "17:03"),
        ("17:03", "17:06"),
        ("17:06", "17:09"),
        ("17:09", "17:12"),
    ]
    assert (a_hora(r.llegada), r.duracion_min, r.estado) == ("17:12", 12, "A_TIEMPO")


def test_cierre_temporal_t03_en_el_borde():
    esc = cargar_escenario("03_cierre_temporal")
    with pytest.raises(RutaInvalida):
        pasar_tramo(esc, "T03", a_minutos("17:27"))  # termina 17:30+, se solapa
    assert pasar_tramo(esc, "T03", a_minutos("17:30")) > a_minutos("17:30")


def test_tramo_sin_iluminacion_en_el_borde_de_la_noche():
    esc = cargar_escenario("04_recorrido_nocturno")
    assert pasar_tramo(esc, "T02", a_minutos("17:57")) == a_minutos("18:00")
    with pytest.raises(RutaInvalida):
        pasar_tramo(esc, "T02", a_minutos("17:58"))


@pytest.mark.parametrize("tramo", ["T27", "T28"])
def test_tramos_prohibidos_en_cualquier_hora(tramo):
    esc = cargar_escenario("03_cierre_temporal")
    for minuto in range(a_minutos("15:00"), a_minutos("21:00"), 5):
        with pytest.raises(RutaInvalida):
            pasar_tramo(esc, tramo, minuto)


def test_llegada_igual_al_limite_es_a_tiempo():
    esc = cargar_escenario("01_viaje_normal")
    viaje = dict(esc.viajes[0], llegada_limite="17:12")
    r = simular_recorrido(esc, viaje, a_minutos("17:00"), ["T01", "T02", "T03", "T04"])
    assert r.estado == "A_TIEMPO"


def test_no_se_puede_invertir_un_tramo_sin_fila_opuesta():
    esc = cargar_escenario("01_viaje_normal")
    viaje = dict(esc.viajes[0], origen="N02", destino="N01")
    with pytest.raises(RutaInvalida):
        simular_recorrido(esc, viaje, a_minutos("17:00"), ["T01"])


@pytest.mark.parametrize("escenario", ESCENARIOS)
def test_coincide_con_el_modelo_oficial(escenario):
    """Para cada tramo y cada minuto del horizonte, resultado idéntico al oficial."""
    esc = cargar_escenario(escenario)
    d = oficial.cargar(escenario)
    for tid in esc.tramos:
        for minuto in range(a_minutos("15:00"), a_minutos("21:00")):
            try:
                esperado = oficial.paso(d, tid, minuto)
            except ValueError:
                esperado = None
            try:
                obtenido = pasar_tramo(esc, tid, minuto)
            except RutaInvalida:
                obtenido = None
            assert obtenido == esperado, (escenario, tid, a_hora(minuto))
