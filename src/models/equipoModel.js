// Modelo Equipo: acceso a la tabla equipo con consultas parametrizadas.
const { pool } = require('../config/db');

// Un equipo dado de baja no puede recibir nuevas solicitudes.
const ESTADOS_SELECCIONABLES = ['OPERATIVO', 'EN_MANTENIMIENTO'];

async function listarDisponibles() {
  const [filas] = await pool.query(
    'SELECT id, codigo, nombre, ubicacion, estado FROM equipo WHERE estado IN (?) ORDER BY codigo',
    [ESTADOS_SELECCIONABLES]
  );
  return filas;
}

async function buscarPorId(id) {
  const [filas] = await pool.execute(
    'SELECT id, codigo, nombre, ubicacion, estado FROM equipo WHERE id = ?',
    [id]
  );
  return filas[0] || null;
}

function estaDisponible(equipo) {
  return Boolean(equipo) && ESTADOS_SELECCIONABLES.includes(equipo.estado);
}

module.exports = { listarDisponibles, buscarPorId, estaDisponible };
