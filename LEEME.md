# ACAEMAT Táchira — Web + Aula virtual (versión demo)

Academia de Capacitación y Adiestramiento para Enfermería, Medicina y Afines Táchira · RIF V-10176649-3 · M.P.P.E. Cód. R-003162001

> ⚠️ Datos provisionales por confirmar con el cliente: WhatsApp y correo (`js/config.js`), vigencia de certificados (2 años) y catálogo de cursos (`js/seed.js`).

## Páginas
- `index.html` + `site.css` — web pública, diseño propio "monitor clínico" (programas, método, credenciales, inscripción por WhatsApp)
- `aula.html` — aula virtual de estudiantes (cursos, lecciones, evaluaciones, certificado)
- `admin.html` — panel docente (crear programas, módulos, lecciones, subir videos/PDF, estudiantes, solicitudes)

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
