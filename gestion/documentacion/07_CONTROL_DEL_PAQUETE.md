# Control del paquete

Versión 1.0. Comprobaciones ejecutadas al preparar la entrega:

- Integridad de IDs, extremos, ventanas y cobertura horaria.
- Equivalencia de todos los archivos JSON/CSV.
- Reproducción de planes y métricas de referencia en seis escenarios.
- Bordes temporales: cierre e iluminación nocturna.
- Detección de lote incompleto, ruta no habilitada y declaraciones falsas de imposibilidad.
- Confirmación de destino sin acceso y de viajes necesariamente tardíos.
- Comprobación interna de que una distribución sencilla reduce la sobrecarga del escenario 02.

La estrategia de redistribución usada para la comprobación interna no está incluida: esa es la tarea de los equipos. El código de referencia incluido solo planifica cada viaje de forma independiente. Las métricas no garantizan comportamiento de tráfico real.
