<div align="center">
  <h1>BiciRutas</h1>
  <p><strong>Rutas seguras en bicicleta y reparto de viajes con grafos</strong></p>
  <img src="https://img.shields.io/badge/Python_3.12-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/NetworkX-4B8BBE?style=for-the-badge&logo=python&logoColor=white" alt="NetworkX" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Motion-FF0088?style=for-the-badge&logo=framer&logoColor=white" alt="Motion" />
</div>

<br />

> **BiciRutas** recomienda rutas seguras en bicicleta sobre un grafo dirigido, sugiere a qué hora salir y reparte un lote de viajes para reducir la congestión del conjunto, en lugar de mandar a todos por el mismo corredor rápido. Avisa qué viajes llegarán tarde y cuáles no tienen ruta segura, y compara el resultado contra una referencia sin estrategia.

> **Contexto:** prototipo del reto de ias software en el Hackathon FQSD (Disruptia y Universidad Icesi). La red es ficticia: 16 nodos, 28 tramos dirigidos y un único día simulado (2026-01-15, de 15:00 a 21:00). No hay mapas reales, API keys ni datos personales. Los datos de la empresa viven en `gestion/`, dentro de este repositorio.

---

## Alcance de este repositorio

Prototipo que debe funcionar en la demo. Incluye:

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| Modelo | Carga de datos, grafo, tiempo de paso, seguridad y simulación de recorridos | Hecho, 60 tests pasan |
| Consulta | Ruta, hora de salida y llegada para un origen, destino y hora límite | Hecho |
| Lote | Procesa un escenario completo y mide la ocupación por tramo e intervalo | Hecho |
| Estrategia | Reparte rutas y salidas para bajar la sobrecarga total (greedy por costo marginal y mejora local) | Hecho |
| Resultados | Un JSON por escenario y comparación con la referencia | Hecho |
| API | FastAPI local que expone consulta, lote y métricas | Hecho |
| Web | Aplicación web con plano de la red, control de hora, comparación de lote y animaciones | Hecho |

No incluye autenticación, GPS, pagos, préstamos de bicicletas ni despliegue público. El jurado ejecuta el prototipo en local.

---

## Características

- **Consulta de ruta:** origen, destino y hora límite devuelven recorrido, salida y llegada.
- **Seguridad no negociable:** una ruta con un tramo excluido es inválida. Se excluye por cierre, riesgo vial, tramo no habilitado o noche sin iluminación (18:00 a 21:00).
- **Reparto de viajes:** elige rutas y salidas considerando la carga que generan las otras recomendaciones.
- **Estados claros:** `A_TIEMPO`, `TARDE` o `SIN_RUTA_SEGURA`. Los viajes tardíos siguen en la simulación y se muestran.
- **Comparación:** sobrecarga acumulada, pares saturados, minutos de viaje y tardanza, frente a la referencia.
- **Extra:** probar otra hora de salida dentro de la ventana cuando no hay ruta segura.
- **Web con Motion:** trazo animado de la ruta sobre el plano, transiciones entre vistas y contadores de sobrecarga.

---

## Reglas del modelo

Fijas para todos los equipos (detalle en `gestion/documentacion/02_REGLAS_SIMULACION.md`):

| Regla | Definición |
|-------|------------|
| Intervalos | `[inicio, fin)`: un cierre que termina a las 17:30 permite entrar exactamente a las 17:30 |
| Duración de un tramo | `ceil(tiempo_base × factor_vehicular × (1 + 0.25 × carga_inicial / capacidad))`, con la condición vigente al entrar |
| Congestión | 72 intervalos de 5 min. Por tramo e intervalo: `sobrecarga = max(0, carga_inicial + asignada − capacidad)` |
| Indicador principal | Suma de todas las sobrecargas, en bici-intervalos. Menos es mejor |
| Prioridad | La congestión pesa más que la hora límite, sin romper la seguridad ni descartar viajes con ruta segura |
| `SIN_RUTA_SEGURA` | Solo si ninguna salida permitida tiene un recorrido seguro |

