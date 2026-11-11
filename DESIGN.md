# BiciRutas · Sistema de diseño del mapa

> Documento base para rediseñar **el mapa** de BiciRutas (vista de usuario y de administrador) a partir del logo. Todo lo que se dibuje en el mapa debe poder justificarse con una regla de este archivo.
>
> **Alcance:** las secciones 5 a 9 son específicas del mapa (marcadores, capas, controles, tarjetas flotantes, barra de hora y vista de calle). La paleta (sección 3) y la tipografía (sección 4) se aplican a toda la aplicación.

---

## 1. Idea central

El logo es un **pin de mapa** que contiene una **rueda de bicicleta** (naranja), una **colina** (verde bosque) atravesada por un **camino blanco** y una **ciudad** al fondo (verde salvia).

El mapa debe sentirse como **estar dentro del logo**:

| Elemento del logo | Qué representa en el mapa |
|---|---|
| Camino blanco que serpentea | Las vías: blancas, limpias y protagonistas sobre un fondo cálido |
| Rueda naranja | La **ruta recomendada** y la bici en movimiento: lo único naranja intenso del mapa |
| Colina verde bosque | Textos, bordes, controles y marcadores: el color que "sostiene" todo |
| Ciudad verde salvia | Parques, ciclorrutas y elementos secundarios |
| Forma de pin | El marcador de **destino** (versión simplificada del logo) |

**Tres principios:**

1. **Una sola cosa grita.** El naranja se reserva para la ruta y la bici. Si todo es llamativo, nada lo es.
2. **Calma por defecto, detalle al acercar.** Con el mapa alejado se ven vías, ruta y nombres clave; con zoom aparecen etiquetas de tramos, sentidos y nombres de todos los puntos.
3. **Nunca solo color.** Cada estado (bloqueado, tarde, saturado) lleva también forma: punteado, icono o texto.

---

## 2. Logo

- **Archivo:** [`web/public/marca/logo.png`](web/public/marca/logo.png) (661 × 808 px, fondo transparente).
- **Pendiente:** conseguir la versión **SVG** para usarla nítida en cualquier tamaño.

**Usos en el mapa**

| Uso | Tamaño | Notas |
|---|---|---|
| Marca de agua en la esquina inferior izquierda del mapa | 28 px de alto | Opacidad 90 %, sobre una pastilla blanca |
| Marcador de destino | 36 px de alto | Versión simplificada: solo la silueta del pin en verde bosque con el arco naranja de la rueda |
| Pantalla de carga del mapa | 64 px | Centrado, con la rueda girando suavemente |

**No hacer:** cambiar sus colores, ponerlo sobre el naranja, deformarlo, añadirle sombras fuertes o usarlo por debajo de 20 px de alto (se pierde la ciudad).

**Espacio de respeto:** como mínimo, el ancho del arco de la rueda alrededor del logo.

---

## 3. Color

### 3.1 Colores del logo (no se modifican)

| Token | Hex | Nombre | Rol |
|---|---|---|---|
| `--br-bosque` | `#193A27` | Verde bosque | Color principal: textos, bordes de ruta, controles, marcadores |
| `--br-rueda` | `#E07A2B` | Naranja rueda | Acento único: ruta recomendada, bici en movimiento, foco |
| `--br-salvia` | `#667F63` | Verde salvia | Secundario: ciclorrutas, parques, iconos inactivos |
| `--br-camino` | `#FFFFFF` | Blanco camino | Vías, tarjetas y halos de texto |

### 3.2 Derivados (generados a partir del logo)

| Token | Hex | Uso |
|---|---|---|
| `--br-bosque-900` | `#0F2318` | Fondo del modo noche |
| `--br-bosque-600` | `#2F7A4B` | Estado "a tiempo" y tráfico fluido |
| `--br-bosque-100` | `#E3ECE5` | Fondos de chips activos y selección suave |
| `--br-rueda-700` | `#A34E16` | **Texto** naranja sobre fondos claros (el naranja del logo no alcanza contraste para texto) |
| `--br-rueda-300` | `#F2A462` | **Texto** naranja sobre fondos verde bosque (6,1 : 1) |
| `--br-rueda-100` | `#FCEBDD` | Fondo de avisos de ruta y tardanza |
| `--br-salvia-300` | `#A9BBA6` | Ciclorrutas al alejar el mapa y bordes suaves |
| `--br-salvia-100` | `#DDE6D8` | Parques |

