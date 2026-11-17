# ACAEMAT Táchira — Web + Aula virtual (versión demo)

Academia de Capacitación y Adiestramiento para Enfermería, Medicina y Afines Táchira · RIF V-10176649-3 · M.P.P.E. Cód. R-003162001

> ⚠️ Datos provisionales por confirmar con el cliente: WhatsApp y correo (`js/config.js`), vigencia de certificados (2 años) y catálogo de cursos (`js/seed.js`).

## Páginas
- `index.html` + `site.css` — web pública, diseño propio "monitor clínico" (programas, método, credenciales, inscripción por WhatsApp)
- `aula.html` — aula virtual de estudiantes (cursos, lecciones, evaluaciones, certificado)
- `admin.html` — panel docente (crear programas, módulos, lecciones, subir videos/PDF, estudiantes, solicitudes)
- `js/exam-templates.js` — biblioteca de 9 modelos de examen que el docente carga desde «+ Evaluación → Cargar un modelo de examen»
- `js/clases.js` — clases en vivo: calendario mensual en aula y panel, programación por Google Meet, Zoom, Jitsi o YouTube Live, clases semanales, botón «Entrar» 10 min antes, grabaciones como lección
- `guia-del-docente.pdf` — guía paso a paso para el docente, con los modelos de examen y una lista de cotejo imprimible

## Cuentas de demostración
| Rol | Correo | Contraseña |
|---|---|---|
| Administración | admin@acaemat.edu.ve | admin123 |
| Docente | docente@acaemat.edu.ve | docente123 |
| Estudiante | estudiante@acaemat.edu.ve | demo123 |

## Importante (modo demo)
Los datos y archivos se guardan **en el navegador de quien la usa**. Sirve para mostrar el funcionamiento;
para uso real con varios usuarios hay que conectarla a Supabase (base de datos + archivos + inicio de sesión).
Desde el Resumen del panel (cuenta admin) se pueden restablecer los cursos de ejemplo.

## Publicar
- **Netlify:** arrastre esta carpeta a https://app.netlify.com/drop
- **Hostinger:** suba el contenido de la carpeta a `public_html` (incluye `.htaccess`).

## Ajustes rápidos
WhatsApp, horario y datos legales: `js/config.js`.

## Alumnos y pagos (solo administración)
- `js/pagos.js`: precios y cuotas por programa, tasa del día, métodos de pago (pago móvil, transferencia, Zelle, Binance, efectivo), verificación de pagos con comprobante, recibos numerados (comprobante interno, no sustituye factura fiscal), estados de cuenta, morosos con recordatorio por WhatsApp, reportes y reglas de solvencia.
- El estudiante ve «Mis pagos» en el aula y reporta sus pagos con foto del comprobante (se comprime automáticamente).
- El docente solo ve si el alumno está solvente, al día o moroso. Nunca ve montos.
- Reglas configurables: días de gracia; los morosos no presentan evaluaciones; el certificado exige el programa pagado.

## Respaldo y app de escritorio
- `js/respaldo.js` + `lib/xlsx.full.min.js` (SheetJS, Apache-2.0): Excel con hojas Usuarios, Inscripciones, Programas, Cuotas, Pagos, Clases en vivo y Solicitudes, más copia completa en JSON.
- `admin.webmanifest` + `sw.js`: el panel se instala como aplicación en Windows desde Chrome o Edge (menú «Respaldo y app»).

## Base de datos real (Supabase) — preparada, NO aplicada
- `supabase/schema.sql`: tablas, plan de pago automático al inscribir, recibos numerados, seguridad por roles (RLS) y almacenamiento para PDF y comprobantes. Probado en PostgreSQL 16 con los tres roles.
- Se ejecuta una sola vez en el SQL Editor del proyecto de la academia; luego se conecta el código.
