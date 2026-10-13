# Configurar los tres administradores

El panel conserva los usuarios y contraseñas actuales (`ADMIN_USER_1` / `ADMIN_PASSWORD_1` y
`ADMIN_USER_2` / `ADMIN_PASSWORD_2`) y admite una tercera cuenta:

- `ADMIN_USER_3`
- `ADMIN_PASSWORD_3`

Cada cuenta necesita un usuario y una contraseña privados. En Netlify, configura las mismas variables en
**Site configuration → Environment variables**. En desarrollo local, agrégalas a `.env.local` sin
compartirlas por chat. El panel muestra por defecto Adrián Quintero, Miguel Gómez y Darío Pérez; puedes
personalizar los nombres visibles con `ADMIN_NAME_1`, `ADMIN_NAME_2` y `ADMIN_NAME_3`.

Antes de desplegar la aprobación editorial, aplica una vez `database/migrations/002_admin_approvals.sql`
contra la misma base de datos configurada en `DATABASE_URL`. La migración agrega el registro de quién
aprobó o rechazó cada artículo y el índice para la cola de pendientes.
