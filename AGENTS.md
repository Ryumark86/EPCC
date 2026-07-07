# FR-SST-003 - Inspección EPCC

## Descripción

PWA (Progressive Web App) para diligenciar, guardar localmente y exportar en PDF real el formato **FR-SST-003** de SITOC para inspección de Equipos de Protección Contra Caídas. Funciona offline gracias a un Service Worker.

## Stack

- **HTML5 + CSS3 vanilla** — sin frameworks ni librerías externas
- **JavaScript vanilla** (IIFE) — sin dependencias
- **Canvas API** — firma digital y estampado de fotos con metadatos
- **localStorage** — persistencia local de registros e historial descargable
- **Service Worker** (`sw.js`) — caché offline con strategy stale-while-revalidate
- **Manifest** (`manifest.json`) — instalable en dispositivos móviles

## Estructura

```
EPCC/
├── index.html        # HTML limpio
├── styles.css        # Todos los estilos
├── app.js            # Todo el JS en IIFE
├── manifest.json     # Configuración PWA
├── sw.js             # Service Worker (caché offline)
├── icon.svg          # Icono PWA local (escudo + check)
└── AGENTS.md         # Este archivo
```

## Convenciones

- **JS modular** — `app.js` envuelto en IIFE `(function () { 'use strict'; ... })();`
- **CSS externo** — `styles.css` con variables CSS, estilos de formulario, pending-bar, toast tipos, etc.
- **LocalStorage key** — `sitoc_epcc_v2` (JSON array de registros)
- **LocalStorage pending key** — `sitoc_epcc_pendientes` (cola de reintentos)
- **Navegación** — 2 pantallas (`form` y `historial/detalle`) controladas por `showScreen(name)`
- **Firma** — exportada como `image/jpeg` con fondo blanco vía `canvasToJpeg()` (pixel-level, sin alpha)
- **Fotos** — se estampan con fecha, GPS y sitio, guardadas como `image/jpeg` base64 comprimido 55%
- **PDF** — generado 100% vanilla (especificación PDF 1.4), objetos, streams, xref, DCTDecode para imágenes
- **Sin tests** — no hay suite de pruebas configurada

## Funcionalidades clave

1. Formulario con datos de control, técnicos evaluados (dinámicos), cada técnico con equipos (3 por defecto: Arnés CC, Eslinga Y, Eslinga P), características SI/NO por equipo, "No aplica" checkbox, fotos FHD (1920px) con metadatos quemados (fecha+GPS+obra) a nivel de técnico, lista de verificación de componentes y firma digital por técnico
2. Múltiples técnicos por inspección con añadido dinámico
3. Firma digital en canvas (touch y mouse) con verificación de vacío (inspector y por técnico)
4. Captura de fotos con geolocalización obligatoria y estampado en lienzo a 1920px JPEG 55%
5. Generación de PDF real con texto + fotos JPEG + firmas (sin librerías externas, usando especificación PDF 1.4)
6. Envío del PDF por Telegram Bot API (`sendDocument` con FormData)
7. Descarga local del PDF al guardar
8. Guardado en localStorage con historial descargable (JSON)
9. Vista detalle con botones "Exportar PDF" y "Enviar Reporte por Telegram"
10. Offline-first con Service Worker (network-first para navegación, stale-while-revalidate para assets)
11. Cola de pendientes con vista y eliminación individual
12. Compatibilidad hacia atrás con registros legacy (formato `r.equipos[]`)

## PDF Generator (`generarPDF(r)`)

- Páginas A4 (595×842) con márgenes 45/45/50/50
- Texto usa Helvetica/Helvetica-Bold con **`/Encoding /WinAnsiEncoding`** explícito
- Caracteres especiales (ÁÉÍÓÚÑ¿¡°ªº) escapados como octales PDF
- Líneas de estado con color: verde (`0 0.55 0 rg`) para CONFORME/Sin defectos, rojo (`0.8 0 0 rg`) para NO CONFORME/Defectos
- Imágenes (fotos + firmas) en páginas separadas, 4 por página en grilla 2×2
- Fotografías embebidas como JPEG DCTDecode, firmas JPEG exportadas con `canvasToJpeg()` (pixel iteration, fondo blanco garantizado)
- Duplicados eliminados por matching de base64 completo
- Páginas numeradas con pie "Página X de Y | Generado: fecha"

## Convenciones de código

- No usar librerías externas
- Las funciones expuestas globalmente se asignan al final de `app.js`
- Las características de certificación (Elemento certificado, Tiene etiqueta, La etiqueta es legible, Buen estado general) están incrustadas en cada bloque de equipo con SI/NO toggle, default SI
- Funciones de características: `window._setEqCaract(eqUid, name, val)` — busca el equipo en todos los técnicos
- Funciones de técnico: `window.agregarTecnico()`, `window._eliminarTec(btn)`, `window._agregarEq(btn)`, `window._eliminarEq(btn)`
- Funciones de equipo: `window._toggleNoAplica(chk, eqUid)` — oculta/deshabilita campos
- Fotos por técnico: `window._capturarFotoTec(input, tecUid)` — FHD (1920px máx, JPEG 55%)
- Firma por técnico: `window._limpiarFirmaTec(tecUid)` — canvas ID `firmaTec-{tecUid}`
- Canvas de firma con `willReadFrequently: true` y ancho mínimo 200px (`clientWidth < 200 ? 200 : clientWidth`)
- Las funciones de pending usan prefijo `window._` (ej. `window._viewPending`, `window._deletePending`)
- Las fotos se almacenan como base64 JPEG comprimido al 55% con metadatos visibles, max 1920px
- El buscador de GPS es obligatorio para certificar cada foto
- Los técnicos se identifican por `data-tecuid`, equipos por `data-equid` (timestamp + random)
- `formState.tecnicos[]` = array de objetos `{ uid, nombre, cedula, telefono, equipos[], fotos[], malEstado{}, firma }`
- Cada equipo en `formState`: `{ uid, nombre, marca, serial, lote, fecha, caracts{}, noAplica }`
- Registros legacy (anteriores a este cambio) se renderizan con `renderLegacyEquipos()` para mantener compatibilidad
