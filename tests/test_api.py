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


def test_estado_tramos_respeta_el_cierre_y_el_borde():
    def estado(hora):
        r = cliente.get("/api/escenarios/03_cierre_temporal/estado-tramos", params={"hora": hora}).json()
        return {t["tramo_id"]: t for t in r["tramos"]}

    assert estado("17:00")["T03"]["seguro"] is False
    assert estado("17:30")["T03"]["seguro"] is True
    assert estado("17:00")["T28"]["seguro"] is False
    assert cliente.get("/api/escenarios/03_cierre_temporal/estado-tramos", params={"hora": "21:00"}).status_code == 422
