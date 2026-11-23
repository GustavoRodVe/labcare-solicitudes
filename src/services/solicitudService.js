// Servicio de solicitudes: reglas de negocio del caso LabCare.
// El controlador solo traduce HTTP; aquí se decide qué está permitido.
const solicitudModel = require('../models/solicitudModel');
const equipoModel = require('../models/equipoModel');
const { ESTADOS } = require('../validators/solicitudValidator');

// Flujo de estados permitido. RESUELTA y CANCELADA son estados finales.
const TRANSICIONES = {
  PENDIENTE: ['EN_PROCESO', 'CANCELADA'],
  EN_PROCESO: ['RESUELTA', 'CANCELADA'],
  RESUELTA: [],
  CANCELADA: []
};

const ESTADOS_FINALES = ['RESUELTA', 'CANCELADA'];

// Error de negocio con el código HTTP que le corresponde.
class ErrorNegocio extends Error {
  constructor(status, mensaje, errores) {
    super(mensaje);
    this.status = status;
    this.errores = errores;
  }
}

function transicionPermitida(actual, nuevo) {
  return (TRANSICIONES[actual] || []).includes(nuevo);
}

// SOL-AAAAMMDD-XXX con la fecha local del servidor.
function prefijoDelDia(fecha = new Date()) {
  const aaaa = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `SOL-${aaaa}${mm}${dd}-`;
}

async function validarEquipo(equipoId) {
  const equipo = await equipoModel.buscarPorId(equipoId);
  if (!equipo) {
    throw new ErrorNegocio(400, 'El equipo seleccionado no existe.', { equipo_id: 'El equipo seleccionado no existe.' });
  }
  if (!equipoModel.estaDisponible(equipo)) {
    throw new ErrorNegocio(400, 'El equipo seleccionado no está disponible.', { equipo_id: 'El equipo está dado de baja.' });
  }
  return equipo;
}

async function registrar(datos) {
  await validarEquipo(datos.equipoId);
  const prefijo = prefijoDelDia();
  // Si dos registros calculan el mismo correlativo, el UNIQUE de la base rechaza
  // el segundo y se reintenta con el siguiente número.
  for (let intento = 0; intento < 5; intento++) {
    const siguiente = (await solicitudModel.ultimoCorrelativo(prefijo)) + 1;
    const codigo = prefijo + String(siguiente).padStart(3, '0');
    try {
      const id = await solicitudModel.crear({ ...datos, codigo });
      return solicitudModel.buscarActivaPorId(id);
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
    }
  }
  throw new ErrorNegocio(409, 'No se pudo generar un código único. Intente de nuevo.');
}

async function obtener(id) {
  const solicitud = await solicitudModel.buscarActivaPorId(id);
  if (!solicitud) throw new ErrorNegocio(404, 'La solicitud no existe o fue eliminada.');
  return solicitud;
}

async function editar(id, datos) {
  const actual = await obtener(id);
  if (ESTADOS_FINALES.includes(actual.estado)) {
    throw new ErrorNegocio(409, `No se puede editar una solicitud ${actual.estado}.`);
  }
  await validarEquipo(datos.equipoId);
  await solicitudModel.actualizar(id, datos);
  return solicitudModel.buscarActivaPorId(id);
}

async function cambiarEstado(id, estadoNuevo) {
  if (!ESTADOS.includes(estadoNuevo)) {
    throw new ErrorNegocio(400, 'El estado debe ser PENDIENTE, EN_PROCESO, RESUELTA o CANCELADA.', { estado: 'Estado no válido.' });
  }
  const actual = await obtener(id);
  if (!transicionPermitida(actual.estado, estadoNuevo)) {
    const permitidos = TRANSICIONES[actual.estado];
    const detalle = permitidos.length
      ? `Desde ${actual.estado} solo se puede pasar a ${permitidos.join(' o ')}.`
      : `${actual.estado} es un estado final y ya no puede cambiar.`;
    throw new ErrorNegocio(409, `Transición no permitida: ${actual.estado} a ${estadoNuevo}. ${detalle}`);
  }
  const cambiadas = await solicitudModel.cambiarEstado(id, actual.estado, estadoNuevo);
  if (!cambiadas) {
    throw new ErrorNegocio(409, 'La solicitud cambió mientras se procesaba. Recargue e intente de nuevo.');
  }
  return solicitudModel.buscarActivaPorId(id);
}

async function eliminar(id) {
  const cambiadas = await solicitudModel.desactivar(id);
  if (!cambiadas) throw new ErrorNegocio(404, 'La solicitud no existe o ya fue eliminada.');
}

module.exports = {
  TRANSICIONES,
  ErrorNegocio,
  transicionPermitida,
  registrar,
  obtener,
  editar,
  cambiarEstado,
  eliminar,
  listar: solicitudModel.listarActivas,
  listarEquipos: equipoModel.listarDisponibles
};
