# Diccionario de datos

Todos los JSON usan UTF-8, números JSON, booleanos verdaderos y arrays. Un ID es único dentro de su archivo. No hay datos faltantes. Los CSV equivalentes usan coma y encabezado; valores booleanos True/False. Los decimales usan punto.

## nodos.json

| Campo | Tipo / unidad | Significado |
| --- | --- | --- |
| id | texto | ID N01...N16. |
| nombre | texto | Lugar inventado; no es una ubicación real. |
| x, y | entero / píxel esquemático | Solo para dibujar. No son latitud, longitud ni medidas de distancia. |

## tramos.json

| Campo | Tipo / unidad | Significado |
| --- | --- | --- |
| id | texto | ID T01...T28. |
| origen, destino | ID de nodo | Único sentido permitido por esta fila. |
| distancia_m | entero / metros | Distancia ficticia. Mostrarla es opcional; no se utiliza para recalcular la duración. |
| tiempo_base_min | entero / minutos | Tiempo base para la fórmula. |
| capacidad_bicis | entero / bicicletas | Capacidad nominal de cada intervalo de ocupación de 5 minutos; siempre > 0. |
| iluminado | booleano | Si es false, el tramo no puede usarse durante la noche. |
| habilitado_bicicletas | booleano | Si es false, no puede utilizarse en ningún horario. |
| tipo | texto | Etiqueta descriptiva; no cambia la fórmula ni reemplaza las reglas de seguridad. |

## condiciones.json (por escenario)

| Campo | Tipo / unidad | Significado |
| --- | --- | --- |
| tramo_id | ID | Tramo al que aplica. |
| inicio, fin | HH:MM | Intervalo [inicio, fin). |
| factor_vehicular | número >= 1 | Multiplicador externo del tiempo base. |
| carga_inicial_bicis | entero >= 0 | Ocupación inicial ficticia de todos los intervalos incluidos en este período. |

Una condición no es un evento de entrada: la carga inicial se mantiene como valor del período, no se acumula por cada fila. No representa personas identificadas.

## restricciones.json (por escenario)

`id`: ID de restricción; `tramo_id`: conexión afectada; `inicio`, `fin`: vigencia [inicio, fin); `motivo`: cierre_por_obras, cierre_total, riesgo_vial_alto, riesgo_seguridad_personal o no_habilitado_bicicletas. Todas excluyen el tramo durante el paso. Una restricción es solo para la dirección indicada.

## viajes.json (por escenario)

`id`: ID ficticio V001...; `orden`: orden de presentación estable, no prioridad ni criterio del jurado; `origen`, `destino`: IDs; `salida_desde`, `salida_hasta`: extremos incluidos de salida permitida; `llegada_limite`: hora objetivo; `modalidad`: propia/publica, sin efecto en el cálculo.

Los IDs V001 pueden repetirse en escenarios distintos. El identificador completo es (escenario_id, viaje_id). Todas las salidas candidatas caen en la grilla de 5 minutos y dentro del horizonte. No hay usuarios reales, nombres personales ni domicilios.

## configuracion.json

Contiene versión, contexto ficticio, fecha y zona horaria de simulación, inicio/fin del horizonte, intervalo_min=5, inicio/fin de noche, coeficiente_carga_inicial=0.25 y espera_en_nodos=false. No cambies estos parámetros para mejorar tu puntuación.

## Resultado que produce el equipo

```json
{
  "escenario_id": "01_viaje_normal",
  "equipo": "Mi equipo",
  "viajes": [
    {"viaje_id": "V001", "salida": "17:00", "tramos": ["T01", "T02", "T03", "T04"], "estado": "A_TIEMPO"}
  ]
}
```

El ejemplo muestra una fila; un resultado real debe contener todas las solicitudes del escenario una sola vez. `salida` es HH:MM; el evaluador calcula llegada y duración, no confía en cifras declaradas por el equipo. Para SIN_RUTA_SEGURA utiliza `salida: null`, `tramos: []`, `estado: "SIN_RUTA_SEGURA"`. Puedes incluir `motivo` como texto. El evaluador ignora campos adicionales para que puedas añadir información de interfaz.
