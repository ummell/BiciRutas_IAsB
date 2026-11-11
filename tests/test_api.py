import pytest
from fastapi.testclient import TestClient

from api.main import app

cliente = TestClient(app)


def test_salud_y_escenarios():
    assert cliente.get("/api/salud").json() == {"estado": "ok"}
    ids = [e["id"] for e in cliente.get("/api/escenarios").json()]
    assert len(ids) == 6 and ids[0] == "01_viaje_normal"


def test_red_trae_nodos_tramos_y_restricciones():
    r = cliente.get("/api/escenarios/04_recorrido_nocturno/red").json()
    assert len(r["nodos"]) == 16 and len(r["tramos"]) == 28
    assert {x["tramo_id"] for x in r["restricciones"]} >= {"T18", "T27", "T28"}


def test_consulta_ejemplo_manual():
    r = cliente.post(
        "/api/escenarios/01_viaje_normal/consulta",
        json={"origen": "N01", "destino": "N05", "salida_desde": "17:00", "llegada_limite": "17:35"},
    ).json()
    assert r["estado"] == "A_TIEMPO"
    assert r["recorrido"]["salida"] == "17:00"
    assert r["recorrido"]["pasos"][0]["tramo_id"] == "T01"


def test_consulta_sin_ruta_segura():
    r = cliente.post(
        "/api/escenarios/05_destino_sin_acceso/consulta",
        json={"origen": "N01", "destino": "N16", "salida_desde": "17:00", "llegada_limite": "18:00"},
    ).json()
    assert r["estado"] == "SIN_RUTA_SEGURA" and r["recorrido"] is None


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"origen": "N01", "destino": "N01", "salida_desde": "17:00", "llegada_limite": "18:00"},
        {"origen": "N01", "destino": "N99", "salida_desde": "17:00", "llegada_limite": "18:00"},
        {"origen": "N01", "destino": "N05", "salida_desde": "25:00", "llegada_limite": "18:00"},
        {"origen": "N01", "destino": "N05", "salida_desde": "17:10", "salida_hasta": "17:00",
         "llegada_limite": "18:00"},
    ],
)
def test_consulta_rechaza_entradas_invalidas(cuerpo):
    assert cliente.post("/api/escenarios/01_viaje_normal/consulta", json=cuerpo).status_code == 422


def test_escenario_desconocido_da_404():
    assert cliente.get("/api/escenarios/no_existe/red").status_code == 404


def test_lote_compara_equipo_y_referencia():
    r = cliente.get("/api/escenarios/02_demanda_concentrada/lote").json()
    assert r["referencia"]["metricas"]["sobrecarga_acumulada_bici_intervalo"] == 348
    assert r["equipo"]["metricas"]["sobrecarga_acumulada_bici_intervalo"] < 348
    assert len(r["equipo"]["asignaciones"]) == 60
    assert r["equipo"]["evaluador_ok"] is True


def test_lote_sin_rutas_tambien_pasa_el_evaluador():
    r = cliente.get("/api/escenarios/05_destino_sin_acceso/lote").json()
    assert r["equipo"]["evaluador_ok"] is True


def test_linea_tiempo_marca_cuando_cambia_la_red():
    r = cliente.get("/api/escenarios/03_cierre_temporal/linea-tiempo").json()
    assert r["intervalo_min"] == 5 and len(r["horas"]) == 72
    por_hora = {h["hora"]: {b["tramo_id"] for b in h["bloqueados"]} for h in r["horas"]}
    assert "T03" in por_hora["17:00"] and "T03" in por_hora["17:25"]
    assert "T03" not in por_hora["17:30"]
    assert {"T27", "T28"} <= por_hora["15:00"]


def test_linea_tiempo_coincide_con_estado_tramos():
    escenario = "04_recorrido_nocturno"
    r = cliente.get(f"/api/escenarios/{escenario}/linea-tiempo").json()
    for h in (r["horas"][0], r["horas"][36], r["horas"][-1]):
        puntual = cliente.get(f"/api/escenarios/{escenario}/estado-tramos", params={"hora": h["hora"]}).json()
        esperado = {t["tramo_id"] for t in puntual["tramos"] if not t["seguro"]}
        assert {b["tramo_id"] for b in h["bloqueados"]} == esperado


