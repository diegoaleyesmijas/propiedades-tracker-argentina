# 🏠 Propiedades Tracker

App simple para ordenar la búsqueda de propiedades: guardar links con foto, precio, m², ambientes, notas y estado.

## Funciones
- **Cards visuales** con foto, precio, m², ambientes y link al aviso
- **Estados de color:** 🟢 Interesa · 🔵 Visitada · 🔴 Descartada (las descartadas se atenúan)
- **Notas editables** visibles en cada card + fecha de visita/agregado
- Filtros por estado, tags y búsqueda por texto. Orden por precio o fecha
- **Bookmarklet**: estando en Zonaprop/IOL/Argenprop, un clic guarda la propiedad (título, precio, foto, m²) capturado desde tu propia pestaña — evita el bloqueo de Cloudflare
- Si envías la misma URL 2 veces, se actualiza en vez de duplicar

## Uso local
```bash
npm install
npm start        # http://localhost:3000
```

## Bookmarklet
1. Abrí la app → botón **📌 Bookmarklet**
2. Arrastrá el botón verde **"＋ Guardar en Tracker"** a la barra de marcadores
3. En la propiedad, clic al marcador → se guarda acá

> El bookmarklet usa la URL donde esté corriendo la app (localhost o el dominio de producción). Si la abrís desde otra PC con la URL pública, genera el bookmarklet desde ahí.

## API
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/propiedades` | listar (filtros: `q`, `estado`, `tag`, `orden=precio`) |
| POST | `/api/propiedades` | crear/actualizar por URL |
| PATCH | `/api/propiedades/:id` | actualizar estado/notas/tags/… |
| DELETE | `/api/propiedades/:id` | borrar |

## Estructura
- `index.js` — servidor Express + API REST
- `db.js` — SQLite (tabla `propiedades`), datos en `./data`
- `public/` — dashboard (vanilla JS, sin build)
- `bookmarklet.html` — código del bookmarklet para generar a mano si hace falta

## Datos
La base SQLite vive en `data/propiedades.db` (no va a git). Backup: copiar ese archivo.
