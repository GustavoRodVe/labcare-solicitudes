// Ejecuta la matriz de pruebas del examen (CP-01 a CP-12) y algunas pruebas extra
// de seguridad contra la API real y la base de datos real.
// Uso: npm test   (MySQL debe estar en ejecución y el .env configurado)
// El resultado se guarda en pruebas/resultados.json.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { pool } = require('../src/config/db');

let BASE = '';
const resultados = [];

async function api(metodo, ruta, cuerpo) {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  }
  const r = await fetch(BASE + ruta, opciones);
  const texto = await r.text();
  let datos;
  try { datos = JSON.parse(texto); } catch { datos = texto; }
  return { status: r.status, datos };
}

async function contarSolicitudes() {
  const [f] = await pool.query('SELECT COUNT(*) AS n FROM solicitud');
  return f[0].n;
}

async function fila(id) {
  const [f] = await pool.execute('SELECT * FROM solicitud WHERE id = ?', [id]);
  return f[0] || null;
}

async function caso(id, accion, esperado, fn) {
  try {
    const { ok, real } = await fn();
    resultados.push({ id, accion, esperado, real, estado: ok ? 'APROBADO' : 'RECHAZADO' });
  } catch (err) {
    resultados.push({ id, accion, esperado, real: 'Excepción: ' + err.message, estado: 'RECHAZADO' });
  }
  const ultimo = resultados[resultados.length - 1];
  console.log(`${ultimo.estado.padEnd(9)} ${id}  ${accion}\n          ${ultimo.real}`);
}

const valida = (extra = {}) => ({
  equipo_id: 1,
  solicitante: 'María Fernández',
  descripcion: 'La computadora no enciende al presionar el botón.',
  prioridad: 'ALTA',
  ...extra
});

