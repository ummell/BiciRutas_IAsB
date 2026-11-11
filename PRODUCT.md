# Product


## Platform

web

## Stack
React + Vite + TypeScript, Motion para animación, Tailwind v4. Backend local FastAPI sobre un motor Python con NetworkX. Decidido por el equipo (no delegado).

## Users
Jurado del Hackathon FQSD y evaluadores de ias software que ven una demo en vivo de 5 minutos, proyectada en una sala, y luego hacen 3 minutos de preguntas. Secundario: un operador de movilidad que consulta rutas y revisa el reparto de un lote de viajes. [Inferido del kit del reto; sin entrevista.]

## Product Purpose
Prototipo que recomienda rutas seguras en bicicleta sobre una red ficticia, sugiere hora de salida, reparte un lote de viajes para bajar la congestión y reporta los viajes tardíos o sin ruta segura, comparando contra una referencia sin estrategia. Éxito: el jurado entiende en segundos qué ruta se eligió, por qué es segura y cuánto bajó la congestión.

## Positioning
La seguridad depende de la hora (tramos que cierran o se vuelven inseguros de noche) y la congestión se mide como sobrecarga por tramo e intervalo; la interfaz hace visibles ambas cosas moviendo una hora y viendo la red reaccionar.

## Operating Context
Datos 100 % sintéticos (16 nodos, 28 tramos dirigidos, un día simulado de 15:00 a 21:00, intervalos de 5 min). Seis escenarios independientes. Se ejecuta en local; la API lee los datos de la empresa de `gestion/`, que se copia del kit y no se versiona.

## Capabilities and Constraints
Consulta de ruta con hora de salida y llegada; exclusión de tramos peligrosos según la hora; reparto de lote con métricas de congestión; estados A_TIEMPO, TARDE y SIN_RUTA_SEGURA; comparación con la referencia; extra: probar otra hora cuando no hay ruta segura. Sin mapa geográfico, autenticación, GPS ni pagos. La interfaz está en español.

## Brand Commitments
Paleta de ias software tomada de su sitio (ias.com.co): azul marino #023365, azul #0997e6, amarillo #febd04, rosa #fb2f70, tipografía Montserrat. El usuario pidió "colores similares" a la empresa. Nombre del producto: BiciRutas.

## Evidence on Hand
Seis escenarios, la red y las reglas en `gestion/`. Capturas del prototipo de referencia de la empresa en `gestion/test images/`. No hay testimonios ni métricas externas; no se inventan.

## Product Principles
1. La seguridad no se negocia: lo inseguro se ve como inseguro, siempre.
2. Cada número tiene su origen visible: ruta, tramo, hora.
3. Los viajes tardíos y sin ruta se muestran, nunca se esconden.
4. Legible proyectado en una sala antes que decorado.

## Accessibility & Inclusion
Contraste suficiente para proyección, estado nunca solo por color (forma, trazo y texto), foco de teclado visible, animación reducida respetada. [Inferido.]
