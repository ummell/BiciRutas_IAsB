# Guion de la demo · BiciRutas

Pitch de 5 minutos con demo en vivo y 3 minutos de preguntas. Antes de empezar: API en `localhost:8000`, web en `localhost:5173` y `gestion/` copiada del kit (ver README).

## Minuto a minuto

| Tiempo | Qué se muestra | Qué se dice |
|---|---|---|
| 0:00–0:40 | Encabezado de la app | Problema: si a todos se les recomienda el mismo corredor rápido, la ciclorruta se satura. BiciRutas recomienda rutas seguras según la hora y reparte los viajes para bajar la congestión del conjunto. |
| 0:40–1:40 | **Usuario** · Portal Andino → Casa del Encuentro, 17:00, límite 18:00 | Ruta segura, salida y llegada. Tres opciones: recomendada de 20 min con congestión moderada, más rápida de 12 min con congestión alta y menos congestión de 22 min. La recomendada equilibra tiempo y congestión. El mapa muestra la cobertura de cada estación y los tramos bloqueados. |
| 1:40–2:40 | **Administración · Consulta**, escenarios 03, 04 y 05 | Cada escenario carga su viaje. 03: espera hasta las 17:25 porque T03 está cerrado. 04: de noche evita T02 (sin luz) y tarda 16 min. 05: "Sin ruta segura", porque las únicas entradas a N16 están cerradas todo el día. La tabla lista los tramos con restricciones, como en el prototipo de ias. |
| 2:40–4:00 | **Administración · Lote**, escenario 02 (60 viajes) | Sin estrategia, todos van por T01-T04: sobrecarga 348. Con estrategia: 143, un 58,9 % menos. El costo se ve: 16 viajes llegan tarde (89 min en total) y el deslizador "Qué pesa más" lo ajusta. Mapa de calor y tabla viaje por viaje, con y sin estrategia. |
| 4:00–4:40 | `resultados/comparacion.md` | Los 6 escenarios pasan el evaluador oficial (`valido: true`). 01, 03, 04 y 06 quedan en 0 de sobrecarga; 05 no aplica porque nadie tiene ruta segura. |
| 4:40–5:00 | Cierre | Seguridad no negociable, congestión medida con la regla oficial y todo reproducible con los tests (72 de Python contrastados con el modelo oficial y 36 de la web). |

## Preguntas que trae el kit

- **¿Desde qué hora es de noche?** De 18:00 a 21:00 (`configuracion.inicio_noche`). Un tramo sin iluminación no se puede usar si cualquier parte del paso cae en ese horario.
- **¿Cómo se mide la congestión?** Con la sobrecarga acumulada: por cada tramo e intervalo de 5 minutos, las bicis que superan la capacidad, sumadas. Menos es mejor y 0 significa que ningún tramo queda saturado.
- **¿Qué pesa más: la hora límite o la congestión?** El reto prioriza la congestión del conjunto. Por defecto la congestión manda y la tardanza desempata. El deslizador "Qué pesa más" permite dar más peso a la puntualidad.

## Preguntas probables del jurado

- **En 02 los pares saturados suben de 6 a 19. ¿Empeoró?** No. La carga se reparte en más tramos, cada uno mucho menos cargado: el tramo más cargado baja de 20,3× a 6,7× su capacidad y la sobrecarga total baja un 58,9 %.
- **¿Por qué todos los viajes van de N01 a N05?** Son datos de la empresa y no se pueden cambiar. Cada escenario aísla una condición: muchos ciclistas piden la misma ruta y se mide si la estrategia los reparte. Para otros trayectos está la consulta libre.
- **¿Descartan viajes para mejorar el indicador?** No. Los 60 viajes de 02 siguen en la simulación, los tardíos se muestran y "Sin ruta segura" solo aparece donde el evaluador confirma que no hay ruta.
- **¿Los tiempos cambian con la congestión?** No. Es la simplificación de las reglas comunes: la carga inicial afecta la duración; los viajes asignados afectan la congestión y la elección de rutas, pero no recalculan tiempos.
- **¿Los bici-parqueaderos son reales?** Son un ejemplo, como toda la red ficticia. Muestran hacia dónde iría el proyecto Bike de ias: estaciones reales como nodos.