### 3.3 Neutros del mapa

| Token | Hex | Uso |
|---|---|---|
| `--map-tierra` | `#F4F1EA` | Fondo del mapa (tono papel, cálido) |
| `--map-manzana` | `#E9E4D8` | Manzanas |
| `--map-agua` | `#BFD9D2` | Agua (verde azulado, no el azul de Google) |
| `--map-borde-via` | `#D6CFBF` | Borde de las vías blancas |
| `--map-texto` | `#193A27` | Nombres de lugares (el mismo verde bosque) |
| `--map-texto-suave` | `#566259` | Etiquetas secundarias (T01, distancias) |

### 3.4 Colores de estado

| Estado | Color | Forma que lo acompaña |
|---|---|---|
| A tiempo | `--br-bosque-600` `#2F7A4B` | Icono ✓ |
| Llega tarde | `--br-rueda-700` `#A34E16` | Icono de reloj y ruta con trazo discontinuo largo |
| Bloqueado / sin ruta segura | `#B5322A` (rojo ladrillo) | Trazo punteado corto + icono de prohibido |
| Sin iluminación de noche | `#B5322A` | Icono de luna tachada |

### 3.5 Escala de tráfico y sobrecarga

Va del verde del logo al rojo ladrillo, **sin pasar por el naranja**, para no confundirse con la ruta.

| Nivel | Hex | Regla (carga / capacidad) |
|---|---|---|
| Fluido | `#2F7A4B` | ≤ 0,7 |
| Lento | `#C9962A` (ocre) | ≤ 1,0 |
| Denso | `#B5322A` | ≤ 1,25 |
| Saturado | `#6E1E1A` (vino) | > 1,25 |

Para la **sobrecarga del día** (administrador) se usan los mismos cuatro colores: 0 = fluido, y los otros tres en tercios del máximo.

### 3.6 Contraste medido

| Combinación | Contraste | Veredicto |
|---|---|---|
| Bosque `#193A27` sobre blanco | 12,5 : 1 | Texto de cualquier tamaño |
| Blanco sobre bosque | 12,5 : 1 | Texto en botones oscuros |
| Bosque sobre tierra `#F4F1EA` | 11,1 : 1 | Nombres de lugares sobre el mapa |
| Texto suave `#566259` sobre tierra | 5,7 : 1 | Etiquetas secundarias |
| Naranja `#E07A2B` sobre blanco | 3,0 : 1 | **Solo** formas, iconos y ruta; nunca texto pequeño |
| Naranja sobre tierra | 2,7 : 1 | Insuficiente sola → la ruta **siempre** lleva borde verde bosque |
| Naranja texto `#A34E16` sobre blanco | 5,7 : 1 | Texto naranja permitido |
| Salvia `#667F63` sobre blanco | 4,4 : 1 | Iconos e indicaciones grandes |
| Rojo `#B5322A` sobre blanco | 6,1 : 1 | Avisos de bloqueo |
| Blanco sobre manzana `#E9E4D8` | 1,3 : 1 | Insuficiente → las vías **siempre** llevan borde `--map-borde-via` |
| Naranja sobre noche `#0F2318` | 5,5 : 1 | La ruta resalta mejor de noche |
| Bosque sobre naranja | 4,2 : 1 | No alcanza para texto normal → no usar fondos naranjas con texto |

---

## 4. Tipografía

Dos familias, ambas **gratuitas y abiertas** (Google Fonts, licencia SIL Open Font License):

