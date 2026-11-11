"""Modelo común: tiempos, seguridad y métricas; no decide la distribución."""
from pathlib import Path
import json, math
from collections import defaultdict
ROOT = Path(__file__).resolve().parents[1]
def leer(path): return json.loads(Path(path).read_text(encoding='utf-8'))
def minuto(hora):
    if not isinstance(hora,str) or len(hora)!=5 or hora[2]!=':': raise ValueError('Hora inválida: '+repr(hora))
    h,m=map(int,hora.split(':'))
    if not (0<=h<24 and 0<=m<60):raise ValueError('Hora fuera de rango')
    return h*60+m

def hora(m):return f'{m//60:02}:{m%60:02}'
def solapa(a,b,c,d):return a<d and c<b

def cargar(escenario):
    indice={s['id'] for s in leer(ROOT/'escenarios/indice.json')}
    if escenario not in indice:raise ValueError('Escenario desconocido: '+escenario)
    carpeta=ROOT/'escenarios'/escenario
    return dict(id=escenario,config=leer(ROOT/'datos/configuracion.json'),nodos=leer(ROOT/'datos/nodos.json'),tramos={t['id']:t for t in leer(ROOT/'datos/tramos.json')},condiciones=leer(carpeta/'condiciones.json'),restricciones=leer(carpeta/'restricciones.json'),viajes=leer(carpeta/'viajes.json'))

def condicion(d,tid,t):
    rows=[c for c in d['condiciones'] if c['tramo_id']==tid and minuto(c['inicio'])<=t<minuto(c['fin'])]
    if len(rows)!=1:raise ValueError(f'Sin condición única: {tid} {hora(t)}')
    return rows[0]

def paso(d,tid,entrada):
    e=d['tramos'][tid];cfg=d['config'];fin=minuto(cfg['fin'])
    if entrada>=fin:raise ValueError('Paso fuera del horizonte')
    c=condicion(d,tid,entrada)
    dur=math.ceil(e['tiempo_base_min']*c['factor_vehicular']*(1+cfg['coeficiente_carga_inicial']*c['carga_inicial_bicis']/e['capacidad_bicis']))
    salida=entrada+dur
    if salida>fin:raise ValueError('Llegada fuera del horizonte')
    if not e['habilitado_bicicletas']:raise ValueError('Tramo no habilitado: '+tid)
    if not e['iluminado'] and solapa(entrada,salida,minuto(cfg['inicio_noche']),minuto(cfg['fin_noche'])):raise ValueError('Sin iluminación nocturna: '+tid)
    for r in d['restricciones']:
        if r['tramo_id']==tid and solapa(entrada,salida,minuto(r['inicio']),minuto(r['fin'])):raise ValueError('Restricción '+r['motivo']+': '+tid)
    return salida

def recorrido(d,viaje,salida,tramos):
    cfg=d['config'];t=minuto(salida)
    if not(minuto(viaje['salida_desde'])<=t<=minuto(viaje['salida_hasta'])):raise ValueError('Salida fuera de ventana')
    if (t-minuto(cfg['inicio']))%cfg['intervalo_min']:raise ValueError('Salida fuera de grilla')
    if t<minuto(cfg['inicio']):raise ValueError('Salida anterior al horizonte')
    actual=viaje['origen'];visitados={actual};pasos=[]
    if not isinstance(tramos,list) or not tramos:raise ValueError('Ruta vacía')
    for tid in tramos:
        if tid not in d['tramos']:raise ValueError('Tramo desconocido: '+str(tid))
        e=d['tramos'][tid]
        if e['origen']!=actual:raise ValueError('Ruta discontinua o sentido incorrecto: '+tid)
        if e['destino'] in visitados:raise ValueError('Ciclo no permitido')
        fin=paso(d,tid,t);pasos.append(dict(tramo_id=tid,entrada=hora(t),salida=hora(fin)))
        t=fin;actual=e['destino'];visitados.add(actual)
    if actual!=viaje['destino']:raise ValueError('No termina en destino')
    estado='A_TIEMPO' if t<=minuto(viaje['llegada_limite']) else 'TARDE'
    return dict(viaje_id=viaje['id'],estado=estado,salida=salida,llegada=hora(t),duracion_min=t-minuto(salida),tardanza_min=max(0,t-minuto(viaje['llegada_limite'])),pasos=pasos)