---

## Stack

- **Motor:** Python 3.12, NetworkX (`MultiDiGraph`, clave = id de tramo)
- **Pruebas:** pytest, con contraste contra el modelo oficial del paquete
- **API:** FastAPI
- **Frontend:** React 19, Vite, TypeScript y Tailwind v4, con la paleta de ias software y Montserrat
- **Datos del servidor:** TanStack Query
- **Animación:** Motion (trazo de la ruta, transiciones de vista, contadores y gráficos)
- **Entorno:** uv, versiones fijadas en `requirements.txt`

---

## Estructura del proyecto

```text
BiciRutas_IAsB/
    ├── gestion/                # Material de la empresa (datos, escenarios, reglas, evaluador)
    ├── codigo/bicirutas/
    │   ├── datos.py            # Carga de JSON y construcción del grafo
    │   ├── modelo.py           # Duración por tramo, seguridad y simulación de recorrido
    │   └── tiempo.py           # Horas en minutos y solapamiento de intervalos
    ├── api/                    # FastAPI
    ├── web/                    # React + Vite + Motion
    ├── tests/                  # pytest
    ├── resultados/             # Un JSON por escenario
    ├── requirements.txt
    ├── .env.example
    └── README.md
```

---

## Escenarios

| Escenario | Qué debe observarse |
|-----------|---------------------|
| `01_viaje_normal` | Recorrido seguro; el ejemplo manual llega a las 17:12 |
| `02_demanda_concentrada` | 60 viajes; repartir rutas u horarios baja la sobrecarga frente a la referencia |
| `03_cierre_temporal` | T03 cerrado en [17:00, 17:30): otro corredor o salir después |
| `04_recorrido_nocturno` | T02 sin luz no se usa en [18:00, 21:00) |
| `05_destino_sin_acceso` | Los 3 viajes son `SIN_RUTA_SEGURA` |
| `06_hora_imposible` | Hay rutas seguras y los 3 viajes son `TARDE` |

---

## Desarrollo

Requiere **Python 3.10+** (se usa 3.12) y **uv**.

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
cp .env.example .env                      # BICIRUTAS_PAQUETE apunta a gestion
.venv/bin/python -m pytest                # tests del modelo
```

Levantar la API (puerto 8000, CORS abierto para el frontend en `localhost:5173`):

```bash
PYTHONPATH=codigo:. .venv/bin/python -m uvicorn api.main:app --port 8000
```

| Método | Ruta | Para qué |
|--------|------|----------|
| GET | `/api/escenarios` | Índice de escenarios |
| GET | `/api/escenarios/{id}/red` | Nodos, tramos, restricciones y viajes |
| POST | `/api/escenarios/{id}/consulta` | Ruta, salida y llegada de un viaje suelto |
| GET | `/api/escenarios/{id}/lote?peso=` | Reparto del escenario frente a la referencia, con mapa de calor |
| GET | `/api/escenarios/{id}/estado-tramos?hora=` | Qué tramos se pueden usar a esa hora y por qué no |

Generar los 6 resultados, validarlos con el evaluador y armar la comparación:

```bash
PYTHONPATH=codigo .venv/bin/python -m bicirutas.generar
```

Validar un resultado suelto con el evaluador oficial:

```bash
python gestion/herramientas/evaluar.py 02_demanda_concentrada resultados/02_demanda_concentrada.json
```

Código de salida 0 significa formato y recorridos aceptados, no que la estrategia sea óptima.

Levantar la aplicación web (requiere Node.js y pnpm, y la API corriendo en el puerto 8000):

```bash
pnpm --dir web install
pnpm --dir web dev          # http://localhost:5173, reenvía /api a la API local
pnpm --dir web build        # comprobación de tipos y build de producción
```

Los enlaces con ancla abren una vista y un escenario concretos, por ejemplo `http://localhost:5173/#lote/02_demanda_concentrada`.

### Variables de entorno

