# LabCare: gestión de solicitudes de mantenimiento

Módulo web para registrar, consultar, editar, cambiar de estado y eliminar lógicamente las solicitudes de mantenimiento de los equipos de laboratorio de LabCare, una institución ficticia. Es la solución del examen práctico integrador de Desarrollo de Sistemas II (UPDS, sede Cochabamba). Los datos de prueba son inventados.

## Tecnologías

- Node.js 20 o superior (probado con Node.js 26)
- Express 4 con API REST
- EJS para la vista y JavaScript del navegador (fetch) para consumir la API
- MySQL 8.4 con el paquete mysql2 y consultas parametrizadas
- dotenv para leer la configuración desde variables de entorno
- Playwright (opcional, solo para generar las capturas de evidencia)

## Estructura

```
database/        script SQL (labcare.sql) e inicializador
docs/diagramas/  casos de uso, arquitectura MVC y modelo de datos (Mermaid y PNG)
evidencias/      capturas de la aplicación y de la base de datos
public/          CSS y JavaScript de la interfaz
pruebas/         matriz de pruebas automatizada y recorrido de la interfaz
src/
  app.js         configuración de Express
  config/        conexión a MySQL
  controllers/   controlador HTTP de solicitudes
  middlewares/   manejo de errores
  models/        acceso a datos de equipo y solicitud
  routes/        rutas de la API y de la vista
  services/      reglas de negocio y flujo de estados
  validators/    validación de los datos de entrada
  views/         vista EJS
```

## Requisitos

1. Node.js y npm instalados.
2. MySQL 8.0.16 o superior en ejecución (las restricciones CHECK se aplican desde esa versión).
3. Un usuario de MySQL con permisos sobre la base `labcare_db`.

## Pasos para ejecutar

1. Clonar el repositorio y entrar a la carpeta:

   ```
   git clone https://github.com/GustavoRodVe/labcare-solicitudes.git
   cd labcare-solicitudes
   ```

2. Instalar las dependencias:

   ```
   npm install
   ```

3. Crear la base y el usuario de la aplicación. Desde el cliente de MySQL con un usuario administrador (cambie la contraseña por una propia):

   ```sql
   CREATE DATABASE IF NOT EXISTS labcare_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE USER 'labcare_app'@'localhost' IDENTIFIED BY 'una_contraseña_segura';
   GRANT ALL PRIVILEGES ON labcare_db.* TO 'labcare_app'@'localhost';
   ```

4. Copiar `.env.example` como `.env` y completar `DB_PASSWORD` con la contraseña del paso anterior. El archivo `.env` está en `.gitignore` y no se sube al repositorio.

5. Crear las tablas y cargar los equipos semilla (borra y vuelve a crear las tablas):

   ```
   npm run db:init
   ```

   También se puede ejecutar `database/labcare.sql` directamente en MySQL Workbench.

6. Iniciar la aplicación y abrir http://localhost:3000 en el navegador:

   ```
   npm start
   ```

## Pruebas

`npm test` ejecuta la matriz de pruebas del examen (CP-01 a CP-12) y cuatro pruebas extra contra la API y la base de datos reales. Levanta la aplicación en un puerto libre y guarda el resultado en `pruebas/resultados.json`. Conviene ejecutarlo sobre una base recién inicializada.

`node pruebas/capturas-ui.js` recorre la interfaz con Playwright y guarda las capturas en `evidencias/capturas`. Necesita Playwright instalado de forma global (`npm i -g playwright` y `npx playwright install chromium`) y reinicia la base con los datos semilla.

La matriz con los resultados está en [PRUEBAS.md](PRUEBAS.md).

## API

| Método | Ruta | Qué hace | Respuestas |
|--------|------|----------|------------|
| GET | /api/equipos | Equipos disponibles para elegir | 200 |
| GET | /api/solicitudes?q=&prioridad=&estado= | Solicitudes activas con búsqueda y filtros | 200, 400 |
| GET | /api/solicitudes/:id | Detalle de una solicitud | 200, 400, 404 |
| POST | /api/solicitudes | Registra una solicitud en estado PENDIENTE | 201, 400 |
| PUT | /api/solicitudes/:id | Edita equipo, solicitante, descripción y prioridad | 200, 400, 404, 409 |
| PATCH | /api/solicitudes/:id/estado | Cambia el estado si la transición está permitida | 200, 400, 404, 409 |
| DELETE | /api/solicitudes/:id | Eliminación lógica (activo = FALSE) | 200, 404 |

Ejemplo de registro:

```
curl -X POST http://localhost:3000/api/solicitudes -H "Content-Type: application/json" -d "{\"equipo_id\":1,\"solicitante\":\"María Fernández\",\"descripcion\":\"La computadora no enciende.\",\"prioridad\":\"ALTA\"}"
```

## Funcionalidades implementadas

- Listado de solicitudes activas con código, equipo, solicitante, prioridad, estado y fecha de registro.
- Registro con selección de equipo, validación en el navegador y en el servidor, estado inicial PENDIENTE y código SOL-AAAAMMDD-XXX generado por el servidor.
- Detalle por ID, con respuesta 404 cuando la solicitud no existe o fue eliminada.
- Edición de los datos descriptivos sin tocar el id, el código, el estado ni la fecha de registro.
- Cambio de estado con el flujo PENDIENTE, EN_PROCESO, RESUELTA o CANCELADA, aviso en pantalla y rechazo 409 en el servidor para transiciones no permitidas.
- Eliminación lógica con confirmación previa.
- Búsqueda por código, solicitante o equipo sin distinguir mayúsculas ni tildes, y filtros por prioridad y estado.
- Mensajes de éxito, validación y error. El mensaje de éxito solo aparece cuando el servidor responde.
- Datos del usuario mostrados como texto (sin interpretar HTML), consultas parametrizadas y errores sin trazas internas.

## Documentación

- [ANALISIS.md](ANALISIS.md): actor, alcance, requerimientos, reglas y diagramas.
- [PRUEBAS.md](PRUEBAS.md): matriz de pruebas con resultados reales.
- [REGISTRO-IA.md](REGISTRO-IA.md): registro de uso de herramientas de IA.

## Autor

Gustavo Rodríguez Vélez, Ingeniería de Sistemas, UPDS Cochabamba.
