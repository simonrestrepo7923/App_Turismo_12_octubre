# Ruta Doce de Octubre

App web de turismo para recorrer a pie la Comuna 6 (Doce de Octubre) de Medellín. Funciona en el celular (se puede instalar como app y usar sin internet) y en el computador.

El visitante puede:
- ver 5 recorridos con 22 lugares reales de la comuna;
- verlos en el **mapa real de OpenStreetMap**;
- llegar a cada lugar con **rutas a pie y GPS**;
- escanear el código QR de cada lugar;
- leer la ficha de cada lugar (también sin internet);
- dejar calificaciones y comentarios.

El administrador puede crear y editar recorridos y lugares, generar los códigos QR y sacar reportes en PDF.

Los datos se guardan en una base de datos en la nube (**Supabase**), así que todos los usuarios ven lo mismo desde cualquier celular o computador.

Hecha con **React 19 + TypeScript + Vite + Tailwind CSS 4 + Leaflet + Supabase**.

## Cómo ejecutarla

Necesitas [Node.js](https://nodejs.org/) 20.19 o superior (recomendado 22).

1. Descarga el proyecto:
   ```bash
   git clone https://github.com/simonrestrepo7923/App_Turismo_12_octubre.git
   cd App_Turismo_12_octubre
   ```
2. Crea un archivo llamado **`.env.local`** en la carpeta del proyecto con la conexión a la base de datos (ver la sección [Base de datos](#base-de-datos-supabase)):
   ```
   VITE_SUPABASE_URL=https://wmlumlenmcondozipzoh.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_c0WJG3KDJjpKRn7ahVx_WA_fxgHH_Wi
   ```
   Este archivo no se sube a GitHub, por eso hay que crearlo a mano. La clave es la **pública**: se puede compartir. Nunca pongas aquí la clave secreta (`sb_secret_...`).
3. Instala y arranca:
   ```bash
   npm install
   npm run dev
   ```
4. Abre <http://localhost:3000>.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Abre la app para desarrollo en el puerto 3000 |
| `npm run build` | Revisa el código y crea la versión final en `dist/` |
| `npm run preview` | Abre la versión final en el puerto 4173 (aquí funciona el modo sin internet) |
| `npm test` | Corre las pruebas automáticas |
| `npm run lint` | Revisa los tipos de TypeScript |

### Dos formas de funcionar

| | Con `.env.local` (base de datos) | Sin `.env.local` (demostración) |
| --- | --- | --- |
| Dónde se guardan los datos | En Supabase (nube) | Solo en el navegador |
| Lo ven otros usuarios | Sí | No |
| Cuentas | Cada persona se registra | Hay cuentas de prueba listas |
| Recuperar contraseña | Llega un correo real con un enlace | El código llega a un buzón dentro de la app |
| Reseñas y visitas de ejemplo | No, solo las reales | Sí, para que los reportes tengan datos |

**Cuentas de prueba** (solo sin `.env.local`):

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Turista | `caminante@comuna6.org` | `Caminante123` |
| Administrador | `admin@comuna6.org` | `Admin12345` |

## Base de datos (Supabase)

### Preparar el proyecto de Supabase (una sola vez)

1. **Crear las tablas.** En Supabase abre **SQL Editor** (ícono `>_`), pega todo el contenido de [`supabase/esquema.sql`](supabase/esquema.sql) y dale **Run**. Crea las tablas, los permisos y carga los 22 lugares y 5 recorridos. Se puede correr otra vez sin dañar nada.
2. **Apagar la confirmación por correo.** En **Authentication → Sign In / Providers → Email**, apaga **Confirm email** y dale **Save**. Así las cuentas quedan listas apenas se registran.
3. **Revisar la dirección de la app.** En **Authentication → URL Configuration**, el **Site URL** debe ser la dirección donde abres la app (`http://localhost:3000` en tu computador). El enlace del correo de recuperación lleva a esa dirección.
4. **Crear el administrador.** Regístrate en la app. Luego, en **Table Editor → perfiles**, cambia tu `rol` de `turista` a `admin`. Cierra sesión y vuelve a entrar.

### Tablas

| Tabla | Qué guarda |
| --- | --- |
| `perfiles` | Nombre y rol (`turista` o `admin`) de cada usuario. Se crea sola al registrarse. El correo y la contraseña los guarda Supabase |
| `lugares` | Los lugares: nombre, relato, categoría, dirección, coordenadas y código QR |
| `recorridos` | Los recorridos: título, descripción, distancia, duración y dificultad |
| `recorrido_lugares` | Qué lugares tiene cada recorrido y en qué orden |
| `resenas` | Calificaciones (1 a 5 estrellas) y comentarios |
| `visitas` | Recorridos iniciados y lugares «sellados» por cada usuario |
| `favoritos` | Recorridos que cada usuario guardó |

### Quién puede hacer qué

| | Visitante sin cuenta | Turista | Administrador |
| --- | --- | --- | --- |
| Ver lugares, recorridos y reseñas | ✔ | ✔ | ✔ |
| Dejar reseñas, sellar visitas y guardar favoritos | | ✔ (solo las suyas) | ✔ |
| Crear, editar y borrar lugares y recorridos | | | ✔ |
| Ver las visitas de todos (para los reportes) | | | ✔ |

Nadie puede cambiarse el rol a sí mismo desde la app: eso solo se hace en Supabase.

### Recuperar la contraseña

1. En la app: «¿Olvidaste tu contraseña?» → escribir el correo → **Enviar enlace**.
2. Llega un correo de Supabase con un enlace. Hay que abrirlo **en el mismo navegador** donde se pidió.
3. La app se abre en una pantalla para escribir la nueva contraseña.

El correo gratis de Supabase **solo llega a los correos del equipo del proyecto** (Organization → Team) y unos 2 por hora. Para que llegue a cualquier persona hay que configurar un servicio de correo propio en **Authentication → Emails → SMTP**.

### Volver al modo demostración

Borra o renombra el archivo `.env.local` y vuelve a ejecutar `npm run dev`.

## Funciones principales

### Mapa, rutas y GPS
- Mapa real de **OpenStreetMap** (gratis, sin clave) con los 22 lugares en sus coordenadas.
- **Rutas a pie por las calles** con distancia, tiempo e **indicaciones en español** («Gira a la derecha por Calle 104»). Se calculan con OSRM.
- **GPS real** con círculo de precisión. El mapa sigue tu posición.
- Si te desvías más de 35 m, **la ruta se recalcula sola**. A menos de 20 m del lugar, **avisa que llegaste** (con vibración).
- Si estás **fuera de Antioquia**, la app ofrece «Simular que estoy allí». Dentro de Antioquia siempre usa tu ubicación real. «Simular caminata» recorre la ruta sin moverte (útil para mostrar la app).
- **Sin internet**: si el mapa no carga se ve un plano ilustrado, y si el servicio de rutas no responde se traza una ruta aproximada. «Guardar sin conexión» en un recorrido descarga sus fichas, la ruta, el mapa de la zona y las fotos.

### Cuentas
- Registro con requisitos de contraseña a la vista (8 caracteres, una letra y un número) y confirmación.
- **Bloqueo de 60 s** después de 5 intentos fallidos, avisando cuántos quedan.
- Recuperar contraseña (ver arriba).
- **Perfil → Cuenta**: cambiar el nombre, cambiar la contraseña (pide la actual) y prender o apagar el GPS.

### Celular y computador
- **Computador:** menú lateral, pantallas a dos columnas y mapa con panel al lado.
- **Celular:** barra inferior y panel que sube desde abajo en el mapa.
- **Se puede instalar como app** y abre sin internet después de la primera visita.

## Estructura

```
src/
├── App.tsx                 Pantallas, menús (celular / computador) y avisos
├── config.ts               Servicios de mapa y rutas
├── types.ts                Forma de los datos
├── data/                   22 lugares reales y 5 recorridos (datos iniciales)
├── store/
│   ├── AppStore.tsx        Datos de la app: cuentas, contenido, reseñas, visitas (navegador o Supabase)
│   ├── LocationContext.tsx GPS y ubicación simulada
│   └── AudioContext.tsx    Reproductor de audio
├── services/
│   ├── supabase.ts         Conexión con la base de datos
│   ├── auth.ts             Reglas de contraseñas (modo demostración)
│   ├── routing.ts          Rutas a pie e indicaciones en español
│   ├── offline.ts          Descarga de recorridos para usar sin internet
│   └── qr.ts · reports.ts  Códigos QR y reportes PDF
├── lib/                    Cálculos de distancias, navegación entre pantallas, instalación como app
├── components/             Mapa, menús, formularios, reseñas, escáner QR…
├── views/                  Pantallas (inicio, explorar, recorrido, ficha, mapa, perfil, ingreso, admin)
└── __tests__/              Pruebas automáticas
supabase/esquema.sql        Tablas, permisos y datos iniciales de la base de datos
pwa/sw-template.js          Archivo que permite usar la app sin internet
public/                     Íconos de la app
```

## Historias de usuario: dónde está cada una y cómo probarla

| HU | Escenario | Dónde | Cómo probarlo |
| --- | --- | --- | --- |
| **CONS-001** Consultar recorridos | 1. Listado por categoría | Inicio · Explorar | Toca «Gastronómicos» en Inicio: Explorar abre filtrado. |
| | 2. Detalle del recorrido | `TourDetailView` | Abre un recorrido: descripción, duración, distancia y puntos. |
| **MAPA-001** Mapa interactivo | 1. Puntos en el mapa | `MapView` + `LeafletMap` | «Ver en el mapa»: pines numerados sobre OpenStreetMap y trazado por las calles. |
| | 2. Ubicación en tiempo real | `LocationContext` | «Activar GPS»: tu posición real con su precisión. |
| **GEO-001** Indicaciones | 1. Cálculo de ruta | `MapView` + `services/routing.ts` | «Cómo llegar»: ruta por las calles con metros, minutos e indicaciones. |
| | 2. Actualización al moverse | `MapView` | Con GPS la distancia baja sola, la ruta se recalcula si te desvías y avisa al llegar. Sin GPS: «Simular caminata». |
| **FICHA-001** Ficha de un punto | 1. Ficha completa | `PointDetailView` | Galería, relato, audio, dirección y valoraciones. |
| | 2. Sin internet | `PointDetailView` · `services/offline.ts` | Abre una ficha y luego, en DevTools → Network → *Offline*, ábrela otra vez: muestra lo guardado. |
| **QR-001** Escanear QR | 1. Escaneo exitoso | `QrScannerModal` → `#/qr/<código>` | Cámara o código manual (`QR-DOCE-02`): abre la ficha y sella la visita. |
| | 2. Código no reconocido | `QrScannerModal` · `QrResolveView` | «Simular código dañado» o `#/qr/QR-FALSO`: mensaje y búsqueda manual. |
| **VAL-001** Valorar | 1. Registrar calificación | `ReviewsSection` | Estrellas + comentario en una ficha o recorrido (requiere sesión). Con Supabase queda en la tabla `resenas`. |
| | 2. Valoraciones previas | `ReviewsSection` | Promedio, distribución y comentarios de otros visitantes. |
| **BUSC-001** Buscar y filtrar | 1. Categoría y duración | `ExploreView` | Combina categoría, duración, distancia y dificultad. |
| | 2. Sin resultados | `ExploreView` | «Gastronómicos» + «< 1 h»: mensaje y filtros que puedes quitar. |
| **PERFIL-001** Cuentas | 1. Registro exitoso | `AuthView` | «Crear cuenta» valida los campos y lleva a la pantalla principal. Con Supabase aparece en `perfiles`. |
| | 2. Datos incorrectos | `AuthView` | Mensaje de error con intentos restantes y bloqueo temporal. «¿Olvidaste tu contraseña?» abre la recuperación. |
| **ADMIN-001** Crear recorridos | 1. Creación | `admin/TourFormView` | Panel → «Nuevo recorrido»: aparece de inmediato en Explorar. |
| | 2. Campos obligatorios | `admin/TourFormView` | Guarda vacío: lista los campos que faltan. |
| **ADMIN-002** Actualizar puntos | 1. Edición | `admin/PointFormView` | Relato, imágenes y ubicación en el mapa. |
| | 2. Eliminación | `admin/AdminView` | Se retira del mapa y de todos sus recorridos. |
| **ADMIN-003** QR de un punto | 1. Generación | `admin/QrDialog` | «Panadería La Curva» no tiene QR: «Generar código QR». |
| | 2. Descarga | `admin/QrDialog` | PNG listo para imprimir. |
| **REP-001** Reportes | 1. Reporte | `admin/ReportsPanel` | Recorrido + fechas: promedio, valoraciones, visitas y detalle por punto. |
| | 2. Exportación | `admin/ReportsPanel` | «Exportar a PDF». |

## Abrirla desde el celular

- **GPS, cámara e instalación** solo funcionan con **HTTPS** o en `localhost` (es una regla de los navegadores).
- En la misma red Wi‑Fi puedes abrir `http://<IP-de-tu-computador>:3000`. Todo funciona, pero sin GPS ni cámara.
- Para usarla completa desde el celular hay que publicarla con HTTPS, por ejemplo en Netlify o Vercel (conectando este repositorio). En Supabase hay que cambiar el **Site URL** por la nueva dirección.

## Datos y límites de esta versión

- **Lugares reales:** los 22 puntos existen en la Comuna 6 (parques, templos, Casa de la Cultura, Parque Biblioteca, estaciones del Metrocable, Cerro El Picacho, restaurantes y panaderías), con su dirección y coordenadas. Los restaurantes y panaderías son negocios privados: sus horarios pueden cambiar.
- **Fuentes de los lugares** (consultadas en octubre de 2026): [Alcaldía de Medellín – Cerro El Picacho](https://www.medellin.gov.co/es/secretaria-medio-ambiente/medellin-biodiversa/cerro-el-picacho/), [Alcaldía de Medellín – Comuna 6](https://www.medellin.gov.co/es/wp-content/uploads/2025/10/Comuna-6.pdf), [Metro de Medellín – Línea P](https://metrodemedellin.gov.co/en/users/integrated-system/line-p), [comunasdemedellin.com – Comuna 6](https://comunasdemedellin.com/comuna-6-doce-de-octubre), [El Colombiano – Parque Biblioteca](https://www.elcolombiano.com/cultura/un-parque-periscopio-desde-el-que-mira-el-doce-de-octubre-YI2039809), [Wikipedia – Doce de Octubre](https://es.wikipedia.org/wiki/Doce_de_Octubre_(Medell%C3%ADn)) y las fichas públicas de Google Maps de cada lugar.
- **Fotos y audio:** las fotos son **ilustrativas** (no son de cada lugar) y el audio es simulado, porque los relatos aún no están grabados.
- **Correos:** con el correo gratis de Supabase solo llegan a los correos del equipo del proyecto (ver [Recuperar la contraseña](#recuperar-la-contraseña)).
- **Servicios gratuitos:** el mapa (OpenStreetMap) y las rutas (OSRM) son públicos y tienen límites de uso pensados para proyectos pequeños. Se pueden cambiar en `.env.local` con `VITE_TILE_URL` y `VITE_ROUTING_URL` (ver `.env.example`).