Copia `.env.example` a `.env` (no se versiona). `BICIRUTAS_PAQUETE` es la carpeta con `datos/` y `escenarios/`; por defecto `gestion`, dentro del repositorio. El prototipo no usa llaves de servicios externos; si se agregan, van solo en `.env`.

---

## Comparación con la referencia

Generada con `bicirutas.generar` (detalle en `resultados/comparacion.json`). Los 6 JSON pasan `evaluar.py` con código de salida 0.

| Escenario | Sobrecarga referencia | Sobrecarga equipo | Mejora | A tiempo | Tarde | Sin ruta segura |
|-----------|----------------------:|------------------:|-------:|---------:|------:|----------------:|
| 01_viaje_normal | 36 | 0 | 100 % | 8 | 0 | 0 |
| 02_demanda_concentrada | 348 | 143 | 58,9 % | 44 | 16 | 0 |
| 03_cierre_temporal | 48 | 0 | 100 % | 10 | 0 | 0 |
| 04_recorrido_nocturno | 6 | 0 | 100 % | 10 | 0 | 0 |
| 05_destino_sin_acceso | 0 | 0 | no aplica | 0 | 0 | 3 |
| 06_hora_imposible | 6 | 0 | 100 % | 0 | 3 | 0 |

En el escenario 02, la mejora de congestión se paga con 16 viajes tardíos (la referencia tiene 0). Es el equilibrio que permite el reto, que prioriza la congestión.

---

## Decisiones y limitaciones

- El código del equipo no importa el modelo oficial: se reimplementó para poder explicarlo. Los tests lo contrastan con el oficial en cada tramo y cada minuto de los seis escenarios.
- La carga inicial afecta el tiempo estimado; los viajes asignados afectan la congestión pero no recalculan duraciones. Es una simplificación del modelo.
- La estrategia tiene un peso entre congestión y tardanza (`peso_congestion`). Por defecto la congestión manda y la tardanza solo desempata, como pide el reto. Bajar el peso reduce los viajes tardíos a cambio de algo más de sobrecarga.
- No es una solución óptima global ni un simulador de tráfico real.

## Equipo y tareas

| Cargo | Responsable | Funciones |
|-------|-------------|-----------|
| Programación | Samuel | Desarrollo de backend y API |
| Programación | Melissa | Desarrollo de frontend |
| Programación | Michael | Desarrollador |
| Análisis | Lina | Análisis de software y QA |
| Administración y mercadeo | Juliana | Mercadeo, CRM y experiencia de usuario |

## Uso de IA

- **Herramienta:** Kiro (asistente de programación con IA) dentro del editor.
- **Para qué se usó:**
  - Leer y resumir la documentación del reto y planear las fases.
  - Escribir el motor en Python (grafo, tiempos, seguridad, congestión y estrategia de reparto), la API y la aplicación web.
  - Escribir los tests y el script que genera los resultados.
- **Cómo se comprobó lo generado:**
  - 60 tests automáticos, incluido el contraste de cada tramo y cada minuto contra el modelo oficial del paquete en los seis escenarios.
  - Los seis resultados pasan `evaluar.py` con código de salida 0.
  - Las cifras de la referencia coinciden con `ejemplos/resumen_referencia.json`.
- **Quién explica cada parte:**

  | Parte | Responsable de explicarla |
  |-------|---------------------------|
  | Cálculo de tiempos, regla de seguridad, grafo y estrategia de reparto | Samuel |
  | Interfaz web, plano de la red y animaciones | Melissa |
  | Consulta de ruta y lote en la API | Michael |
  | Pruebas, contraste con el evaluador oficial y resultados | Lina |
  | Propuesta de valor, experiencia de usuario y cierre del pitch | Juliana |

  Todo el equipo debe poder responder, aunque no sea su parte, qué es la sobrecarga, desde qué hora es de noche y por qué hay viajes tardíos.


---

<div align="center">
  <br>
  <p>Construido en el Hackathon FQSD con ias software.</p>
</div>
