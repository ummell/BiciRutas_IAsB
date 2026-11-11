"""Valida un plan y calcula sus métricas sin buscar ni mejorar rutas."""
import argparse,json,sys
from modelo import cargar,leer,evaluar,guardar
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('escenario');p.add_argument('resultado');p.add_argument('--salida');a=p.parse_args()
    try:r=evaluar(cargar(a.escenario),leer(a.resultado))
    except (OSError,ValueError,TypeError,KeyError) as exc:r=dict(valido=False,errores=[str(exc)])
    if a.salida:guardar(a.salida,r)
    print(json.dumps({k:v for k,v in r.items() if k not in ['viajes','ocupacion']},ensure_ascii=False,indent=2))
    sys.exit(0 if r['valido'] else 1)
