# BiciRutas: paquete para participantes junior

**Versión 1.0 | 4 de noviembre de 2026 | Construcción: 16 horas**

Tu equipo debe construir un prototipo con código que recomiende rutas seguras, sugiera una hora de salida y distribuya múltiples viajes para reducir la congestión del conjunto. Debe advertir los viajes que llegarán tarde o no tendrán ruta segura. No se exige una solución óptima global.

## Empieza aquí

1. Lee `documentacion/01_RETO_Y_ENTREGA.md` y `documentacion/02_REGLAS_SIMULACION.md`.
2. Abre `datos/plano_red.svg` en un navegador. Es una red ficticia, no un mapa de Bogotá.
3. Carga `datos/nodos.json`, `datos/tramos.json` y los archivos del escenario `01_viaje_normal`.
4. Consulta el diccionario y el ejemplo calculado de la documentación.
5. Construye tu aplicación con el lenguaje y las bibliotecas que prefieras.
6. Ejecuta primero una consulta, luego un lote y finalmente compara con la referencia suministrada.

**Todos los nombres, conexiones, distancias, tiempos, capacidades y peligros son inventados.** El contexto urbano se inspira libremente en Bogotá; no hay coordenadas geográficas, calles reales ni afirmaciones de seguridad sobre barrios de la ciudad. No necesitas internet, mapas, API keys ni datos personales.

## Qué contiene

- `datos/`: 16 nodos, 28 tramos dirigidos, configuración y plano SVG.
- `escenarios/`: seis escenarios independientes, 94 solicitudes en total. Cada uno trae viajes, condiciones horarias y restricciones en JSON y CSV equivalentes.
- `documentacion/`: reto, reglas, diccionario, escenarios, inicio guiado y evaluación.
- `herramientas/`: utilidades Python 3.10+ sin dependencias externas para validar datos, generar la referencia y evaluar resultados. No implementan la estrategia de redistribución del equipo.
- `ejemplos/`: planes y métricas de referencia reproducibles para los seis escenarios, más un plan de humo con dos rutas manuales.
- `plantillas/`: formato de respuesta y README para tu entrega.

JSON es la representación canónica. Los CSV son una alternativa para importar; no cargues ambas copias ni alteres los archivos oficiales. En CSV, los booleanos se escriben `True`/`False` y deben convertirse a booleanos; los números también deben convertirse. Identificadores y horas son texto.

## Herramientas opcionales

Desde la carpeta del paquete, con Python 3.10 o superior:

```bash
python herramientas/validar_datos.py
python herramientas/referencia.py 02_demanda_concentrada --salida mi_referencia.json
python herramientas/evaluar.py 02_demanda_concentrada mi_referencia.json --salida mis_metricas.json
```

En Windows, si `python` no funciona, utiliza `py -3`. Las herramientas no requieren instalación de paquetes. No es obligatorio que tu aplicación use Python: el contrato es JSON y puedes programar en cualquier lenguaje. Un código de salida 0 del evaluador indica que el formato y los recorridos declarados fueron aceptados; no certifica que tu estrategia sea óptima. También comprueba que una declaración SIN_RUTA_SEGURA sea cierta dentro del modelo y la ventana permitida.

Antes de la exposición ejecuta el evaluador con tu archivo de resultados. Explica las rutas elegidas, el efecto sobre la congestión y cualquier viaje tardío o sin ruta.
