"""Verifica integridad y coherencia estructural del paquete de entrada."""
import csv,json,sys
from modelo import ROOT,leer,cargar,minuto

def validar():
    nodos=leer(ROOT/'datos/nodos.json');tramos=leer(ROOT/'datos/tramos.json')
    assert len({n['id'] for n in nodos})==len(nodos),'Nodos duplicados'
    assert len({e['id'] for e in tramos})==len(tramos),'Tramos duplicados'
    ids={n['id'] for n in nodos}
    for e in tramos:
        assert e['origen'] in ids and e['destino'] in ids,'Extremo inexistente'
        assert e['origen']!=e['destino'] and e['capacidad_bicis']>0 and e['tiempo_base_min']>0 and e['distancia_m']>0,'Tramo inválido'
        assert type(e['iluminado']) is bool and type(e['habilitado_bicicletas']) is bool,'Booleano inválido'
    cantidad=0
    for s in leer(ROOT/'escenarios/indice.json'):
        d=cargar(s['id']);cfg=d['config'];inicio=minuto(cfg['inicio']);fin=minuto(cfg['fin'])
        for tid in d['tramos']:
            cs=sorted((c for c in d['condiciones'] if c['tramo_id']==tid),key=lambda c:minuto(c['inicio']))
            cursor=inicio
            for c in cs:
                assert minuto(c['inicio'])==cursor,'Hueco o solapamiento en condiciones'
                assert minuto(c['fin'])>cursor and c['factor_vehicular']>=1 and c['carga_inicial_bicis']>=0,'Condición inválida'
                assert (cursor-inicio)%cfg['intervalo_min']==0 and (minuto(c['fin'])-inicio)%cfg['intervalo_min']==0,'Condición fuera de grilla'
                cursor=minuto(c['fin'])
            assert cursor==fin,'Cobertura incompleta'
        assert all(c['tramo_id'] in d['tramos'] for c in d['condiciones']),'Condición de tramo desconocido'
        for r in d['restricciones']:
            assert r['tramo_id'] in d['tramos'] and inicio<=minuto(r['inicio'])<minuto(r['fin'])<=fin,'Restricción inválida'
        assert len({r['id'] for r in d['restricciones']})==len(d['restricciones']),'Restricción duplicada'
        assert len({v['id'] for v in d['viajes']})==len(d['viajes'])==s['cantidad_viajes'],'Viajes duplicados o conteo distinto'
        for v in d['viajes']:
            assert v['origen'] in ids and v['destino'] in ids and v['origen']!=v['destino'],'Extremo de viaje inválido'
            assert inicio<=minuto(v['salida_desde'])<=minuto(v['salida_hasta'])<fin,'Ventana inválida'
            assert inicio<=minuto(v['llegada_limite'])<=fin,'Límite fuera de horizonte'
            assert all((minuto(v[k])-inicio)%cfg['intervalo_min']==0 for k in ['salida_desde','salida_hasta']),'Salida fuera de grilla'
        cantidad+=len(d['viajes'])
    # Los CSV deben representar exactamente los mismos valores, tipos aparte.
    for p in ROOT.rglob('*.csv'):
        original=leer(p.with_suffix('.json'))
        with p.open(encoding='utf-8',newline='') as f:rows=list(csv.DictReader(f))
        assert len(rows)==len(original),'CSV con cantidad diferente'
        for a,b in zip(rows,original):assert a=={k:str(v) for k,v in b.items()},'JSON y CSV diferentes: '+str(p)
    return dict(valido=True,nodos=len(nodos),tramos=len(tramos),escenarios=6,solicitudes=cantidad)
if __name__=='__main__':
    try:r=validar()
    except (AssertionError,ValueError,KeyError,OSError) as e:print('ERROR:',e);sys.exit(1)
    print(json.dumps(r,ensure_ascii=False,indent=2))
