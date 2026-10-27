# 🏠 Propiedades Tracker

App simple para ordenar la búsqueda de propiedades: guardar links con foto, precio, m², ambientes, notas y estado.

## Funciones
- **Alta rápida:** pegás el link en la barra de arriba y Enter — ficha creada
- **Captura pegable:** ponés el mouse sobre la tarjeta y Ctrl/Cmd+V pega una captura de pantalla como portada (o clic y luego paste). También acepta foto vía `og:image` del bookmarklet
- **Estados separados en dos dimensiones:** *Me interesa / Descartar* (toggle excluyente) y *Visitada* (booleano con fecha) — una ficha puede estar visitada e igual interesar
- **Cards visuales:** foto, precio, **expensas**, m², ambientes, dirección, tags y link al aviso
- **Notas editables** visibles en cada card + fecha de visita/agregado
- Filtros por interés, visitada, tags y búsqueda por texto. Orden por precio o fecha
- **Bookmarklet**: estando en Zonaprop/IOL/Argenprop, un clic guarda la propiedad (título, precio, foto, m²) capturado desde tu propia pestaña — evita el bloqueo de Cloudflare
- Si envías la misma URL 2 veces, se actualiza en vez de duplicar

## Uso local
```bash
npm install
npm start        # http://localhost:3000
```

## Arranque automático (esta máquina)
Servicio systemd de usuario, ya instalado en `~/.config/systemd/user/` con **linger** (arranca al prender la máquina, sin abrir sesión):
```bash
systemctl --user status propiedades-tracker    # estado
systemctl --user restart propiedades-tracker   # reiniciar
journalctl --user -u propiedades-tracker -f    # logs
```
Acceso desde otra PC de la red: `http://192.168.1.15:3000` (IP local; si cambia, actualizar).

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
| POST | `/api/propiedades/:id/foto` | subir captura (dataURL base64, comprimida en el cliente) |
| GET | `/api/propiedades/:id/foto` | bajar la captura guardada |
| DELETE | `/api/propiedades/:id` | borrar |

## Estructura
- `index.js` — servidor Express + API (escucha local; exportado para serverless)
- `store.js` — capa de datos unificada: `@libsql/client` (Turso) si hay `TURSO_DATABASE_URL`, si no `better-sqlite3` local
- `public/` — dashboard (vanilla JS, sin build)
- `api/index.js` + `vercel.json` — entrypoint serverless para Vercel

## Deploy en Vercel + Turso (online, gratis)
Vercel no tiene disco, por eso la DB y las capturas viven en **Turso** (libSQL compatible con SQLite, plan gratis generoso).

1. **Turso:** `https://portal.turso.net` → crear DB (ej: `propiedades`) → copiar `URL` y crear `token`
2. **Import a Git Repository** con este repo desde https://vercel.com/new
3. En **Environment Variables** pegar:
   - `TURSO_DATABASE_URL` = la URL de Turso (`libsql://propiedades-....turso.io`)
   - `TURSO_AUTH_TOKEN` = el token generado
4. Deploy. La app queda en `https://<algo>.vercel.app`

El mismo código en tu máquina **sigue andando en SQLite local** (sin env vars) — la app local y el despliegue de Vercel son dos bases de datos independientes. Dashboard, API y lógica son idénticos.

## Deploy en Render
1. https://dashboard.render.com → **New + → Blueprint** → elegir este repo
2. Acepta automáticamente `render.yaml` (crea el servicio y el disco persistente montado en `/data`) — en el plan Starter (USD 7/mes)
3. Alternativa 100% gratis: Vercel + Turso (arriba)

## Datos
La base SQLite vive en `data/propiedades.db` (no va a git). Backup: copiar ese archivo.
