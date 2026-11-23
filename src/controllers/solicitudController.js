// Controlador de la API de solicitudes: lee la petición, llama al servicio y
// responde con el código HTTP que corresponde (200, 201, 400, 404 o 409).
const servicio = require('../services/solicitudService');
const { enteroPositivo, validarSolicitud, validarFiltros, hayErrores } = require('../validators/solicitudValidator');

function leerId(req, res) {
  const id = enteroPositivo(req.params.id);
  if (!id) {
    res.status(400).json({ mensaje: 'El identificador debe ser un número entero positivo.' });
    return null;
  }
  return id;
}

// Envía los errores de negocio al cliente; los demás pasan al manejador general.
function responderError(err, res, next) {
  if (err instanceof servicio.ErrorNegocio) {
    return res.status(err.status).json({ mensaje: err.message, errores: err.errores });
  }
  return next(err);
}

async function listar(req, res, next) {
  try {
    const { filtros, errores } = validarFiltros(req.query);
    if (hayErrores(errores)) return res.status(400).json({ mensaje: 'Filtros no válidos.', errores });
    const solicitudes = await servicio.listar(filtros);
    res.json({ total: solicitudes.length, solicitudes });
  } catch (err) {
    next(err);
  }
}

async function detalle(req, res, next) {
  const id = leerId(req, res);
  if (!id) return;
  try {
    res.json({ solicitud: await servicio.obtener(id) });
  } catch (err) {
    responderError(err, res, next);
  }
}

async function crear(req, res, next) {
  try {
    const { datos, errores } = validarSolicitud(req.body);
    if (hayErrores(errores)) {
      return res.status(400).json({ mensaje: 'Revise los datos de la solicitud.', errores });
    }
    const solicitud = await servicio.registrar(datos);
    res.status(201).json({ mensaje: `Solicitud ${solicitud.codigo_solicitud} registrada.`, solicitud });
  } catch (err) {
    responderError(err, res, next);
  }
}

async function actualizar(req, res, next) {
  const id = leerId(req, res);
  if (!id) return;
  try {
    // Solo se leen los campos descriptivos; id, código, estado y fechas se ignoran.
    const { datos, errores } = validarSolicitud(req.body);
    if (hayErrores(errores)) {
      return res.status(400).json({ mensaje: 'Revise los datos de la solicitud.', errores });
    }
    const solicitud = await servicio.editar(id, datos);
    res.json({ mensaje: `Solicitud ${solicitud.codigo_solicitud} actualizada.`, solicitud });
  } catch (err) {
    responderError(err, res, next);
  }
}

async function cambiarEstado(req, res, next) {
  const id = leerId(req, res);
  if (!id) return;
  try {
    const estado = String(req.body?.estado ?? '').trim().toUpperCase();
    const solicitud = await servicio.cambiarEstado(id, estado);
    res.json({ mensaje: `Solicitud ${solicitud.codigo_solicitud} ahora está ${solicitud.estado}.`, solicitud });
  } catch (err) {
    responderError(err, res, next);
  }
}

async function eliminar(req, res, next) {
  const id = leerId(req, res);
  if (!id) return;
  try {
    await servicio.eliminar(id);
    res.json({ mensaje: 'Solicitud eliminada del listado. El registro se conserva en la base de datos.' });
  } catch (err) {
    responderError(err, res, next);
  }
}

async function equipos(req, res, next) {
  try {
    res.json({ equipos: await servicio.listarEquipos() });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, detalle, crear, actualizar, cambiarEstado, eliminar, equipos };
