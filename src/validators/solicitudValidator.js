// Validaciones de entrada del backend. La interfaz repite algunas para ayudar al
// usuario, pero estas son las que protegen los datos.

const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA'];
const ESTADOS = ['PENDIENTE', 'EN_PROCESO', 'RESUELTA', 'CANCELADA'];

const MIN_SOLICITANTE = 3;
const MAX_SOLICITANTE = 100;
const MIN_DESCRIPCION = 10;
const MAX_DESCRIPCION = 500;

// Convierte un valor a entero positivo; devuelve null si no lo es.
function enteroPositivo(valor) {
  const texto = String(valor ?? '').trim();
  if (!/^\d+$/.test(texto)) return null;
  const numero = Number(texto);
  return numero > 0 && Number.isSafeInteger(numero) ? numero : null;
}

function textoLimpio(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

// Valida los datos descriptivos de una solicitud (registro y edición).
// Devuelve { datos, errores }; errores es un objeto campo -> mensaje.
function validarSolicitud(cuerpo = {}) {
  const errores = {};

  const equipoId = enteroPositivo(cuerpo.equipo_id);
  if (!equipoId) errores.equipo_id = 'Seleccione un equipo válido.';

  const solicitante = textoLimpio(cuerpo.solicitante);
  if (!solicitante) {
    errores.solicitante = 'El solicitante es obligatorio.';
  } else if (solicitante.length < MIN_SOLICITANTE) {
    errores.solicitante = `El solicitante debe tener al menos ${MIN_SOLICITANTE} caracteres.`;
  } else if (solicitante.length > MAX_SOLICITANTE) {
    errores.solicitante = `El solicitante no puede superar ${MAX_SOLICITANTE} caracteres.`;
  }

  const descripcion = textoLimpio(cuerpo.descripcion);
  if (!descripcion) {
    errores.descripcion = 'La descripción es obligatoria.';
  } else if (descripcion.length < MIN_DESCRIPCION) {
    errores.descripcion = `La descripción debe tener al menos ${MIN_DESCRIPCION} caracteres.`;
  } else if (descripcion.length > MAX_DESCRIPCION) {
    errores.descripcion = `La descripción no puede superar ${MAX_DESCRIPCION} caracteres.`;
  }

  const prioridad = textoLimpio(cuerpo.prioridad).toUpperCase();
  if (!PRIORIDADES.includes(prioridad)) {
    errores.prioridad = 'La prioridad debe ser BAJA, MEDIA o ALTA.';
  }

  return { datos: { equipoId, solicitante, descripcion, prioridad }, errores };
}

// Valida los parámetros de búsqueda y filtro del listado.
function validarFiltros(query = {}) {
  const errores = {};
  const texto = textoLimpio(query.q).slice(0, 100);
  const prioridad = textoLimpio(query.prioridad).toUpperCase();
  const estado = textoLimpio(query.estado).toUpperCase();
  if (prioridad && !PRIORIDADES.includes(prioridad)) errores.prioridad = 'Prioridad de filtro no válida.';
  if (estado && !ESTADOS.includes(estado)) errores.estado = 'Estado de filtro no válido.';
  return { filtros: { texto, prioridad, estado }, errores };
}

function hayErrores(errores) {
  return Object.keys(errores).length > 0;
}

module.exports = {
  PRIORIDADES,
  ESTADOS,
  enteroPositivo,
  validarSolicitud,
  validarFiltros,
  hayErrores
};