def evaluar(d,plan):
    errores=[];resultados=[]
    if not isinstance(plan,dict):return dict(valido=False,errores=['Se esperaba un objeto JSON'])
    if plan.get('escenario_id')!=d['id']:errores.append('escenario_id no coincide')
    filas=plan.get('viajes',[])
    if not isinstance(filas,list):return dict(valido=False,errores=['viajes debe ser un array'])
    solicitados={v['id']:v for v in d['viajes']};vistos=set()
    for f in filas:
        if not isinstance(f,dict):errores.append('Cada viaje debe ser un objeto');continue
        vid=f.get('viaje_id')
        if not isinstance(vid,str) or vid not in solicitados:errores.append('viaje_id desconocido');continue
        if vid in vistos:errores.append('Viaje duplicado: '+vid);continue
        vistos.add(vid)
        if f.get('estado')=='SIN_RUTA_SEGURA':
            if f.get('salida') is not None or f.get('tramos')!=[]:errores.append(vid+': SIN_RUTA_SEGURA requiere salida null y tramos []')
            else:resultados.append(dict(viaje_id=vid,estado='SIN_RUTA_SEGURA'))
            continue
        try:
            r=recorrido(d,solicitados[vid],f.get('salida'),f.get('tramos'))
            if f.get('estado')!=r['estado']:raise ValueError('Estado incorrecto; esperado '+r['estado'])
            resultados.append(r)
        except (ValueError,TypeError,KeyError) as exc:errores.append(vid+': '+str(exc))
    faltantes=set(solicitados)-vistos
    if faltantes:errores.append('Faltan solicitudes: '+', '.join(sorted(faltantes)))
    if errores:return dict(valido=False,errores=errores)
    # Comprobar imposibilidad en esta red pequeña evita descartar viajes para ganar.
    if any(r['estado']=='SIN_RUTA_SEGURA' for r in resultados):
        from referencia import crear_referencia
        ref={v['viaje_id']:v for v in crear_referencia(d)['viajes']}
        for r in resultados:
            if r['estado']=='SIN_RUTA_SEGURA' and ref[r['viaje_id']]['estado']!='SIN_RUTA_SEGURA':
                errores.append(r['viaje_id']+': existe una ruta segura en la ventana permitida')
    if errores:return dict(valido=False,errores=errores)
    cfg=d['config'];inicio=minuto(cfg['inicio']);fin=minuto(cfg['fin']);dt=cfg['intervalo_min'];asignada=defaultdict(int)
    for r in resultados:
        for p in r.get('pasos',[]):
            for t in range(inicio,fin,dt):
                if solapa(minuto(p['entrada']),minuto(p['salida']),t,t+dt):asignada[(p['tramo_id'],t)]+=1
    ocupacion=[]
    for tid,e in d['tramos'].items():
        for t in range(inicio,fin,dt):
            inicial=condicion(d,tid,t)['carga_inicial_bicis'];n=asignada[(tid,t)];total=inicial+n
            ocupacion.append(dict(tramo_id=tid,inicio=hora(t),fin=hora(t+dt),carga_inicial=inicial,carga_asignada=n,carga_total=total,capacidad=e['capacidad_bicis'],sobrecarga=max(0,total-e['capacidad_bicis'])))
    resumen=dict(sobrecarga_acumulada_bici_intervalo=sum(o['sobrecarga'] for o in ocupacion),pares_saturados=sum(o['sobrecarga']>0 for o in ocupacion),maxima_relacion_carga_capacidad=round(max(o['carga_total']/o['capacidad'] for o in ocupacion),4),minutos_totales_viaje=sum(r.get('duracion_min',0) for r in resultados),minutos_totales_tardanza=sum(r.get('tardanza_min',0) for r in resultados),viajes_a_tiempo=sum(r['estado']=='A_TIEMPO' for r in resultados),viajes_tarde=sum(r['estado']=='TARDE' for r in resultados),viajes_sin_ruta_segura=sum(r['estado']=='SIN_RUTA_SEGURA' for r in resultados))
    return dict(valido=True,escenario_id=d['id'],resumen=resumen,advertencia='Modelo educativo de red ficticia; métricas calculadas con las reglas comunes.',viajes=resultados,ocupacion=ocupacion)

def guardar(path,obj):
    p=Path(path);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