async function main() {
  const servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  BASE = `http://127.0.0.1:${servidor.address().port}`;
  console.log('Pruebas contra ' + BASE + '\n');

  let creada; // solicitud usada en varios casos

  await caso('CP-01', 'Registrar solicitud con datos válidos y equipo existente (EQ-001).',
    'Se crea una solicitud PENDIENTE, con código único y persistencia.', async () => {
      const r = await api('POST', '/api/solicitudes', valida());
      creada = r.datos.solicitud;
      const enBase = creada && await fila(creada.id);
      const ok = r.status === 201 && creada.estado === 'PENDIENTE' &&
        /^SOL-\d{8}-\d{3}$/.test(creada.codigo_solicitud) && enBase && enBase.codigo_solicitud === creada.codigo_solicitud;
      return { ok, real: `HTTP ${r.status}; código ${creada?.codigo_solicitud}; estado ${creada?.estado}; fila en MySQL con id ${enBase?.id}.` };
    });

  await caso('CP-02', 'Solicitante vacío y luego con 2 caracteres ("  Al  ").',
    'El backend rechaza el registro; no se guarda.', async () => {
      const antes = await contarSolicitudes();
      const r1 = await api('POST', '/api/solicitudes', valida({ solicitante: '' }));
      const r2 = await api('POST', '/api/solicitudes', valida({ solicitante: '  Al  ' }));
      const despues = await contarSolicitudes();
      return {
        ok: r1.status === 400 && r2.status === 400 && antes === despues,
        real: `HTTP ${r1.status} "${r1.datos.errores?.solicitante}" y HTTP ${r2.status} "${r2.datos.errores?.solicitante}"; filas antes ${antes}, después ${despues}.`
      };
    });

  await caso('CP-03', 'Descripción vacía y luego "  Falla  " (5 caracteres sin espacios externos).',
    'El backend rechaza el registro; no se guarda.', async () => {
      const antes = await contarSolicitudes();
      const r1 = await api('POST', '/api/solicitudes', valida({ descripcion: '' }));
      const r2 = await api('POST', '/api/solicitudes', valida({ descripcion: '  Falla  ' }));
      const despues = await contarSolicitudes();
      return {
        ok: r1.status === 400 && r2.status === 400 && antes === despues,
        real: `HTTP ${r1.status} "${r1.datos.errores?.descripcion}" y HTTP ${r2.status} "${r2.datos.errores?.descripcion}"; filas antes ${antes}, después ${despues}.`
      };
    });

  await caso('CP-04', 'Prioridad "URGENTE".', 'El backend rechaza el valor.', async () => {
    const antes = await contarSolicitudes();
    const r = await api('POST', '/api/solicitudes', valida({ prioridad: 'URGENTE' }));
    const despues = await contarSolicitudes();
    return { ok: r.status === 400 && antes === despues, real: `HTTP ${r.status} "${r.datos.errores?.prioridad}"; no se guardó (filas ${antes} -> ${despues}).` };
  });

  await caso('CP-05', 'Registrar con equipo_id 999 (no existe).',
    'El sistema rechaza la operación y no crea solicitud huérfana.', async () => {
      const antes = await contarSolicitudes();
      const r = await api('POST', '/api/solicitudes', valida({ equipo_id: 999 }));
      const despues = await contarSolicitudes();
      const [huerfanas] = await pool.query('SELECT COUNT(*) AS n FROM solicitud s LEFT JOIN equipo e ON e.id = s.equipo_id WHERE e.id IS NULL');
      return { ok: r.status === 400 && antes === despues && huerfanas[0].n === 0, real: `HTTP ${r.status} "${r.datos.mensaje}"; filas ${antes} -> ${despues}; huérfanas en la base: ${huerfanas[0].n}.` };
    });

  await caso('CP-06', 'Editar la solicitud de CP-01 (prioridad MEDIA, otra descripción) e intentar cambiar su código y estado por el cuerpo.',
    'Se actualiza únicamente el registro seleccionado.', async () => {
      const otra = (await api('POST', '/api/solicitudes', valida({ solicitante: 'Carlos Quispe', equipo_id: 2, descripcion: 'El proyector muestra la imagen borrosa.', prioridad: 'BAJA' }))).datos.solicitud;
      const otraAntes = await fila(otra.id);
      const antes = await fila(creada.id);
      const r = await api('PUT', '/api/solicitudes/' + creada.id, valida({
        prioridad: 'MEDIA', descripcion: 'La computadora se apaga sola a los cinco minutos.',
        codigo_solicitud: 'SOL-HACK-001', estado: 'RESUELTA', fecha_registro: '2000-01-01 00:00:00'
      }));
      const despues = await fila(creada.id);
      const otraDespues = await fila(otra.id);
      const ok = r.status === 200 && despues.prioridad === 'MEDIA' && despues.codigo_solicitud === antes.codigo_solicitud &&
        despues.estado === 'PENDIENTE' && despues.fecha_registro === antes.fecha_registro &&
        JSON.stringify(otraAntes) === JSON.stringify(otraDespues);
      return { ok, real: `HTTP ${r.status}; prioridad ${antes.prioridad} -> ${despues.prioridad}; código, estado y fecha_registro sin cambios (${despues.codigo_solicitud}, ${despues.estado}, ${despues.fecha_registro}); la otra solicitud (${otra.codigo_solicitud}) quedó igual.` };
    });

  await caso('CP-07', 'Cambiar PENDIENTE a EN_PROCESO.', 'La transición se acepta.', async () => {
    const r = await api('PATCH', `/api/solicitudes/${creada.id}/estado`, { estado: 'EN_PROCESO' });
    const enBase = await fila(creada.id);
    return { ok: r.status === 200 && enBase.estado === 'EN_PROCESO', real: `HTTP ${r.status} "${r.datos.mensaje}"; estado en MySQL: ${enBase.estado}.` };
  });

  await caso('CP-08', 'Pasar a RESUELTA y luego intentar RESUELTA a PENDIENTE.',
    'La transición se rechaza y el estado no cambia.', async () => {
      const r1 = await api('PATCH', `/api/solicitudes/${creada.id}/estado`, { estado: 'RESUELTA' });
      const r2 = await api('PATCH', `/api/solicitudes/${creada.id}/estado`, { estado: 'PENDIENTE' });
      const enBase = await fila(creada.id);
      return { ok: r1.status === 200 && r2.status === 409 && enBase.estado === 'RESUELTA', real: `EN_PROCESO -> RESUELTA: HTTP ${r1.status}. RESUELTA -> PENDIENTE: HTTP ${r2.status} "${r2.datos.mensaje}"; estado en MySQL: ${enBase.estado}.` };
    });

  await caso('CP-09', 'Eliminar lógicamente la solicitud de CP-01.',
    'Desaparece del listado activo, pero permanece en la base de datos.', async () => {
      const r = await api('DELETE', '/api/solicitudes/' + creada.id);
      const lista = await api('GET', '/api/solicitudes');
      const enLista = lista.datos.solicitudes.some((s) => s.id === creada.id);
      const enBase = await fila(creada.id);
      const detalle = await api('GET', '/api/solicitudes/' + creada.id);
      return { ok: r.status === 200 && !enLista && enBase && enBase.activo === 0 && detalle.status === 404, real: `HTTP ${r.status}; aparece en el listado: ${enLista ? 'sí' : 'no'}; fila en MySQL: ${enBase ? 'sí, activo=' + enBase.activo : 'no'}; detalle por ID: HTTP ${detalle.status}.` };
    });

  await caso('CP-10', 'Buscar "quispe" y "PROYECTOR" (minúsculas/mayúsculas) y filtrar prioridad BAJA + estado PENDIENTE, y prioridad ALTA.',
    'El listado muestra solo coincidencias válidas.', async () => {
      await api('POST', '/api/solicitudes', valida({ solicitante: 'Lucía Mamani', equipo_id: 3, descripcion: 'El router pierde la conexión cada hora.', prioridad: 'ALTA' }));
      const porSolicitante = (await api('GET', '/api/solicitudes?q=quispe')).datos.solicitudes;
      const porEquipo = (await api('GET', '/api/solicitudes?q=PROYECTOR')).datos.solicitudes;
      const filtrado = (await api('GET', '/api/solicitudes?prioridad=BAJA&estado=PENDIENTE')).datos.solicitudes;
      const altas = (await api('GET', '/api/solicitudes?prioridad=alta')).datos.solicitudes;
      const filtroMalo = await api('GET', '/api/solicitudes?prioridad=URGENTE');
      const ok = porSolicitante.length > 0 && porSolicitante.every((s) => /quispe/i.test(s.solicitante)) &&
        porEquipo.length > 0 && porEquipo.every((s) => /proyector/i.test(s.equipo_nombre)) &&
        filtrado.length > 0 && filtrado.every((s) => s.prioridad === 'BAJA' && s.estado === 'PENDIENTE') &&
        altas.length > 0 && altas.every((s) => s.prioridad === 'ALTA') && filtroMalo.status === 400;
      return { ok, real: `"quispe": ${porSolicitante.length} resultado(s); "PROYECTOR": ${porEquipo.length}; BAJA+PENDIENTE: ${filtrado.length}; ALTA: ${altas.length}, todos coinciden; filtro "URGENTE": HTTP ${filtroMalo.status}.` };
    });

  await caso('CP-11', 'Consultar, editar, cambiar estado y eliminar el ID 999999 (no existe).',
    'Se informa que el recurso no existe; no se produce error no controlado.', async () => {
      const g = await api('GET', '/api/solicitudes/999999');
      const p = await api('PUT', '/api/solicitudes/999999', valida());
      const e = await api('PATCH', '/api/solicitudes/999999/estado', { estado: 'EN_PROCESO' });
      const d = await api('DELETE', '/api/solicitudes/999999');
      const ok = [g, p, e, d].every((r) => r.status === 404 && r.datos.mensaje);
      return { ok, real: `GET ${g.status}, PUT ${p.status}, PATCH ${e.status}, DELETE ${d.status}: "${g.datos.mensaje}".` };
    });

  await caso('CP-12', 'Registrar, detener el servidor HTTP, iniciar uno nuevo y consultar por ID.',
    'Los datos siguen disponibles desde la base de datos.', async () => {
      const r = await api('POST', '/api/solicitudes', valida({ solicitante: 'Jorge Vargas', equipo_id: 4, descripcion: 'La impresora atasca el papel en cada hoja.', prioridad: 'MEDIA' }));
      const nueva = r.datos.solicitud;
      await new Promise((ok) => servidor.close(ok));
      const servidor2 = app.listen(0);
      await new Promise((ok) => servidor2.once('listening', ok));
      BASE = `http://127.0.0.1:${servidor2.address().port}`;
      const g = await api('GET', '/api/solicitudes/' + nueva.id);
      main.servidor = servidor2;
      return { ok: r.status === 201 && g.status === 200 && g.datos.solicitud.codigo_solicitud === nueva.codigo_solicitud, real: `Registrada ${nueva.codigo_solicitud}; tras reiniciar el servidor (nuevo puerto) GET devuelve HTTP ${g.status} con el mismo código.` };
    });

  // Pruebas adicionales de seguridad y reglas.
  await caso('EX-01', 'Equipo EQ-004 marcado como DE_BAJA e intentar registrar una solicitud con él.',
    'El backend rechaza el equipo no disponible.', async () => {
      await pool.query("UPDATE equipo SET estado = 'DE_BAJA' WHERE codigo = 'EQ-004'");
      try {
        const r = await api('POST', '/api/solicitudes', valida({ equipo_id: 4 }));
        return { ok: r.status === 400, real: `HTTP ${r.status} "${r.datos.mensaje}".` };
      } finally {
        await pool.query("UPDATE equipo SET estado = 'OPERATIVO' WHERE codigo = 'EQ-004'");
      }
    });

  await caso('EX-02', 'Búsqueda con inyección SQL: q = \' OR 1=1 -- ', 'No devuelve todo el listado ni produce error.', async () => {
    const r = await api('GET', '/api/solicitudes?q=' + encodeURIComponent("' OR 1=1 -- "));
    return { ok: r.status === 200 && r.datos.total === 0, real: `HTTP ${r.status}; resultados: ${r.datos.total}.` };
  });

  await caso('EX-03', 'Registrar un solicitante con <script>alert(1)</script>.', 'Se guarda como texto literal; la interfaz lo muestra con textContent.', async () => {
    const r = await api('POST', '/api/solicitudes', valida({ solicitante: '<script>alert(1)</script>', descripcion: 'Prueba de texto con etiquetas HTML.' }));
    const enBase = await fila(r.datos.solicitud.id);
    await api('DELETE', '/api/solicitudes/' + r.datos.solicitud.id);
    return { ok: r.status === 201 && enBase.solicitante === '<script>alert(1)</script>', real: `HTTP ${r.status}; guardado literal en MySQL y luego eliminado lógicamente.` };
  });

  await caso('EX-04', 'Enviar JSON mal formado y un estado inexistente ("CERRADA").', 'HTTP 400 con mensaje claro, sin trazas internas.', async () => {
    const r1 = await api('POST', '/api/solicitudes', '{"solicitante": ');
    const lista = (await api('GET', '/api/solicitudes')).datos.solicitudes;
    const r2 = await api('PATCH', `/api/solicitudes/${lista[0].id}/estado`, { estado: 'CERRADA' });
    const sinTraza = !JSON.stringify(r1.datos).includes('at ') && !JSON.stringify(r1.datos).includes('\\\\');
    return { ok: r1.status === 400 && r2.status === 400 && sinTraza, real: `JSON mal formado: HTTP ${r1.status} "${r1.datos.mensaje}"; estado CERRADA: HTTP ${r2.status}.` };
  });

  const aprobados = resultados.filter((r) => r.estado === 'APROBADO').length;
  console.log(`\n${aprobados}/${resultados.length} casos aprobados.`);
  fs.writeFileSync(path.join(__dirname, 'resultados.json'), JSON.stringify({ fecha: new Date().toISOString(), resultados }, null, 2));

  await new Promise((ok) => main.servidor.close(ok));
  await pool.end();
  process.exit(aprobados === resultados.length ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Error al ejecutar las pruebas:', err.message);
  process.exit(1);
});
