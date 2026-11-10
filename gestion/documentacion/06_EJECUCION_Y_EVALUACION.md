# Ejecución y evaluación

Las herramientas usan solo Python estándar 3.10+. Tu aplicación puede usar cualquier lenguaje. No requieren credenciales ni acceso a internet.

```bash
python herramientas/validar_datos.py
python herramientas/referencia.py 02_demanda_concentrada --salida referencia.json
python herramientas/evaluar.py 02_demanda_concentrada referencia.json --salida metricas_referencia.json
python herramientas/evaluar.py 02_demanda_concentrada mi_resultado.json --salida metricas_equipo.json
```

El evaluador comprueba escenario, totalidad y unicidad de solicitudes, estado, salida permitida, continuidad del camino, sentidos, ciclos, horarios, seguridad y llegada. Recalcula todos los tiempos y la carga, y muestra ocupación por tramo/intervalo en el JSON de métricas. Rechaza un lote que tenga errores; no entrega un indicador de congestión parcial para aparentar una mejora.

Si se declara SIN_RUTA_SEGURA, comprueba que no exista un recorrido seguro para ninguna salida permitida utilizando la búsqueda de referencia. No mejora las rutas entregadas, evalúa creatividad ni certifica optimalidad. El verificador de datos revisa referencias, cobertura de condiciones y equivalencia de JSON/CSV; no reemplaza la demostración del prototipo.

## Cómo comparar

Usa exactamente el mismo escenario. Compara `sobrecarga_acumulada_bici_intervalo`, `pares_saturados`, `maxima_relacion_carga_capacidad`, `minutos_totales_viaje`, `minutos_totales_tardanza` y los conteos de estados. Una menor sobrecarga tiene prioridad, pero nunca justifica peligros o solicitudes omitidas. El jurado debe ver todos los efectos sobre puntualidad y factibilidad.

La referencia permite reproducir un punto de comparación; no debe presentarse como estrategia propia de redistribución. Puedes ejecutar y leer su código para comprender el modelo. Los datos y las reglas oficiales son inmutables; los archivos de salida son los únicos que genera tu equipo.

## Entrega sugerida

```text
mi-equipo/
  README.md
  codigo/
  resultados/
    01_viaje_normal.json
    02_demanda_concentrada.json
    03_cierre_temporal.json
    04_recorrido_nocturno.json
    05_destino_sin_acceso.json
    06_hora_imposible.json
```

Documenta cómo arrancar la aplicación y qué versión del lenguaje utilizas. No se exige despliegue público. El jurado debe poder ejecutar el prototipo localmente según tus instrucciones.
