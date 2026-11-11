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

> **Contexto:** prototipo del reto de ias software en el Hackathon FQSD (Disruptia y Universidad Icesi). La red es ficticia: 16 nodos, 28 tramos dirigidos y un único día simulado (2026-01-15, de 15:00 a 21:00). No hay mapas reales, API keys ni datos personales. De los datos de la empresa solo se versionan en `gestion/` los archivos necesarios para ejecutar el prototipo; el resto del kit está en `.gitignore` (ver [Datos de la empresa](#datos-de-la-empresa)).

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
| Roles | Selector Usuario / Administración en la interfaz (solo visual, sin contraseña) | Hecho |

No incluye autenticación real, GPS, pagos, préstamos de bicicletas ni despliegue público. El jurado ejecuta el prototipo en local.

---

## Características

- **Consulta de ruta:** origen, destino y hora límite devuelven recorrido, salida y llegada.
- **Bici-parqueaderos (vista de usuario):** Mercado Central (N04) y Centro Cultural (N08) se muestran como bici-parqueaderos de ejemplo, con cupos y horario. Desde cualquier lugar, "Ir al parqueadero más cercano" elige el más cercano por distancia sobre el grafo dirigido, sin usar vías no habilitadas. Se definen en `web/src/lib/parqueaderos.ts`; los datos de la empresa en `gestion/` no cambian.
- **Ruta equilibrada (vista de usuario):** entre las rutas que llegan a tiempo, recomienda la de menor congestión que no tarde mucho más que la más rápida, y muestra hasta tres opciones (recomendada, más rápida, menos congestión) con su nivel de congestión.
- **Seguridad no negociable:** una ruta con un tramo excluido es inválida. Se excluye por cierre, riesgo vial, tramo no habilitado o noche sin iluminación (18:00 a 21:00).
- **Reparto de viajes:** elige rutas y salidas considerando la carga que generan las otras recomendaciones.
- **Estados claros:** `A_TIEMPO`, `TARDE` o `SIN_RUTA_SEGURA`. Los viajes tardíos siguen en la simulación y se muestran.
- **Comparación:** sobrecarga acumulada, pares saturados, minutos de viaje y tardanza, frente a la referencia.
- **Extra:** probar otra hora de salida dentro de la ventana cuando no hay ruta segura.
- **Roles:** el selector del encabezado alterna entre Usuario y Administración. El rol se recuerda en el navegador (`localStorage`).
  - **Usuario** (por defecto): solo la consulta de ruta, sobre el escenario `01_viaje_normal`. No ve escenarios de prueba, lote, comparación con la referencia ni la carga de viajes de muestra.
  - **Administración:** ve todo, incluidos los seis escenarios, el lote y la comparación.
- **Web con Motion:** trazo animado de la ruta sobre el plano, transiciones entre vistas y contadores de sobrecarga.
- **Identidad visual:** paleta, tipografía (Bricolage Grotesque + Inter) y reglas del mapa definidas a partir del logo en [`DESIGN.md`](DESIGN.md). El mapa interactivo de la vista de usuario tiene zoom, modo noche, capa de cobertura por estación, flujo animado en los tramos seguros y la bici recorriendo la ruta. Administración usa el plano de la red con su control de hora.

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
    ├── gestion/                # Datos y evaluador del kit; solo se versionan los archivos necesarios
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

### Datos de la empresa

De la carpeta `gestion/` (paquete de la empresa) solo se versionan los 25 archivos que necesitan la API, los tests y el evaluador: `datos/{nodos,tramos,configuracion}.json`, `escenarios/indice.json`, `condiciones.json`, `restricciones.json` y `viajes.json` de cada escenario, y `herramientas/{evaluar,modelo,referencia}.py`. El resto del kit (PDF, documentación, ejemplos, plantillas, CSV, SVG y `validar_datos.py`) queda en `.gitignore`; consúltalo en el paquete original. Si el paquete está en otro lugar, define `BICIRUTAS_PAQUETE` con su ruta.

> **Aviso para el equipo:** durante un tiempo `gestion/` no se versionó. Al hacer `pull` de este cambio, git puede borrar de tu copia local los archivos que dejaron de versionarse. Respáldala antes o vuelve a copiarla desde el kit.

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
| GET | `/api/escenarios/{id}/lote?peso=` | Reparto del escenario frente a la referencia, con mapa de calor y `evaluador_ok` (resultado del evaluador oficial sobre el plan) |
| GET | `/api/escenarios/{id}/estado-tramos?hora=` | Qué tramos se pueden usar a esa hora y por qué no |
| GET | `/api/escenarios/{id}/linea-tiempo` | Tramos bloqueados en cada intervalo de 5 minutos, para ubicar los cambios del día |

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
pnpm --dir web test         # tests de la web: mapa por rol, modo vivo y movimiento reducido
```

Los enlaces con ancla abren una vista y un escenario concretos, por ejemplo `http://localhost:5173/#lote/02_demanda_concentrada`.

### Ejecutar con Docker

Con Docker Engine y el complemento Docker Compose instalados, inicia la aplicación completa desde la raíz del repositorio:

```bash
docker compose up --build
```

Abre `http://localhost:8080`. Compose levanta la API Python y el frontend React; Nginx sirve la aplicación y reenvía las solicitudes `/api` a la API. Para detenerla, ejecuta `docker compose down`.

### Despliegue en Vercel

El despliegue en línea usa Vercel sin servidor (configuración en `vercel.json`): la web se compila a `web/dist` y la API FastAPI corre como función desde `api/index.py`, que expone la app de `api/main.py` y las solicitudes `/api/*` se redirigen a ella. `api/index.py` busca los datos en `gestion/`, y los archivos necesarios están versionados (ver [Datos de la empresa](#datos-de-la-empresa)).

### Variables de entorno

Copia `.env.example` a `.env` (no se versiona). `BICIRUTAS_PAQUETE` es la carpeta con `datos/` y `escenarios/`; por defecto `gestion`. El prototipo no usa llaves de servicios externos; si se agregan, van solo en `.env`.

---

## Comparación con la referencia

Generada con `bicirutas.generar` (detalle en `resultados/comparacion.json`). Los 6 JSON pasan `evaluar.py` con código de salida 0.

| Escenario | Sobrecarga referencia | Sobrecarga equipo | Mejora | A tiempo | Tarde | Sin ruta segura |
|-----------|----------------------:|------------------:|-------:|---------:|------:|----------------:|
| 01_viaje_normal | 36 | 0 | 100 % | 8 | 0 | 0 |
| 02_demanda_concentrada | 348 | 138 | 60,3 % | 44 | 16 | 0 |
| 03_cierre_temporal | 48 | 0 | 100 % | 10 | 0 | 0 |
| 04_recorrido_nocturno | 6 | 0 | 100 % | 10 | 0 | 0 |
| 05_destino_sin_acceso | 0 | 0 | no aplica | 0 | 0 | 3 |
| 06_hora_imposible | 6 | 0 | 100 % | 0 | 3 | 0 |

En el escenario 02, la mejora de congestión se paga con 16 viajes tardíos (la referencia tiene 0). Es el equilibrio que permite el reto, que prioriza la congestión.

---

## Decisiones y limitaciones

- El código del equipo no importa el modelo oficial: se reimplementó para poder explicarlo. Los tests lo contrastan con el oficial en cada tramo y cada minuto de los seis escenarios.
- La carga inicial afecta el tiempo estimado; los viajes asignados afectan la congestión pero no recalculan duraciones. Es una simplificación del modelo.
- La estrategia tiene un peso entre congestión y tardanza (`peso_congestion`): cada bici-intervalo de sobrecarga cuesta lo mismo que 3 min de tardanza. Elegimos 3 probando pesos de 1 a 1000 con el evaluador oficial: es el que deja la menor sobrecarga en los seis escenarios (en 02, 138 frente a 143 con peso 1000; los otros cinco quedan idénticos). La búsqueda es voraz, así que un peso mayor no siempre da menos sobrecarga. La vista Lote muestra las métricas de cada nivel para comparar.
- Los roles solo cambian lo que muestra la interfaz. No hay contraseña y la API sigue abierta, así que cualquiera puede cambiarse a Administración. Proteger de verdad exigiría una clave en `.env` y respuestas 403 en la API.
- **Consulta equilibrada.** Con `criterio: "equilibrado"` (lo envía la vista de usuario), la consulta toma las rutas seguras que llegan a tiempo, fija un margen de `d0 + max(8, ceil(0.5 × d0))` minutos sobre la más rápida (`d0`) y elige la de menor costo marginal de congestión frente al reparto del equipo en ese escenario y a esa hora. Ejemplo en `01_viaje_normal`, de N01 a N05 a las 17:00: la más rápida tarda 12 min con 6 bici-intervalos de sobrecarga; la recomendada tarda 20 min con 2. Sin `criterio`, la consulta devuelve la más rápida como antes, igual que la referencia oficial. El lote y los JSON de `resultados/` no usan esta consulta, así que la entrega evaluada no cambia.
- No es una solución óptima global ni un simulador de tráfico real.

## Necesidades de la empresa

Lo que ias software describió para su proyecto Bike y en qué estado queda en este prototipo:

| Necesidad | Estado |
|---|---|
| Ruta segura de A a B, evitando zonas peligrosas | Hecho: exclusión por cierre, riesgo vial, tramo no habilitado e iluminación según la hora |
| Saber cuándo salir y cuánto se tarda | Hecho: salida, llegada y duración por tramo |
| Ruta idónea por hora, congestión y seguridad, no solo la más corta | Hecho: consulta equilibrada y reparto del lote |
| Rutas alternativas | Hecho: hasta tres opciones con su congestión |
| Estaciones y bici-parqueaderos reales | Parcial: la red es ficticia por diseño del reto; el mapa de usuario muestra los nodos como estaciones con su cobertura y dos bici-parqueaderos de ejemplo con "ir al más cercano" |
| Registro de bici-usuarios y bicicletas, georreferenciación de recorridos, otras ciudades, patinetas eléctricas | Fuera del alcance del reto (no hay autenticación, GPS ni datos reales). Queda como hoja de ruta: cargar estaciones reales como nodos, sumar usuarios y bicicletas, y aplicar la misma lógica de grafo a otras ciudades |

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
