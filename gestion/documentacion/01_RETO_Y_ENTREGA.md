# Reto y entrega

## El problema

Una empresa busca explorar una solución para ciudades u operadores de movilidad. En esta ciudad ficticia, recomendar el mismo recorrido rápido a todos puede saturar una ciclorruta. Queremos rutas seguras y una mejor distribución del conjunto, con información clara sobre horarios de llegada.

## Qué construir en 16 horas

Un prototipo funcional con código que permita seleccionar origen, destino y hora límite; respete la ventana permitida de salida; proponga un recorrido seguro y su salida; y procese todas las solicitudes de un escenario. Debe mostrar los recorridos y la congestión, comparar tu estrategia con la referencia y marcar viajes a tiempo, tardíos o sin ruta segura. Cada equipo elige interfaz, grafo, mapa o tablas, siempre que pueda comprobarse el resultado.

Se prioriza reducir la congestión del conjunto, incluso si algunos viajes llegan tarde. La seguridad no se negocia y los viajes tardíos deben seguir visibles. No puedes mejorar el indicador descartando viajes que sí pueden realizarse o moviéndolos fuera de su ventana. Si existe una ruta segura, debes asignarla aunque llegue tarde.

Puedes permitir cambiar la hora de salida dentro de la ventana. Si no existe una ruta segura en toda la ventana, informa SIN_RUTA_SEGURA. No necesitas mover la hora límite ni inventar condiciones posteriores al horizonte.

## Entrega del equipo

1. Código fuente y prototipo ejecutable.
2. README con instrucciones, decisiones, limitaciones, registro del apoyo de IA y tareas de cada integrante.
3. Un JSON de resultado por cada escenario, con el formato documentado.
4. Comparación con los resultados de referencia, incluyendo congestión y puntualidad.
5. Demostración de los seis casos y explicación de las limitaciones encontradas.

## Alcance

Tecnologías libres con implementación en código; IA y bibliotecas de grafos permitidas. No se exige mapa geográfico, aplicación nativa, autenticación, API real, GPS, pagos, inventario, préstamos o devoluciones. Para bicicletas públicas se supone que la bicicleta ya está disponible y puede devolverse en destino. No existe diferencia de cálculo entre las dos modalidades.

## Criterios (100 %)

| Criterio | Peso |
| --- | ---: |
| Cumplimiento funcional y seguridad | 30 % |
| Efecto sobre la congestión | 25 % |
| Funcionamiento técnico y uso de grafos | 20 % |
| Claridad y utilidad de los resultados | 15 % |
| Creatividad y pertinencia | 10 % |

Una ruta que utilice un tramo excluido es inválida. El jurado revisará que los resultados sean reproducibles y que el equipo comprenda lo implementado. No se fija un porcentaje mínimo de mejora.
