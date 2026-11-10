# Inicio guiado y distribución sugerida de 16 horas

## Ideas mínimas

Un grafo es un conjunto de nodos y conexiones. Aquí, cada nodo es un lugar y cada tramo permite desplazarse en un sentido. Una ruta es una secuencia de conexiones. Los tiempos y restricciones dependen del momento en que pasas, así que no basta con sumar distancias o eliminar todos los tramos con algún cierre, sin revisar su horario.

Puedes construir una lista de conexiones salientes por nodo. Usa una biblioteca de grafos si te ayuda; no se exige programar un algoritmo clásico desde cero. Para esta red pequeña puedes explorar rutas sin ciclos y probar salidas en la grilla. No es necesario resolver una optimización global.

## Pasos sugeridos

| Horas | Resultado |
| --- | --- |
| 0-2 | Leer reglas, cargar archivos, dibujar o listar nodos y conexiones. |
| 2-5 | Calcular una ruta, tiempos de paso y exclusiones de seguridad. |
| 5-7 | Probar salidas permitidas, mostrar llegada y distinguir tarde de sin ruta. |
| 7-10 | Procesar todas las solicitudes y mantener la ocupación por tramo/intervalo. |
| 10-13 | Crear una estrategia de distribución y comparar contra la referencia. |
| 13-15 | Completar la presentación y comprobar los seis escenarios. |
| 15-16 | Preparar README, resultados y demostración. |

La interfaz puede ser sencilla. Si falta tiempo, prioriza un cálculo verificable y una comparación clara. El jurado no exige mapas comerciales ni animación.

## Pseudocódigo orientativo (sin resolver la distribución)

```text
cargar red y escenario
para cada solicitud:
    listar salidas permitidas
    buscar candidatos seguros según horarios
    distinguir: no hay ruta / hay ruta pero llega tarde / llega a tiempo
    elegir con TU estrategia considerando la carga que generarían las recomendaciones
    registrar recorrido y ocupación
mostrar todos los viajes y métricas
comparar con la referencia
```

¿Cómo evitar que todo el mundo use el mismo corredor? ¿Se puede desplazar una salida cinco minutos sin salir de la ventana? ¿Qué aumenta o disminuye al cambiar de ruta? Esas decisiones son la parte central que debe construir tu equipo.

## IA como apoyo

Puedes pedir ayuda para entender la fórmula, leer JSON, encontrar un error o crear una visualización. Revisa lo que genera, comprueba horarios y restricciones, y registra brevemente para qué la utilizaste. El equipo debe poder explicar el cálculo y las decisiones.
