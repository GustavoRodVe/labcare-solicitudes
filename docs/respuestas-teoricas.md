# Evaluación teórica

## 1. Responsabilidades en MVC y dónde validar una regla de negocio

El modelo representa los datos y su acceso: en LabCare, `solicitudModel.js` y `equipoModel.js` hacen las consultas a MySQL. La vista es lo que ve el usuario, la pantalla `index.ejs` con su formulario y su tabla. El controlador recibe la petición, toma los datos, llama a la lógica que corresponde y decide qué respuesta devolver, como hace `solicitudController.js` con los códigos 201, 400, 404 o 409. Una regla de negocio, por ejemplo que una solicitud RESUELTA no puede volver a PENDIENTE, se valida en el lado del modelo (en nuestro caso en la capa de servicio que acompaña a los modelos), porque ahí se aplica siempre, sin importar si la petición llega desde la pantalla, desde Postman o desde otro sistema. Si quedara solo en la vista, bastaría con saltarse la interfaz para romperla.

## 2. Diferencia entre POST, PUT y PATCH

POST crea un recurso nuevo y el servidor decide su identificador; en LabCare es `POST /api/solicitudes`, que registra una solicitud y genera su código. PUT reemplaza la representación de un recurso existente con todos sus datos editables; lo usamos en `PUT /api/solicitudes/:id` para editar equipo, solicitante, descripción y prioridad de una vez. PATCH modifica solo una parte del recurso; lo usamos en `PATCH /api/solicitudes/:id/estado`, que cambia únicamente el estado y verifica antes si la transición está permitida.

## 3. Por qué las validaciones del frontend no sustituyen a las del backend

Todo lo que corre en el navegador lo controla el usuario: puede desactivar JavaScript, modificar el HTML o enviar la petición directamente con curl o Postman. Por eso la validación del frontend solo mejora la experiencia, y la que protege los datos es la del servidor. En el examen lo comprobamos enviando desde el navegador, sin pasar por el formulario, una solicitud con solicitante "Al", descripción "Falla" y prioridad "URGENTE": el servidor respondió 400 con los tres errores y no guardó nada (captura 17).

## 4. Prueba negativa y un caso para el cambio de estado

Una prueba negativa comprueba que el sistema rechaza correctamente una entrada o una acción inválida, en vez de comprobar el camino feliz. Un caso para el cambio de estado sería este. Precondición: existe la solicitud SOL-20261123-001 en estado RESUELTA. Acción: enviar `PATCH /api/solicitudes/1/estado` con `{"estado": "PENDIENTE"}`. Resultado esperado: respuesta 409 con el mensaje "Transición no permitida", y en la base de datos la solicitud sigue en RESUELTA. Es el caso CP-08 y se aprobó.

## 5. Uso responsable de la IA en desarrollo

Usar la IA de forma responsable es tratarla como una ayuda y no como un reemplazo del criterio propio: entender lo que sugiere, no aceptar código que uno no puede explicar, no compartir credenciales ni datos personales, y registrar dónde se usó. Una forma concreta de verificar una sugerencia es ejecutarla contra pruebas reales. Por ejemplo, la lógica de transiciones que sugirió la IA la validamos con `npm test`, que intenta pasar de RESUELTA a PENDIENTE y luego consulta MySQL para confirmar que el estado no cambió.
