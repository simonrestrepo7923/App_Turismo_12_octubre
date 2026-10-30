# Ruta Doce de Octubre

Aplicación web de turismo y recorridos comunitarios por el barrio Doce de Octubre, Comuna 6 de Medellín. Funciona en el celular (se puede instalar como app y usar sin conexión) y en el computador (con su propio diseño de pantalla grande).

Permite explorar recorridos temáticos, verlos sobre el **mapa real de OpenStreetMap**, llegar a cada punto con **rutas a pie y GPS**, escanear las placas QR, consultar las fichas de los lugares (también sin conexión), valorar la experiencia y, para el administrador, gestionar los contenidos y generar reportes.

Construida con **React 19 + TypeScript + Vite + Tailwind CSS 4 + Leaflet**.

## Cómo ejecutarla

Requisitos: [Node.js](https://nodejs.org/) 20.19 o superior (recomendado 22 LTS).

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto 3000 |
| `npm run build` | Revisa los tipos y genera la versión de producción en `dist/` (incluye el service worker) |
| `npm run preview` | Sirve la versión de producción en el puerto 4173 (aquí sí funciona el modo sin conexión) |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run lint` | Revisión de tipos de TypeScript |

### Abrirla desde el celular

- **GPS, cámara (escáner QR) e instalación** solo funcionan con **HTTPS** o en `localhost` (es una regla de los navegadores).
- En la misma red Wi‑Fi puedes abrir `http://<IP-de-tu-computador>:3000`. Todo funciona, pero sin GPS ni cámara: la app usa una ubicación simulada y el código manual del escáner.
- Para probarla con GPS y cámara reales, publícala con HTTPS. Como usa rutas relativas y `#/` en la URL, sirve en cualquier hosting estático. Por ejemplo, Netlify Drop (arrastra la carpeta `dist/`) o GitHub Pages (sube el contenido de `dist/`).

### Instalarla como app

Ya publicada con HTTPS:
- **Android / Chrome / Edge:** botón «Instalar» en Inicio, en el menú lateral (computador) o en Perfil → Cuenta.
- **iPhone / iPad (Safari):** Compartir → «Agregar a pantalla de inicio». La app muestra estas instrucciones.

## Cuentas de prueba

En la pantalla de ingreso, en «Cuentas de prueba», se autocompletan:

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Turista | `caminante@comuna6.org` | `Caminante123` |
| Administrador | `admin@comuna6.org` | `Admin12345` |

También puedes crear una cuenta o entrar como «visitante libre» (sin favoritos, valoraciones ni sellos).

## Novedades de la versión 2

### Mapa, rutas y GPS
- Mapa real de **OpenStreetMap** (servidor oficial, sin clave) con 22 lugares reales de la Comuna 6 ubicados con sus coordenadas. Se arrastra, se acerca con pellizco o rueda y muestra una escala.
- **Rutas a pie por las calles** calculadas con OSRM (perfil peatonal). Incluyen distancia, tiempo e **indicaciones paso a paso en español** («Gira a la derecha por Calle 104»). El trazado de cada recorrido también sigue las calles.
- **GPS real**: marcador con círculo de precisión y dirección de avance. El mapa sigue tu posición mientras navegas.
- **Recálculo automático** si te desvías más de 35 m de la ruta, y **aviso de llegada** (con vibración) a menos de 20 m.
- Si estás lejos del barrio, la app lo detecta y ofrece «Simular que estoy allí». Sin GPS, «Simular caminata» recorre la ruta.
- **Sin conexión**: si las teselas no cargan se muestra el plano ilustrado del barrio, y si el servicio de rutas no responde se usa una ruta aproximada. «Guardar sin conexión» en un recorrido descarga sus fichas, la ruta, el mapa de la zona y las fotos.
- El administrador ubica los puntos tocando el mapa, escribiendo las coordenadas o con su GPS si está en el lugar.

### Cuentas
- Contraseñas con **sal y SHA-256 iterado**. Las cuentas de la versión anterior se actualizan solas al iniciar sesión.
- Registro con **lista de requisitos en vivo** (8 caracteres, letra y número), indicador de fortaleza y **confirmación de contraseña**.
- **Bloqueo temporal de 60 s** tras 5 intentos fallidos, avisando cuántos quedan.
- «**Recordarme en este dispositivo**»: si no se marca, la sesión se cierra al cerrar la pestaña.
- **Recuperación de contraseña** con código de 6 dígitos que vence en 10 minutos, máximo 5 intentos y reenvío cada 30 s. La respuesta no revela si el correo existe.
- **Perfil → Cuenta**: editar el nombre, cambiar la contraseña (pide la actual), abrir el buzón y activar o desactivar el GPS.
- **Buzón de demostración**: como no hay servidor de correo, los correos (bienvenida, código de recuperación, aviso de cambio de contraseña) se leen dentro de la app.

### Celular y computador
- **Computador (≥ 1024 px):** menú lateral fijo, inicio a dos columnas, explorador en cuadrícula, ficha con galería fija, mapa con panel lateral (lista de paradas y navegación) e ingreso a pantalla dividida.
- **Celular:** barra inferior, hoja inferior en el mapa que se adapta a su contenido, áreas táctiles de 44 px y soporte para el notch (safe areas).
- **App instalable (PWA)** con funcionamiento sin conexión: la app, las fuentes y los íconos quedan guardados desde la primera visita, y avisa cuando hay una versión nueva.

### Calidad y rendimiento
- Mapa y panel de administración se cargan solo cuando se abren, en archivos separados.
- Los íconos se descargan como un **subconjunto de ~140 íconos** en lugar de la fuente completa (~3,7 MB). Al compilar se avisa si algún ícono no existe.
- Manejo de errores por pantalla (la app no queda en blanco), título de pestaña por pantalla y enlace «Saltar al contenido».
- **Migración automática** de los datos guardados por la versión 1.
- **20 pruebas unitarias** (`npm test`) de contraseñas, recuperación, distancias, avance sobre la ruta, interpretación de rutas OSRM, códigos QR y reportes.

## Estructura

```
src/
├── App.tsx                 Rutas, estructura de pantallas (celular / computador) y carga diferida
├── config.ts               Servicios externos (rutas y teselas), configurables con .env.local
├── types.ts                Modelo de datos
├── data/                   Lugares reales de la Comuna 6 (5 recorridos, 22 puntos con dirección y coordenadas)
├── store/
│   ├── AppStore.tsx        Contenidos, cuentas, recuperación, valoraciones y visitas (+ migración)
│   ├── LocationContext.tsx GPS real, precisión, rumbo y ubicación simulada
│   └── AudioContext.tsx    Reproductor de audioguía
├── services/
│   ├── auth.ts             Contraseñas, validaciones, códigos de recuperación
│   ├── routing.ts          Rutas a pie con OSRM e instrucciones en español
│   ├── offline.ts          Descarga de recorridos para usar sin conexión
│   ├── qr.ts · reports.ts  Códigos QR y reportes PDF
├── lib/                    Geolocalización, SHA-256, enrutador, PWA, formatos
├── components/
│   ├── map/LeafletMap.tsx  Mapa real (pines, trazados, ubicación, respaldo sin conexión)
│   ├── layout/             Menú lateral (computador), barras superior e inferior (celular)
│   └── …                   Contraseñas, buzón, valoraciones, modales, escáner QR…
├── views/                  Pantallas (inicio, explorar, recorrido, ficha, mapa, perfil, ingreso, admin)
└── __tests__/              Pruebas unitarias
pwa/sw-template.js          Plantilla del service worker (vite.config.ts genera dist/sw.js)
public/                     Manifiesto e íconos de la app
```

## Historias de usuario: dónde está cada una y cómo probarla

| HU | Escenario | Dónde | Cómo probarlo |
| --- | --- | --- | --- |
| **CONS-001** Consultar recorridos | 1. Listado por categoría | Inicio · Explorar | Toca «Gastronómicos» en Inicio: Explorar abre filtrado. |
| | 2. Detalle del recorrido | `TourDetailView` | Abre un recorrido: descripción, duración, distancia y puntos. |
| **MAPA-001** Mapa interactivo | 1. Puntos geolocalizados | `MapView` + `LeafletMap` | «Ver en el mapa»: pines numerados sobre OpenStreetMap y trazado por las calles. |
| | 2. Ubicación en tiempo real | `LocationContext` | «Activar GPS»: tu posición real con su precisión. Lejos del barrio puedes simular que estás allí. |
| **GEO-001** Indicaciones | 1. Cálculo de ruta | `MapView` + `services/routing.ts` | «Cómo llegar»: ruta por las calles con metros, minutos e indicaciones. |
| | 2. Actualización al desplazarse | `MapView` | Con GPS la distancia baja sola, la ruta se recalcula si te desvías y avisa al llegar. Sin GPS: «Simular caminata». |
| **FICHA-001** Ficha de un punto | 1. Ficha completa | `PointDetailView` | Galería, relato, audio, datos y valoraciones. |
| | 2. Sin conexión | `PointDetailView` · `services/offline.ts` | Abre una ficha y luego, en DevTools → Network → *Offline*, ábrela otra vez: muestra lo guardado. «Guardar sin conexión» en un recorrido descarga todo. |
| **QR-001** Escanear QR | 1. Escaneo exitoso | `QrScannerModal` → `#/qr/<código>` | Cámara, código manual (`QR-DOCE-02`) o los códigos de demostración: abre la ficha y sella la visita. |
| | 2. Código no reconocido | `QrScannerModal` · `QrResolveView` | «Simular código dañado» o `#/qr/QR-FALSO`: mensaje y búsqueda manual. |
| **VAL-001** Valorar | 1. Registrar calificación | `ReviewsSection` | Estrellas + comentario en una ficha o recorrido (requiere sesión). |
| | 2. Valoraciones previas | `ReviewsSection` | Promedio, distribución y comentarios de otros visitantes. |
| **BUSC-001** Buscar y filtrar | 1. Categoría y duración | `ExploreView` | Combina categoría, duración, distancia y dificultad. |
| | 2. Sin resultados | `ExploreView` | «Gastronómicos» + «< 1 h»: mensaje y filtros que puedes quitar. |
| **PERFIL-001** Cuentas | 1. Registro exitoso | `AuthView` | «Crear cuenta» valida los campos y lleva a la pantalla principal. |
| | 2. Credenciales incorrectas | `AuthView` | Mensaje de error con intentos restantes y bloqueo temporal. «¿Olvidaste tu contraseña?» abre la recuperación. |
| **ADMIN-001** Crear recorridos | 1. Creación | `admin/TourFormView` | Panel → «Nuevo recorrido»: aparece de inmediato en Explorar. |
| | 2. Campos obligatorios | `admin/TourFormView` | Guarda vacío: lista los campos que faltan. |
| **ADMIN-002** Actualizar puntos | 1. Edición | `admin/PointFormView` | Relato, imágenes y ubicación en el mapa real. |
| | 2. Eliminación | `admin/AdminView` | Se retira del mapa y de todos sus recorridos. |
| **ADMIN-003** QR de un punto | 1. Generación | `admin/QrDialog` | «Panadería La Curva» no tiene QR: «Generar código QR». |
| | 2. Descarga | `admin/QrDialog` | PNG listo para imprimir. |
| **REP-001** Reportes | 1. Reporte | `admin/ReportsPanel` | Recorrido + fechas: promedio, valoraciones, visitas y detalle por punto. |
| | 2. Exportación | `admin/ReportsPanel` | «Exportar a PDF». |

## Base de datos (Supabase)

Si existe el archivo `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, la app guarda todo en **Supabase**: cuentas, recorridos, puntos, valoraciones, visitas y favoritos se comparten entre todos los usuarios y dispositivos. Sin ese archivo, todo se guarda en el navegador como antes (modo demostración).

Para preparar la base de datos:
1. En Supabase abre **SQL Editor**, pega el contenido de `supabase/esquema.sql` y dale **Run** (crea las tablas, los permisos y los 22 lugares y 5 recorridos; se puede correr de nuevo sin problema).
2. En **Authentication → Sign In / Providers → Email**, apaga **Confirm email** para que las cuentas queden activas al registrarse.
3. Para recuperar la contraseña, Supabase manda un correo con un **enlace**. Al abrirlo (en el mismo navegador donde se pidió) la app muestra el formulario para la nueva contraseña. En **Authentication → URL Configuration**, el **Site URL** debe ser la dirección de la app (por defecto `http://localhost:3000`).
4. Regístrate en la app y, en **Table Editor → perfiles**, cambia tu `rol` a `admin`.

El correo que trae Supabase por defecto solo envía a los correos del equipo del proyecto y unos pocos por hora. Para enviar a cualquier persona hay que configurar un SMTP propio (Authentication → Emails → SMTP).

## Configuración opcional

Crea un archivo `.env.local` (ver `.env.example`) para usar otros servidores:

```
VITE_ROUTING_URL=https://routing.openstreetmap.de/routed-foot
VITE_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

## Datos y alcance de esta versión

- **No hay servidor.** Contenidos, cuentas, valoraciones y visitas se guardan en el `localStorage` del navegador. El administrador puede volver al contenido original con «Restablecer datos de demostración». Para producción, cuentas y datos deben pasar a un backend y los correos enviarse de verdad.
- **Servicios externos gratuitos:** las rutas usan el servidor público OSRM de FOSSGIS y el mapa usa el servidor de teselas de OpenStreetMap (CARTO dejó de ser gratuito: ahora exige clave). Ambos tienen límites de uso pensados para proyectos pequeños. Para mucho tráfico conviene un servidor propio, configurable sin tocar el código.
- **Lugares reales:** los 22 puntos son lugares que existen en la Comuna 6 (parques, templos, Casa de la Cultura, Parque Biblioteca, estaciones del Metrocable, Cerro El Picacho, restaurantes y panaderías), con su dirección y coordenadas. Los restaurantes y panaderías son negocios privados: sus horarios pueden cambiar.
- **Fuentes de los lugares** (consultadas en octubre de 2026): [Alcaldía de Medellín – Cerro El Picacho](https://www.medellin.gov.co/es/secretaria-medio-ambiente/medellin-biodiversa/cerro-el-picacho/), [Alcaldía de Medellín – Comuna 6](https://www.medellin.gov.co/es/wp-content/uploads/2025/10/Comuna-6.pdf), [Metro de Medellín – Línea P](https://metrodemedellin.gov.co/en/users/integrated-system/line-p), [comunasdemedellin.com – Comuna 6](https://comunasdemedellin.com/comuna-6-doce-de-octubre), [El Colombiano – Parque Biblioteca](https://www.elcolombiano.com/cultura/un-parque-periscopio-desde-el-que-mira-el-doce-de-octubre-YI2039809), [Wikipedia – Doce de Octubre](https://es.wikipedia.org/wiki/Doce_de_Octubre_(Medell%C3%ADn)) y las fichas públicas de Google Maps de cada lugar (direcciones y coordenadas).
- **Audio y fotos:** la reproducción de audio es simulada, porque los relatos aún no están grabados. Las fotos son **ilustrativas** (vienen del prototipo de diseño), no fotografías de cada lugar; si alguna falla, se muestra un fondo de respaldo.
