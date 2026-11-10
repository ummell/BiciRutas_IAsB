# Escenarios y comprobaciones públicas

Cada escenario se ejecuta desde cero; las condiciones y restricciones de otro no se heredan.

| Escenario | Viajes | Qué debe observarse |
| --- | ---: | --- |
| 01_viaje_normal | 8 | Recorrido seguro, cálculo correcto y hora de salida dentro de ventana. |
| 02_demanda_concentrada | 60 | La referencia concentra demanda; repartir rutas u horarios puede reducir sobrecarga. No descartar viajes ni alterar las ventanas. |
| 03_cierre_temporal | 10 | T03 no puede cruzarse durante [17:00,17:30). Es posible tomar otro corredor o salir después del cierre. |
| 04_recorrido_nocturno | 10 | T02, sin iluminación, no puede recorrerse durante [18:00,21:00); existen alternativas iluminadas. T18 tiene restricción de seguridad personal. |
| 05_destino_sin_acceso | 3 | T25 y T26 son las únicas entradas a N16 y están cerradas durante todo el horizonte. Todas las solicitudes son SIN_RUTA_SEGURA. Cambiar salida no soluciona este caso. |
| 06_hora_imposible | 3 | La única salida permitida es 17:00 y la hora límite 17:01. Existen rutas seguras, pero todos los viajes serán TARDE. |

## Ejemplo manual de tiempo

En el escenario 01, saliendo de N01 a las 17:00 por T01, T02, T03 y T04:

- Cada tramo tiene tiempo base 2, factor vehicular 1.25, carga inicial 1 y capacidad 3.
- `ceil(2 × 1.25 × (1 + 0.25 × 1/3)) = ceil(2.7083...) = 3 minutos`.
- Pasos: T01 17:00-17:03; T02 17:03-17:06; T03 17:06-17:09; T04 17:09-17:12.
- Duración 12 minutos; llegada 17:12; estado A_TIEMPO frente al límite 17:35.
- T02 no está iluminado, pero todo el paso es anterior a las 18:00, así que está permitido en este ejemplo.

## Ejemplo manual de congestión (no es un escenario adicional)

Para un tramo con capacidad 3 y carga inicial 1, tres viajes que tocan el mismo intervalo generan `1+3=4` bicicletas y sobrecarga 1. Si otro intervalo tiene carga 2, su sobrecarga es 0. La suma es 1 bici-intervalo. Si un viaje termina a las 17:05, no ocupa [17:05,17:10).

## Bordes que puedes comprobar

1. En el escenario 03, T03 entre 17:27 y 17:30 es inválido; entre 17:30 y 17:33 es válido si las demás condiciones se cumplen.
2. T02 entre 17:57 y 18:00 es válido; entre 17:58 y 18:01 es inválido.
3. T28 nunca puede usarse, aunque parece conectar N01 con N05 muy rápido.
4. T27 es un atajo con riesgo vial alto durante todo el horizonte.
5. Una llegada exactamente igual a la hora límite es A_TIEMPO.
6. No puedes invertir T01 si no existe una fila N02 -> N01.

`ejemplos/resumen_referencia.json` contiene métricas calculadas por la herramienta para los seis escenarios. Son resultados de referencia, no objetivos mínimos ni soluciones óptimas. Un plan manual de dos recorridos en `ejemplos/ejemplo_dos_rutas.json` permite estudiar el formato, pero solo contiene dos solicitudes y no es una entrega válida del escenario completo.
