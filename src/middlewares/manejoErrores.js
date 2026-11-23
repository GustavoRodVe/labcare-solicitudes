// Manejador general de errores. El detalle técnico queda en la consola del
// servidor; al usuario solo le llega un mensaje genérico, sin trazas ni rutas.

function manejarErrores(err, req, res, next) {
  if (res.headersSent) return next(err);

  // JSON mal formado enviado por el cliente.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo de la petición no es un JSON válido.' });
  }

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, err.code || '', err.message);

  const sinBase = ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_SERVER_SHUTDOWN', 'ETIMEDOUT'];
  const status = sinBase.includes(err.code) ? 503 : 500;
  const mensaje = status === 503
    ? 'No se pudo conectar con la base de datos. Intente nuevamente en unos minutos.'
    : 'Ocurrió un error inesperado. Intente nuevamente.';

  if (req.originalUrl.startsWith('/api/')) return res.status(status).json({ mensaje });
  return res.status(status).send(mensaje);
}

module.exports = manejarErrores;
