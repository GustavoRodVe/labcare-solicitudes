// Recorre la interfaz con Playwright y guarda capturas como evidencia en
// evidencias/capturas. También captura consultas reales hechas con el cliente mysql.
// Requisitos: Playwright instalado de forma global (npm i -g playwright) y MySQL activo.
// Uso: node pruebas/capturas-ui.js   (reinicia la base con los datos semilla)
require('dotenv').config({ quiet: true });
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'evidencias', 'capturas');
const PUERTO = 3200;
const URL = `http://localhost:${PUERTO}`;
const MYSQL = process.env.MYSQL_CLI || 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function iniciarServidor() {
  const proceso = spawn(process.execPath, ['src/app.js'], { cwd: RAIZ, env: { ...process.env, PORT: String(PUERTO) }, stdio: 'ignore' });
  return esperar(1500).then(() => proceso);
}

// Ejecuta una consulta con el cliente mysql y devuelve la salida en formato tabla.
function consultaMysql(sql) {
  return execFileSync(MYSQL, ['-t', '--default-character-set=utf8mb4', '-h', process.env.DB_HOST, '-P', process.env.DB_PORT, '-u', process.env.DB_USER, process.env.DB_NAME, '-e', sql], {
    env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD }
  }).toString();
}

async function main() {
  execSync('node database/inicializar.js', { cwd: RAIZ, stdio: 'ignore' });
  let servidor = await iniciarServidor();
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1366, height: 768 } });
  global.paginaActual = pagina;
  const captura = async (nombre, completa = false) => {
    await esperar(250);
    await pagina.screenshot({ path: path.join(SALIDA, nombre + '.png'), fullPage: completa });
    console.log('Captura:', nombre);
  };
  const registrar = async (equipo, solicitante, descripcion, prioridad) => {
    await pagina.selectOption('#equipo_id', { label: equipo });
    await pagina.fill('#solicitante', solicitante);
    await pagina.fill('#descripcion', descripcion);
    await pagina.selectOption('#prioridad', prioridad);
    await clicConExito('#btn-guardar');
  };
  // Hace clic y espera la respuesta real del servidor y el listado actualizado.
  const clicConExito = async (selector) => {
    await pagina.evaluate(() => { document.getElementById('mensaje').className = 'mensaje oculto'; });
    const recarga = pagina.waitForResponse((r) => r.request().method() === 'GET' && r.url().includes('/api/solicitudes'));
    await pagina.click(selector);
    await pagina.waitForSelector('#mensaje.exito');
    await recarga;
    await esperar(200);
  };
  const fila = (texto) => pagina.locator('#cuerpo-tabla tr', { hasText: texto });

  await pagina.goto(URL);
  await pagina.waitForSelector('#equipo_id option[value="1"]', { state: 'attached' });
  await captura('01-pantalla-inicial');

  await registrar('EQ-001 - Computadora de escritorio (Laboratorio 1)', 'María Fernández', 'La computadora no enciende al presionar el botón.', 'ALTA');
  await captura('02-registro-exito');
  await registrar('EQ-002 - Proyector multimedia (Aula 204)', 'Carlos Quispe', 'El proyector muestra la imagen borrosa.', 'BAJA');
  await registrar('EQ-003 - Router de laboratorio (Laboratorio de Redes)', 'Lucía Mamani', 'El router pierde la conexión cada hora.', 'MEDIA');
  await registrar('EQ-004 - Impresora de oficina (Secretaría)', 'Jorge Vargas', 'La impresora atasca el papel en cada hoja.', 'ALTA');
  await pagina.waitForTimeout(300);
  await captura('03-listado');

  // Validación en el navegador
  await pagina.fill('#solicitante', 'Al');
  await pagina.fill('#descripcion', 'Falla');
  await pagina.click('#btn-guardar');
  await captura('04-validacion-interfaz');
  // Se recarga la pantalla para seguir el recorrido desde un formulario limpio.
  await pagina.reload();
  await pagina.waitForSelector('#cuerpo-tabla .codigo');

  // Detalle
  await fila('María Fernández').getByRole('button', { name: 'Ver' }).click();
  await pagina.waitForSelector('#dlg-detalle[open]');
  await captura('05-detalle');
  await pagina.click('#dlg-detalle [data-cerrar]');

  // Edición
  await fila('Carlos Quispe').getByRole('button', { name: 'Editar' }).click();
  await pagina.waitForSelector('#btn-cancelar:not(.oculto)');
  await pagina.fill('#descripcion', 'El proyector muestra la imagen borrosa y parpadea.');
  await pagina.selectOption('#prioridad', 'MEDIA');
  await captura('06-edicion');
  await clicConExito('#btn-guardar');
  await captura('07-edicion-exito');

  // Cambio de estado permitido: PENDIENTE -> EN_PROCESO
  await fila('María Fernández').getByRole('button', { name: 'Estado' }).click();
  await pagina.waitForSelector('#dlg-estado[open]');
  await pagina.selectOption('#estado-nuevo', 'EN_PROCESO');
  await captura('08-estado-dialogo');
  await clicConExito('#btn-confirmar-estado');
  await captura('09-estado-en-proceso');

  // EN_PROCESO -> RESUELTA y luego intento RESUELTA -> PENDIENTE
  await fila('María Fernández').getByRole('button', { name: 'Estado' }).click();
  await pagina.selectOption('#estado-nuevo', 'RESUELTA');
  await clicConExito('#btn-confirmar-estado');
  await fila('María Fernández').getByRole('button', { name: 'Estado' }).click();
  await pagina.selectOption('#estado-nuevo', 'PENDIENTE');
  await captura('10-transicion-no-permitida');
  await pagina.click('#dlg-estado [data-cerrar]');

  // Eliminación lógica con confirmación
  await fila('Jorge Vargas').getByRole('button', { name: 'Eliminar' }).click();
  await pagina.waitForSelector('#dlg-eliminar[open]');
  await captura('11-confirmar-eliminar');
  await clicConExito('#btn-confirmar-eliminar');
  await captura('12-eliminado');

  // Búsqueda y filtros
  await pagina.fill('#f-texto', 'proyector');
  await pagina.waitForTimeout(700);
  await captura('13-busqueda-equipo');
  await pagina.fill('#f-texto', 'MAMANI');
  await pagina.waitForTimeout(700);
  await captura('14-busqueda-solicitante');
  await pagina.click('#btn-limpiar');
  await pagina.selectOption('#f-prioridad', 'MEDIA');
  await pagina.selectOption('#f-estado', 'PENDIENTE');
  await pagina.waitForTimeout(500);
  await captura('15-filtros');
  await pagina.click('#btn-limpiar');

  // Persistencia: se detiene la aplicación por completo y se vuelve a iniciar
  servidor.kill();
  await esperar(800);
  servidor = await iniciarServidor();
  await pagina.reload();
  await pagina.waitForSelector('#cuerpo-tabla .codigo');
  await captura('16-tras-reiniciar');

  // Pruebas del backend enviadas desde el navegador sin pasar por el formulario
  await pagina.goto(URL + '/api/equipos');
  await pagina.evaluate(async () => {
    const pedir = async (metodo, url, cuerpo) => {
      const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
      return `${metodo} ${url} ${cuerpo ? JSON.stringify(cuerpo) : ''}\n-> HTTP ${r.status} ${await r.text()}\n`;
    };
    const lista = await (await fetch('/api/solicitudes')).json();
    const resuelta = (await (await fetch('/api/solicitudes?estado=RESUELTA')).json()).solicitudes[0];
    const salida = [
      await pedir('POST', '/api/solicitudes', { equipo_id: 1, solicitante: '  Al ', descripcion: 'Falla', prioridad: 'URGENTE' }),
      await pedir('POST', '/api/solicitudes', { equipo_id: 999, solicitante: 'Ana Rojas', descripcion: 'No funciona el teclado del equipo.', prioridad: 'ALTA' }),
      await pedir('PATCH', `/api/solicitudes/${resuelta.id}/estado`, { estado: 'PENDIENTE' }),
      await pedir('GET', '/api/solicitudes/999999'),
      await pedir('PUT', '/api/solicitudes/999999', { equipo_id: 1, solicitante: 'Ana Rojas', descripcion: 'No funciona el teclado del equipo.', prioridad: 'ALTA' }),
      `Solicitudes activas en este momento: ${lista.total}`
    ].join('\n');
    document.body.innerHTML = '';
    const pre = document.createElement('pre');
    pre.id = 'salida';
    pre.style.cssText = 'font: 14px Consolas, monospace; white-space: pre-wrap; padding: 16px; margin: 0; width: 860px; background: #fff; border: 1px solid #ccc;';
    pre.textContent = 'Peticiones a la API enviadas desde el navegador (sin validación de la interfaz)\n\n' + salida;
    document.body.appendChild(pre);
  });
  await pagina.locator('#salida').screenshot({ path: path.join(SALIDA, '17-backend-rechaza.png') });
  console.log('Captura: 17-backend-rechaza');

  // Evidencia de la base de datos con el cliente mysql
  const bloques = [
    ['18-bd-equipos', 'SELECT * FROM equipo;'],
    ['19-bd-solicitudes', 'SELECT id, codigo_solicitud, equipo_id, solicitante, prioridad, estado, fecha_registro, activo FROM solicitud;'],
    ['20-bd-restricciones', "SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE, TABLE_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = 'labcare_db' ORDER BY TABLE_NAME, CONSTRAINT_TYPE;"]
  ];
  for (const [nombre, sql] of bloques) {
    const texto = `mysql> ${sql}\n${consultaMysql(sql)}`;
    await pagina.setContent('<pre id="t" style="font: 14px Consolas, monospace; background:#0c0c0c; color:#e6e6e6; padding:16px; margin:0; display:inline-block; white-space:pre;"></pre>');
    await pagina.evaluate((t) => { document.getElementById('t').textContent = t; }, texto);
    await pagina.locator('#t').screenshot({ path: path.join(SALIDA, nombre + '.png') });
    console.log('Captura:', nombre);
  }

  // Vista en pantalla angosta
  const movil = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  await movil.goto(URL);
  await movil.waitForSelector('#cuerpo-tabla .codigo');
  await movil.screenshot({ path: path.join(SALIDA, '21-pantalla-angosta.png') });
  console.log('Captura: 21-pantalla-angosta');

  await navegador.close();
  servidor.kill();
}

main().catch(async (err) => {
  console.error('Error en el recorrido:', err.message);
  if (global.paginaActual) await global.paginaActual.screenshot({ path: path.join(SALIDA, 'error.png') }).catch(() => {});
  process.exit(1);
});
