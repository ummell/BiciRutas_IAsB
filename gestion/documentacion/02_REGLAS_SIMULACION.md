# Reglas comunes de simulación

Este modelo didáctico fija las decisiones que estaban pendientes en la ficha del reto. Es pequeño y determinista para permitir un prototipo junior en 16 horas. Estas reglas son las mismas para todos los equipos.

## 1. Tiempo, ventanas y recorridos

- Un único día ficticio: 2026-01-15, hora local America/Bogota. Las horas HH:MM son del mismo día; no hay cruces de medianoche.
- Horizonte de circulación: 15:00 a 21:00. Todas las llegadas deben ser como máximo a las 21:00.
- Salidas candidatas en múltiplos de 5 minutos, dentro de `[salida_desde, salida_hasta]`, ambos extremos incluidos.
- Todos los intervalos de condiciones, riesgos y ocupación son `[inicio, fin)`: incluyen el inicio y excluyen el final. Si un cierre termina a las 17:30, entrar exactamente a las 17:30 está permitido si no existe otro riesgo.
- El grafo es dirigido. Para circular en sentido contrario debe existir otra fila explícita. Distancia, tiempo y capacidad pertenecen a cada dirección, no se comparten con su opuesta.
- El recorrido es una lista de IDs de tramos conectados desde el origen hasta el destino. No se permiten ciclos, espera en nodos, saltos, retrocesos sobre una conexión inexistente ni cambios de ruta durante la simulación.
- No hay límite de distancia adicional. La espera antes de salir se permite únicamente dentro de la ventana. Toda solicitud debe aparecer una vez en el resultado.

## 2. Tiempo de cada tramo

Al entrar al tramo, busca la condición que contiene la hora de entrada. Todos los tramos tienen cobertura completa sin solapamientos. Calcula:

`duracion = ceil(tiempo_base_min × factor_vehicular × (1 + 0.25 × carga_inicial_bicis / capacidad_bicis))`

`ceil` redondea hacia arriba al minuto entero. La salida del tramo será entrada + duración y la entrada al siguiente tramo será exactamente esa salida. Para la consulta se suman las duraciones calculadas a lo largo del recorrido, no un promedio general. Si una condición cambia mientras cruzas, la duración queda fijada por la condición al entrar.

**Simplificación deliberada:** la carga inicial afecta el tiempo estimado; los viajes asignados por los equipos afectan el indicador de congestión y la decisión de rutas/horarios, pero no vuelven a cambiar esa duración. Así evitamos un cálculo circular entre tiempos y ocupación. No es un simulador físico de tráfico ni una promesa de tiempos reales. La congestión vehicular es externa y no se reduce al distribuir las bicicletas.

## 3. Seguridad

Un tramo es inválido si no está habilitado para bicicletas, si cualquiera de sus restricciones se solapa con el tiempo completo de paso o si no tiene iluminación y parte del paso coincide con la noche configurada (18:00-21:00). Todas las restricciones son exclusiones, no penalizaciones opcionales. No se distinguen intensidades de riesgo.

Hay solapamiento entre `[a,b)` y `[c,d)` si `a < d y c < b`. Aunque un cierre comience un minuto después de entrar, no puedes cruzar ese tramo si sigues allí al comenzar el cierre. Terminar exactamente al inicio de un cierre no se solapa. Cambiar la hora solo ayuda si el riesgo deja de estar vigente. El horario nocturno es una regla ficticia fija, no un dato de amanecer/atardecer real de Bogotá.

## 4. Ocupación, capacidad y congestión

Divide el horizonte en 72 intervalos de 5 minutos. Para cada par (tramo dirigido, intervalo):

- `inicial`: carga inicial de la condición vigente al comienzo del intervalo.
- `asignada`: número de viajes cuyo paso por el tramo se solapa con ese intervalo. Un viaje cuenta 1 en cada intervalo que toca, aunque cruce solo un minuto. No se cuentan bicicletas en nodos.
- `carga_total = inicial + asignada`.
- `sobrecarga = max(0, carga_total - capacidad_bicis)`.

`capacidad_bicis` significa ocupación nominal por tramo e intervalo según esta aproximación, no bicicletas por hora ni un aforo urbano real. Un exceso no bloquea una ruta: aumenta la congestión. Usa siempre la misma regla para tu resultado y la referencia.

Indicador principal: **sobrecarga acumulada = suma de sobrecarga de todos los pares tramo/intervalo**. Unidad: bici-intervalo de 5 minutos. Menor es mejor. Indicadores secundarios: pares saturados, máxima carga/capacidad, minutos totales de viaje, minutos totales de tardanza, viajes A_TIEMPO, TARDE y SIN_RUTA_SEGURA. La mejora porcentual es `100 × (referencia - equipo) / referencia`; si referencia vale cero, informar "no aplica" y usar diferencia absoluta. Una mejora negativa es un empeoramiento.

## 5. Resultado de una solicitud

- `A_TIEMPO`: recorrido seguro y llegada <= llegada_limite.
- `TARDE`: recorrido seguro, pero llegada > llegada_limite. Aun así debe permanecer en la simulación y contar para la congestión.
- `SIN_RUTA_SEGURA`: no existe recorrido seguro para ninguna salida permitida, dentro del horizonte. No equivale a "no llega a tiempo". No lleva salida ni tramos.

No se permite declarar SIN_RUTA_SEGURA solo para mejorar métricas. El evaluador comprueba formato, rutas ofrecidas y declaraciones de imposibilidad mediante búsqueda en la red pequeña. Si faltan viajes o hay un recorrido inválido, no se acepta la comparación de congestión como resultado válido del lote.

## 6. Referencia común

`referencia.py` busca para cada solicitud, de forma independiente y sin contar otras recomendaciones, el recorrido seguro de menor duración entre las salidas permitidas. Desempata por salida más temprana y luego por lista de IDs de tramo. Si todas las rutas llegan tarde, conserva la de menor duración y marca TARDE. Si no existe ninguna segura, declara SIN_RUTA_SEGURA.

Después evalúa todo el lote junto, con exactamente las mismas reglas. Tu equipo debe crear la estrategia que considera la carga de otras recomendaciones. Puedes repartir entre rutas y horarios; no hace falta demostrar un óptimo global. Reinicia la carga asignada al pasar de un escenario a otro: nunca mezcles sus solicitudes o restricciones.
