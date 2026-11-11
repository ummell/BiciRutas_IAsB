import math

import pytest
from test_modelo import ESCENARIOS, oficial

from bicirutas.consulta import candidatos, consultar, consultar_libre, mejor_individual
from bicirutas.datos import cargar_escenario
from bicirutas.estrategia import repartir
from bicirutas.lote import construir_ocupacion
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


def test_consulta_equilibrada_elige_menor_congestion_dentro_del_margen():
    esc = cargar_escenario("01_viaje_normal")
    viaje = dict(
        id="CONSULTA",
        origen="N01",
        destino="N05",
        salida_desde="17:00",
        salida_hasta="17:00",
        llegada_limite="18:00",
    )
    asignaciones = repartir(esc)
    ocupacion = construir_ocupacion(esc, asignaciones)
    c = consultar(esc, viaje, ocupacion)
    assert c.estado == "A_TIEMPO"
    assert [p.tramo_id for p in c.recorrido.pasos] == ["T13", "T05", "T06", "T18", "T03", "T04"]
    assert c.recorrido.duracion_min == 20
    etiquetas = [o.etiqueta for o in c.opciones]
    assert etiquetas == ["recomendada", "mas_rapida", "menos_congestion"]
    mas_rapida = next(o for o in c.opciones if o.etiqueta == "mas_rapida")
    assert [p.tramo_id for p in mas_rapida.recorrido.pasos] == ["T01", "T02", "T03", "T04"]
    menos = next(o for o in c.opciones if o.etiqueta == "menos_congestion")
    assert [p.tramo_id for p in menos.recorrido.pasos] == ["T13", "T05", "T06", "T07", "T08", "T22"]
    assert all(isinstance(o.congestion, int) for o in c.opciones)
    assert isinstance(c.congestion, int)


@pytest.mark.parametrize("escenario_id", ESCENARIOS)
def test_consulta_equilibrada_nunca_elige_tarde_ni_fuera_del_margen(escenario_id):
    esc = cargar_escenario(escenario_id)
    asignaciones = repartir(esc)
    ocupacion = construir_ocupacion(esc, asignaciones)
    for viaje in esc.viajes:
        c = consultar(esc, viaje, ocupacion)
        a_tiempo = [r for r in candidatos(esc, viaje) if r.estado == "A_TIEMPO"]
        if a_tiempo:
            d0 = a_tiempo[0].duracion_min
            margen = d0 + max(8, math.ceil(0.5 * d0))
            assert c.estado == "A_TIEMPO", f"{escenario_id} {viaje['id']}: esperado A_TIEMPO, fue {c.estado}"
            assert c.recorrido.duracion_min <= margen, (
                f"{escenario_id} {viaje['id']}: duracion {c.recorrido.duracion_min} > margen {margen}"
            )
        ids_candidatos = {tuple(p.tramo_id for p in r.pasos) for r in candidatos(esc, viaje)}
        assert c.recorrido is not None or c.estado == "SIN_RUTA_SEGURA"
        if c.recorrido is not None:
            key = tuple(p.tramo_id for p in c.recorrido.pasos)
            assert key in ids_candidatos, (
                f"{escenario_id} {viaje['id']}: recorrido elegido no está en candidatos"
            )


@pytest.mark.parametrize("escenario", ESCENARIOS)
def test_mejor_individual_coincide_con_la_referencia_oficial(escenario):
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


def test_motivo_sin_ruta_distingue_horizonte_bloqueo_y_sin_acceso():
    from bicirutas.consulta import motivo_sin_ruta

    def viaje(o, d, s, l):
        return dict(id="X", origen=o, destino=d, salida_desde=s, salida_hasta=s, llegada_limite=l)

    assert motivo_sin_ruta(cargar_escenario("05_destino_sin_acceso"), viaje("N01", "N16", "17:00", "18:00")) == "sin_acceso"
    assert motivo_sin_ruta(cargar_escenario("01_viaje_normal"), viaje("N01", "N16", "20:45", "21:00")) == "horizonte"
    assert motivo_sin_ruta(cargar_escenario("04_recorrido_nocturno"), viaje("N01", "N03", "18:00", "19:00")) == "bloqueo"
