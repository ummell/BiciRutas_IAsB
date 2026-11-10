import argparse
import json
import subprocess
import sys
from pathlib import Path

from .datos import cargar_escenario, carpeta_paquete
from .estrategia import PESO_CONGESTION, repartir
from .lote import a_resultado_json, metricas, referencia_lote

ESCENARIOS = [
    "01_viaje_normal",
    "02_demanda_concentrada",
    "03_cierre_temporal",
    "04_recorrido_nocturno",
    "05_destino_sin_acceso",
    "06_hora_imposible",
]


def validar_con_evaluador(escenario: str, archivo: Path) -> bool:
    evaluador = carpeta_paquete() / "herramientas" / "evaluar.py"
    proceso = subprocess.run(
        [sys.executable, str(evaluador), escenario, str(archivo)],
        capture_output=True,
        text=True,
    )
    return proceso.returncode == 0


def mejora_porcentual(referencia: int, equipo: int) -> float | None:
    return None if referencia == 0 else round(100 * (referencia - equipo) / referencia, 1)


def tabla_markdown(filas: list) -> str:
    cab = (
        "| Escenario | Sobrecarga referencia | Sobrecarga equipo | Mejora | A tiempo | Tarde | Sin ruta segura | Evaluador |\n"
        "|---|---:|---:|---:|---:|---:|---:|:---:|\n"
    )
    lineas = []
    for f in filas:
        mejora = "no aplica" if f["mejora_pct"] is None else f"{f['mejora_pct']} %"
        lineas.append(
            f"| {f['escenario']} | {f['sobrecarga_referencia']} | {f['sobrecarga_equipo']} | {mejora} "
            f"| {f['a_tiempo']} | {f['tarde']} | {f['sin_ruta']} | {'OK' if f['evaluador_ok'] else 'ERROR'} |"
        )
    return cab + "\n".join(lineas) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--salida", default="resultados", help="carpeta de resultados")
    ap.add_argument("--equipo", default="ias software · BiciRutas")
    ap.add_argument("--peso", type=int, default=PESO_CONGESTION, help="peso de la congestión")
    ap.add_argument("--sin-evaluador", action="store_true", help="no ejecutar evaluar.py")
    a = ap.parse_args()

    carpeta = Path(a.salida)
    carpeta.mkdir(parents=True, exist_ok=True)
    filas = []
    for escenario in ESCENARIOS:
        esc = cargar_escenario(escenario)
        propio = repartir(esc, peso_congestion=a.peso)
        base = referencia_lote(esc)
        archivo = carpeta / f"{escenario}.json"
        archivo.write_text(
            json.dumps(a_resultado_json(esc, propio, a.equipo), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        m, r = metricas(esc, propio), metricas(esc, base)
        ok = True if a.sin_evaluador else validar_con_evaluador(escenario, archivo)
        filas.append(
            dict(
                escenario=escenario,
                sobrecarga_referencia=r["sobrecarga_acumulada_bici_intervalo"],
                sobrecarga_equipo=m["sobrecarga_acumulada_bici_intervalo"],
                mejora_pct=mejora_porcentual(
                    r["sobrecarga_acumulada_bici_intervalo"], m["sobrecarga_acumulada_bici_intervalo"]
                ),
                a_tiempo=m["viajes_a_tiempo"],
                tarde=m["viajes_tarde"],
                sin_ruta=m["viajes_sin_ruta_segura"],
                tardanza_referencia=r["minutos_totales_tardanza"],
                tardanza_equipo=m["minutos_totales_tardanza"],
                minutos_viaje_referencia=r["minutos_totales_viaje"],
                minutos_viaje_equipo=m["minutos_totales_viaje"],
                evaluador_ok=ok,
            )
        )
        print(f"{escenario}: ref {filas[-1]['sobrecarga_referencia']} -> equipo {filas[-1]['sobrecarga_equipo']}"
              f" | evaluador {'OK' if ok else 'ERROR'}")

    (carpeta / "comparacion.json").write_text(
        json.dumps(filas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (carpeta / "comparacion.md").write_text(tabla_markdown(filas), encoding="utf-8")
    return 0 if all(f["evaluador_ok"] for f in filas) else 1


if __name__ == "__main__":
    raise SystemExit(main())