| Rol | Familia | Pesos | Por qué |
|---|---|---|---|
| **Títulos y cifras grandes** | [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) | 800 (ExtraBold) | Gruesa y con carácter; sus curvas acompañan el camino serpenteante del logo sin verse infantil |
| **Texto, etiquetas y controles** | [Inter](https://fonts.google.com/specimen/Inter) | 400, 500, 600, 700 | Muy legible en pantalla y en tamaños pequeños; tiene números tabulares para que las horas queden alineadas |

**Regla de oro:** Bricolage solo en títulos, nombres de marca y cifras grandes (horas del resultado, minutos de viaje). **Nunca** en párrafos, etiquetas del mapa ni botones; todo eso va en Inter.

### 4.1 Escala

| Uso | Familia | Tamaño | Peso | Color |
|---|---|---|---|---|
| Título de tarjeta flotante (lugar, vista de calle) | Bricolage | 17 px | 800 | `--br-bosque` |
| Hora en la barra de tiempo | Bricolage | 22 px | 800, números tabulares | `--br-bosque` |
| Cifra destacada (12 min, 17:12) | Bricolage | 26–44 px | 800, números tabulares | `--br-bosque` |
| Nombre de lugar (origen, destino, seleccionado) | Inter | 13 px | 700 | `--map-texto` |
| Nombre de lugar (resto) | Inter | 12 px | 600 | `--map-texto` |
| Etiqueta de tramo (T01, 400 m) | Inter | 10,5 px | 600 | `--map-texto-suave` |
| Texto de tarjetas, chips y botones | Inter | 13–14,5 px | 500–700 | `--br-bosque` |
| Texto de ayuda | Inter | 12–12,5 px | 500 | `--map-texto-suave` |

### 4.2 Reglas

- Todo texto sobre el mapa lleva **halo** del color del fondo (3–4 px) para leerse encima de vías y manzanas.
- Los textos del mapa mantienen su tamaño en pantalla al hacer zoom (no crecen ni se encogen).
- Horas, minutos y distancias siempre con `font-variant-numeric: tabular-nums`.
- Interlineado: 1,1 en títulos de Bricolage y 1,5 en textos de Inter.
- Bricolage ExtraBold con `letter-spacing: -0.01em` en tamaños de 26 px o más.

### 4.3 Cómo instalarlas

Se instalan como paquetes del proyecto (no desde el CDN de Google), para que funcionen sin internet durante la demo:

```bash
pnpm --dir web add @fontsource-variable/bricolage-grotesque @fontsource-variable/inter
```

```css
@import "@fontsource-variable/bricolage-grotesque";
@import "@fontsource-variable/inter";
```

---

## 5. El mapa, capa por capa

Orden de dibujo, de abajo hacia arriba. Ninguna capa debe tapar a una superior.

| # | Capa | Estilo |
|---|---|---|
| 1 | Tierra | `--map-tierra` |
| 2 | Manzanas | `--map-manzana`, esquinas de 4 px, **sin bordes** |
| 3 | Parques | `--br-salvia-100`; con zoom, siluetas de árboles en `--br-salvia-300` |
| 4 | Agua | `--map-agua`, bordes orgánicos; nombre en cursiva `--br-salvia` |
| 4b | Cobertura (solo usuario) | Halo radial `--br-bosque-600` de ~240 m por lugar y onda que se expande en bucle (3,6 s). Un lugar sin salidas seguras a esa hora muestra un halo rojo ladrillo más pequeño y sin onda |
| 5 | Borde de vías | `--map-borde-via`, 2 px más ancho que la vía a cada lado |
| 6 | Vías | Blanco (ver 5.1) |
| 7 | Ciclorrutas | Línea central (ver 5.1) |
| 8 | Tráfico o sobrecarga | Solo si la capa está activa; reemplaza a la capa 7 |
| 8b | Flujo (solo usuario) | Puntos `--br-bosque-600` que avanzan en el sentido del tramo, solo sobre tramos seguros a esa hora; ciclistas ambiente (círculo `--br-bosque-600` con bici blanca, nunca naranja) recorren algunos tramos seguros |
| 9 | Bloqueos | Punteado rojo + icono |
| 10 | Ruta | Borde bosque + relleno naranja (ver 5.2) |
| 11 | Tramo seleccionado o resaltado | Halo |
| 12 | Etiquetas de tramos | Solo con zoom o si la capa está activa |
| 13 | Lugares y marcadores | Ver 5.3 |
| 14 | Bici en movimiento | Siempre encima de todo |

### 5.1 Vías por tipo

| Tipo (`tramos.tipo`) | Vía | Línea central |
|---|---|---|
| `ciclorruta` | Blanca, 11 px | Salvia `#667F63` continua, 2,5 px |
| `via_mixta` | Blanca, 9 px | Salvia discontinua (6 · 4) |
| `via_no_habilitada` | Gris cálido `#D9D3C4`, 9 px, sin línea central | Icono de bici tachada en el centro (con zoom) |

- **Doble sentido** (dos tramos opuestos entre los mismos puntos): se dibujan como avenida, con dos carriles separados por un hilo de 1 px de `--map-borde-via`.
- **Sentido de circulación:** chevrons pequeños `›` en `--map-texto-suave`, **solo con zoom** (para no ensuciar la vista general).
- Las vías mantienen un **grosor mínimo en pantalla** al alejar el mapa.

### 5.2 Ruta

| Situación | Estilo |
|---|---|
| Ruta recomendada | Borde `--br-bosque` 10 px + relleno `--br-rueda` 6 px, extremos redondeados |
| Ruta que llega tarde | Igual, pero el relleno es discontinuo largo (14 · 6) y aparece la etiqueta "Llega tarde" en `--br-rueda-700` |
| Tramos de la ruta que se bloquean a la hora elegida | Se marcan encima con punteado rojo |
| Resto del mapa cuando hay ruta | Vías y lugares bajan al 70 % de opacidad para que la ruta destaque |
| Aparición | La ruta se "dibuja" tramo a tramo desde el origen (0,25 s por tramo) |
| Ruta viva (usuario) | Al terminar de dibujarse, puntos `--br-rueda-100` avanzan sobre la ruta y la bici en movimiento la recorre en bucle |

### 5.3 Marcadores

| Marcador | Diseño |
|---|---|
| **Destino** | Pin del logo simplificado: silueta verde bosque, arco naranja en la parte superior y punto blanco en el centro. 36 px. Cae con un pequeño rebote al aparecer |
| **Origen** | Círculo blanco de 16 px con anillo verde bosque de 4 px. Usuario: 22 px con anillo de 5 px y pulso suave |
| **Lugar (resto de puntos)** | Por defecto: punto de 8 px en `--br-salvia` con borde blanco. Usuario: estación de 20 px, blanca con anillo salvia y centro `--br-bosque-600`; sin salidas seguras, disco `--estado-bloqueado` con barra blanca (forma, no solo color). Zona táctil de 40 px; crece a 1,3× con resorte al pasar el cursor o enfocar. El nombre aparece con zoom, al pasar el cursor o al enfocar |
| **Lugar seleccionado** | Anillo `--br-bosque-100` de 26 px alrededor del punto |
| **Bici en movimiento** | Círculo naranja `--br-rueda` de 22 px con bici blanca y anillo blanco; estela naranja translúcida detrás |
| **Tramo en vista de calle** | Figura de persona en `--br-rueda` sobre círculo blanco (equivalente al muñeco de Street View) |

---

## 6. Controles y elementos flotantes

Todos comparten: fondo blanco, esquinas de **12 px**, sombra `0 2px 8px rgb(25 58 39 / 0.18)` (verde, no gris) e iconos de trazo 1,8 px en `--br-bosque`.

| Elemento | Ubicación | Notas |
|---|---|---|
| Zoom + / − | Abajo a la derecha | Botones de 48 px apilados |
| Recentrar | Encima del zoom | Encuadra la ruta, o toda la red si no hay ruta |
| Capas | Encima de recentrar | Abre un panel con interruptores (no casillas) |
| Escala | Debajo del zoom | "200 m" con barra en `--br-bosque` |
| Chips de capas rápidas | Arriba a la derecha | Activo: fondo `--br-bosque`, texto blanco. Inactivo: blanco con texto `--br-bosque` |
| Botón "Recorrer la ruta" | Arriba a la izquierda | Relleno `--br-bosque`, texto blanco e icono ▶ naranja. No se usa naranja de fondo con texto: ni blanco (3,0 : 1) ni bosque (4,2 : 1) alcanzan el mínimo de 4,5 : 1 |
| Barra de hora | Abajo, centrada | Pista salvia, tramo nocturno sombreado en `--br-bosque` 25 %, deslizador naranja |
| Leyenda | Abajo a la izquierda, sobre la barra de hora | Solo visible cuando hay una capa de color activa |
| Marca de agua del logo | Abajo a la izquierda | Ver sección 2 |

**Tarjetas flotantes** (lugar al tocar un punto, información al pasar sobre un tramo): fondo blanco, título en Bricolage `--br-bosque` 17 px / 800, texto en Inter y botones en forma de píldora. El botón principal es verde bosque relleno y el secundario tiene borde salvia.

---

## 7. Modo noche

Se activa solo cuando la hora de la red entra en el horario nocturno (`configuracion.inicio_noche`, 18:00).

| Token | Día | Noche |
|---|---|---|
| Tierra | `#F4F1EA` | `#0F2318` |
| Manzanas | `#E9E4D8` | `#16301F` |
| Parques | `#DDE6D8` | `#1C3A28` |
| Agua | `#BFD9D2` | `#0B1A14` |
| Vías | `#FFFFFF` | `#2C4A37` |
| Borde de vías | `#D6CFBF` | `#0A1A10` |
| Texto | `#193A27` | `#EDE8DC` |
| Ruta | Naranja | Naranja con halo luminoso de 4 px al 30 % |

- Los **tramos sin iluminación** se oscurecen con un patrón rayado y el icono de luna tachada, porque de noche no se pueden usar.
- La transición día ↔ noche dura 400 ms.

---

## 8. Interacción

| Acción | Resultado |
|---|---|
| Rueda del mouse sobre el mapa | Acerca o aleja hacia el cursor. La página **no** se desplaza mientras el cursor está sobre el mapa |
| Arrastrar con el mouse | Mueve el mapa |
| Un dedo en celular | Desplaza la página (no mueve el mapa) |
| Botones + / − | Zoom centrado, animado en 0,6 s |
| Tocar un lugar | Tarjeta con "Salir desde aquí" e "Ir hasta aquí" (solo en la vista de usuario) |
| Pasar sobre un tramo | Resaltado y tarjeta con tipo, distancia, carga y estado |
| Tocar un tramo | Abre la vista de calle |

**Movimiento:** curva de salida `cubic-bezier(0.16, 1, 0.3, 1)`. Si el sistema pide reducir movimiento, todo aparece sin animación.

---

## 9. Vista de calle

Debe hablar el mismo idioma visual:

- **Cielo:** de día, crema `#F4F1EA` a salvia claro; de noche, verde bosque profundo con estrellas.
- **Edificios:** siluetas en `--br-salvia` y `--br-bosque`, como la ciudad del logo.
- **Ciclorruta:** carril en `--br-bosque-600` con bici blanca pintada.
- **Faroles:** luz cálida naranja clara (`#FFD9B0`).
- **Bloqueos:** barrera con franjas blancas y rojo ladrillo `#B5322A`, no naranja.
- **Panel inferior:** fondo `--br-bosque-900` y textos `#EDE8DC`.

---

## 10. Pendientes y decisiones abiertas

- [ ] **Logo en SVG** para el marcador de destino y la marca de agua.
- [x] **Resto de la aplicación:** se aplicó la paleta del logo y las fuentes Bricolage/Inter a toda la app. Los nombres de color que usan las vistas (`navy`, `blue`, `amber`, `rose`) se conservaron en `web/src/index.css`, pero ahora apuntan a los colores de la marca.
- [ ] Confirmar con el equipo si "Llega tarde" debe ser naranja oscuro (propuesta actual) o un color propio.
- [ ] Revisar el diseño en celular una vez aplicado.

---

## 11. Tokens listos para el código

```css
:root {
  /* Logo */
  --br-bosque: #193a27;
  --br-rueda: #e07a2b;
  --br-salvia: #667f63;
  --br-camino: #ffffff;

  /* Derivados */
  --br-bosque-900: #0f2318;
  --br-bosque-600: #2f7a4b;
  --br-bosque-100: #e3ece5;
  --br-rueda-700: #a34e16;
  --br-rueda-300: #f2a462;
  --br-rueda-100: #fcebdd;
  --br-salvia-300: #a9bba6;
  --br-salvia-100: #dde6d8;

  /* Mapa (día) */
  --map-tierra: #f4f1ea;
  --map-manzana: #e9e4d8;
  --map-agua: #bfd9d2;
  --map-borde-via: #d6cfbf;
  --map-texto: #193a27;
  --map-texto-suave: #566259;

  /* Estados */
  --estado-a-tiempo: #2f7a4b;
  --estado-tarde: #a34e16;
  --estado-bloqueado: #b5322a;

  /* Tráfico */
  --trafico-fluido: #2f7a4b;
  --trafico-lento: #c9962a;
  --trafico-denso: #b5322a;
  --trafico-saturado: #6e1e1a;

  /* Tipografía */
  --fuente-titulo: "Bricolage Grotesque Variable", "Bricolage Grotesque", system-ui, sans-serif;
  --fuente-texto: "Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;

  /* Forma */
  --radio-control: 12px;
  --sombra-control: 0 2px 8px rgb(25 58 39 / 0.18);
}
```