def test_estado_tramos_respeta_el_cierre_y_el_borde():
    def estado(hora):
        r = cliente.get("/api/escenarios/03_cierre_temporal/estado-tramos", params={"hora": hora}).json()
        return {t["tramo_id"]: t for t in r["tramos"]}

    assert estado("17:00")["T03"]["seguro"] is False
    assert estado("17:30")["T03"]["seguro"] is True
    assert estado("17:00")["T28"]["seguro"] is False
    assert cliente.get("/api/escenarios/03_cierre_temporal/estado-tramos", params={"hora": "21:00"}).status_code == 422


def test_consulta_con_criterio_equilibrado_retorna_opciones():
    r = cliente.post(
        "/api/escenarios/01_viaje_normal/consulta",
        json={
            "origen": "N01", "destino": "N05",
            "salida_desde": "17:00", "llegada_limite": "18:00",
            "criterio": "equilibrado",
        },
    ).json()
    assert r["criterio"] == "equilibrado"
    assert isinstance(r["congestion"], int)
    assert len(r["opciones"]) >= 1
    etiquetas = [o["etiqueta"] for o in r["opciones"]]
    assert etiquetas == ["recomendada", "mas_rapida", "menos_congestion"]
    for o in r["opciones"]:
        assert isinstance(o["congestion"], int)
        assert o["recorrido"]["estado"] == "A_TIEMPO"


def test_consulta_sin_criterio_retorna_sus_llaves():
    r = cliente.post(
        "/api/escenarios/01_viaje_normal/consulta",
        json={
            "origen": "N01", "destino": "N05",
            "salida_desde": "17:00", "llegada_limite": "17:35",
        },
    ).json()
    assert set(r.keys()) == {"estado", "alternativas", "recorrido", "rutas_seguras", "salidas_evaluadas"}
    assert r["estado"] == "A_TIEMPO"
    assert r["recorrido"]["pasos"][0]["tramo_id"] == "T01"


def test_consulta_con_criterio_invalido_da_422():
    r = cliente.post(
        "/api/escenarios/01_viaje_normal/consulta",
        json={
            "origen": "N01", "destino": "N05",
            "salida_desde": "17:00", "llegada_limite": "18:00",
            "criterio": "inventado",
        },
    )
    assert r.status_code == 422


@pytest.mark.parametrize(
    "escenario, origen, destino, salida, limite, motivo",
    [
        ("05_destino_sin_acceso", "N01", "N16", "17:00", "18:00", "sin_acceso"),
        ("01_viaje_normal", "N01", "N16", "20:45", "21:00", "horizonte"),
        ("04_recorrido_nocturno", "N01", "N03", "18:00", "19:00", "bloqueo"),
    ],
)
def test_consulta_sin_ruta_segura_explica_el_motivo(escenario, origen, destino, salida, limite, motivo):
    r = cliente.post(
        f"/api/escenarios/{escenario}/consulta",
        json={"origen": origen, "destino": destino, "salida_desde": salida, "llegada_limite": limite},
    ).json()
    assert r["estado"] == "SIN_RUTA_SEGURA" and r["recorrido"] is None
    assert r["motivo_sin_ruta"] == motivo


def test_consulta_equilibrada_sin_ruta_segura_explica_el_motivo():
    r = cliente.post(
        "/api/escenarios/05_destino_sin_acceso/consulta",
        json={"origen": "N01", "destino": "N16", "salida_desde": "17:00", "llegada_limite": "18:00",
              "criterio": "equilibrado"},
    ).json()
    assert r["estado"] == "SIN_RUTA_SEGURA" and r["motivo_sin_ruta"] == "sin_acceso"


def test_consulta_separa_rutas_seguras_de_horas_de_salida():
    r = cliente.post(
        "/api/escenarios/01_viaje_normal/consulta",
        json={"origen": "N01", "destino": "N05", "salida_desde": "17:00", "salida_hasta": "17:10",
              "llegada_limite": "17:30"},
    ).json()
    assert r["alternativas"] == 27
    assert r["rutas_seguras"] == 9
    assert r["salidas_evaluadas"] == 3
