// Modelo Solicitud: todas las sentencias SQL de la tabla solicitud.
// Los datos del usuario siempre viajan como parámetros (?), nunca concatenados.
const { pool } = require('../config/db');

const COLUMNAS = `
  s.id, s.codigo_solicitud, s.equipo_id, s.solicitante, s.descripcion,
  s.prioridad, s.estado, s.fecha_registro, s.fecha_actualizacion, s.activo,
  e.codigo AS equipo_codigo, e.nombre AS equipo_nombre, e.ubicacion AS equipo_ubicacion`;

// Lista las solicitudes activas. Los filtros son opcionales y se combinan con AND.
// La colación utf8mb4_0900_ai_ci hace que LIKE no distinga mayúsculas ni tildes.
async function listarActivas({ texto, prioridad, estado } = {}) {
  const condiciones = ['s.activo = TRUE'];
  const parametros = [];
  if (texto) {
    condiciones.push('(s.codigo_solicitud LIKE ? OR s.solicitante LIKE ? OR e.nombre LIKE ?)');
    // Se escapan % y _ para que el usuario busque esos caracteres de forma literal.
    const patron = `%${texto.replace(/[\\%_]/g, '\\$&')}%`;
    parametros.push(patron, patron, patron);
  }
  if (prioridad) {
    condiciones.push('s.prioridad = ?');
    parametros.push(prioridad);
  }
  if (estado) {
    condiciones.push('s.estado = ?');
    parametros.push(estado);
  }
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS}
       FROM solicitud s
       JOIN equipo e ON e.id = s.equipo_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY s.fecha_registro DESC, s.id DESC`,
    parametros
  );
  return filas;
}

// Devuelve una solicitud activa por su id, o null si no existe o fue eliminada.
async function buscarActivaPorId(id) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS}
       FROM solicitud s
       JOIN equipo e ON e.id = s.equipo_id
      WHERE s.id = ? AND s.activo = TRUE`,
    [id]
  );
  return filas[0] || null;
}

// Último correlativo usado con un prefijo de fecha (incluye solicitudes eliminadas,
// porque siguen en la base y su código no se puede repetir).
async function ultimoCorrelativo(prefijo) {
  const [filas] = await pool.execute(
    `SELECT MAX(CAST(SUBSTRING(codigo_solicitud, ?) AS UNSIGNED)) AS ultimo
       FROM solicitud
      WHERE codigo_solicitud LIKE ?`,
    [prefijo.length + 1, `${prefijo}%`]
  );
  return Number(filas[0].ultimo) || 0;
}

async function crear({ codigo, equipoId, solicitante, descripcion, prioridad }) {
  const [resultado] = await pool.execute(
    `INSERT INTO solicitud (codigo_solicitud, equipo_id, solicitante, descripcion, prioridad, estado)
     VALUES (?, ?, ?, ?, ?, 'PENDIENTE')`,
    [codigo, equipoId, solicitante, descripcion, prioridad]
  );
  return resultado.insertId;
}

// Solo actualiza los datos descriptivos. id, código, estado y fecha_registro no se tocan.
async function actualizar(id, { equipoId, solicitante, descripcion, prioridad }) {
  const [resultado] = await pool.execute(
    `UPDATE solicitud
        SET equipo_id = ?, solicitante = ?, descripcion = ?, prioridad = ?
      WHERE id = ? AND activo = TRUE`,
    [equipoId, solicitante, descripcion, prioridad, id]
  );
  return resultado.affectedRows;
}

// El estado anterior va en el WHERE para que dos cambios simultáneos no se pisen.
async function cambiarEstado(id, estadoActual, estadoNuevo) {
  const [resultado] = await pool.execute(
    'UPDATE solicitud SET estado = ? WHERE id = ? AND estado = ? AND activo = TRUE',
    [estadoNuevo, id, estadoActual]
  );
  return resultado.affectedRows;
}

// Eliminación lógica: no hay DELETE físico en este modelo.
async function desactivar(id) {
  const [resultado] = await pool.execute(
    'UPDATE solicitud SET activo = FALSE WHERE id = ? AND activo = TRUE',
    [id]
  );
  return resultado.affectedRows;
}

module.exports = {
  listarActivas,
  buscarActivaPorId,
  ultimoCorrelativo,
  crear,
  actualizar,
  cambiarEstado,
  desactivar
};
