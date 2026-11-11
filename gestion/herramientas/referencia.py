"""Referencia individual: menor duración segura, sin distribuir demanda."""
import argparse,json
from modelo import cargar,minuto,hora,paso,guardar

def crear_referencia(d):
    salientes={n['id']:[] for n in d['nodos']}
    for e in d['tramos'].values():salientes[e['origen']].append(e)
    cache={};filas=[]
    for v in d['viajes']:
        key=(v['origen'],v['destino'],v['salida_desde'],v['salida_hasta'])
        if key not in cache:
            mejor=None
            for salida in range(minuto(v['salida_desde']),minuto(v['salida_hasta'])+1,d['config']['intervalo_min']):
                def visitar(n,t,ruta,vistos):
                    nonlocal mejor
                    if n==v['destino']:
                        candidata=(t-salida,salida,tuple(ruta),t)
                        if mejor is None or candidata<mejor:mejor=candidata
                        return
                    if mejor is not None and t-salida>mejor[0]:return
                    for e in salientes[n]:
                        if e['destino'] in vistos:continue
                        try:fin=paso(d,e['id'],t)
                        except ValueError:continue
                        visitar(e['destino'],fin,ruta+[e['id']],vistos|{e['destino']})
                visitar(v['origen'],salida,[],{v['origen']})
            cache[key]=mejor
        mejor=cache[key]
        if mejor is None:filas.append(dict(viaje_id=v['id'],salida=None,tramos=[],estado='SIN_RUTA_SEGURA'))
        else:filas.append(dict(viaje_id=v['id'],salida=hora(mejor[1]),tramos=list(mejor[2]),estado='A_TIEMPO' if mejor[3]<=minuto(v['llegada_limite']) else 'TARDE'))
    return dict(escenario_id=d['id'],equipo='REFERENCIA_INDIVIDUAL',viajes=filas)
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('escenario');p.add_argument('--salida',required=True);a=p.parse_args();r=crear_referencia(cargar(a.escenario));guardar(a.salida,r);print('Referencia guardada:',a.salida)
