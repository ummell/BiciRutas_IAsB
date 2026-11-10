"""Carga de la red y de los escenarios (solo JSON, que es la fuente canónica)."""
import json
import os
from dataclasses import dataclass, field
from pathlib import Path

import networkx as nx
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Escenario:
    id: str
    config: dict
    tramos: dict  # id de tramo -> fila de tramos.json
    condiciones: dict  # id de tramo -> lista de condiciones
    restricciones: dict  # id de tramo -> lista de restricciones
    viajes: list
    grafo: nx.MultiDiGraph
    nodos: list  # filas de nodos.json (id, nombre, x, y)
    # Rutas simples ya enumeradas por (origen, destino); se llena en consulta.py
    cache_rutas: dict = field(default_factory=dict)


def carpeta_paquete() -> Path:
    """Carpeta del paquete BiciRutas, definida en .env (BICIRUTAS_PAQUETE)."""
    return Path(os.environ.get("BICIRUTAS_PAQUETE", "../gestion")).resolve()


def _leer(ruta: Path):
    return json.loads(ruta.read_text(encoding="utf-8"))


def construir_grafo(nodos: list, tramos: dict) -> nx.MultiDiGraph:
    """Grafo dirigido: una arista por tramo, con el id del tramo como clave."""
    g = nx.MultiDiGraph()
    for n in nodos:
        g.add_node(n["id"], nombre=n["nombre"], x=n["x"], y=n["y"])
    for tid, t in tramos.items():
        g.add_edge(t["origen"], t["destino"], key=tid)
    return g


def cargar_escenario(escenario_id: str, paquete: Path | None = None) -> Escenario:
    base = paquete or carpeta_paquete()
    ids = {e["id"] for e in _leer(base / "escenarios" / "indice.json")}
    if escenario_id not in ids:
        raise ValueError(f"Escenario desconocido: {escenario_id}")

    carpeta = base / "escenarios" / escenario_id
    nodos = _leer(base / "datos" / "nodos.json")
    tramos = {t["id"]: t for t in _leer(base / "datos" / "tramos.json")}

    condiciones: dict = {tid: [] for tid in tramos}
    for c in _leer(carpeta / "condiciones.json"):
        condiciones[c["tramo_id"]].append(c)
    restricciones: dict = {tid: [] for tid in tramos}
    for r in _leer(carpeta / "restricciones.json"):
        restricciones[r["tramo_id"]].append(r)

    return Escenario(
        id=escenario_id,
        config=_leer(base / "datos" / "configuracion.json"),
        tramos=tramos,
        condiciones=condiciones,
        restricciones=restricciones,
        viajes=_leer(carpeta / "viajes.json"),
        grafo=construir_grafo(nodos, tramos),
        nodos=nodos,
    )


def listar_escenarios(paquete: Path | None = None) -> list:
    """Índice de escenarios del paquete (id, nombre, objetivo, cantidad de viajes)."""
    return _leer((paquete or carpeta_paquete()) / "escenarios" / "indice.json")
