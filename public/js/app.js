// Lógica de la pantalla principal. Toda operación pasa por la API; los mensajes
// de éxito se muestran solo después de que el servidor responde.
// Los datos del usuario se insertan con textContent para que nunca se interpreten como HTML.
(function () {
  'use strict';

  const TRANSICIONES = JSON.parse(document.getElementById('transiciones').textContent);
  const $ = (id) => document.getElementById(id);

  const form = $('form-solicitud');
  const btnGuardar = $('btn-guardar');
  const btnCancelar = $('btn-cancelar');
  const cuerpoTabla = $('cuerpo-tabla');
  const caja = $('mensaje');

  let solicitudesActuales = [];
  let seleccionada = null;
  let temporizadorMensaje = null;
  let temporizadorBusqueda = null;

  // Llama a la API y devuelve { ok, status, datos } sin lanzar errores HTTP.
  async function api(metodo, url, cuerpo) {
    const opciones = { method: metodo, headers: { Accept: 'application/json' } };
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
    try {
      const respuesta = await fetch(url, opciones);
      const datos = await respuesta.json().catch(() => ({}));
      return { ok: respuesta.ok, status: respuesta.status, datos };
    } catch (err) {
      return { ok: false, status: 0, datos: { mensaje: 'No hay conexión con el servidor. Verifique que la aplicación esté en ejecución.' } };
    }
  }

  function mostrarMensaje(tipo, texto) {
    clearTimeout(temporizadorMensaje);
    caja.className = 'mensaje ' + tipo;
    caja.textContent = texto;
    if (tipo === 'exito') temporizadorMensaje = setTimeout(() => caja.classList.add('oculto'), 6000);
  }

  function formatearFecha(texto) {
    if (!texto) return '';
    const [fecha, hora = ''] = texto.split(' ');
    const [a, m, d] = fecha.split('-');
    return `${d}/${m}/${a} ${hora.slice(0, 5)}`;
  }

  function etiqueta(texto, clase) {
    const span = document.createElement('span');
    span.className = 'etiqueta ' + clase;
    span.textContent = texto.replace('_', ' ');
    return span;
  }

  function celda(contenido, clase) {
    const td = document.createElement('td');
    if (clase) td.className = clase;
    if (contenido instanceof Node) td.appendChild(contenido);
    else td.textContent = contenido;
    return td;
  }

  function boton(texto, accion, id, clase) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn chico' + (clase ? ' ' + clase : '');
    b.textContent = texto;
    b.dataset.accion = accion;
    b.dataset.id = id;
    return b;
  }

  // ---------- Listado, búsqueda y filtros ----------

  function filtrosActuales() {
    const p = new URLSearchParams();
    const texto = $('f-texto').value.trim();
    if (texto) p.set('q', texto);
    if ($('f-prioridad').value) p.set('prioridad', $('f-prioridad').value);
    if ($('f-estado').value) p.set('estado', $('f-estado').value);
    return p.toString();
  }

  async function cargarSolicitudes() {
    const consulta = filtrosActuales();
    const r = await api('GET', '/api/solicitudes' + (consulta ? '?' + consulta : ''));
    if (!r.ok) {
      cuerpoTabla.replaceChildren();
      const tr = document.createElement('tr');
      tr.appendChild(celda('No se pudo cargar el listado.', 'vacio')).colSpan = 7;
      cuerpoTabla.appendChild(tr);
      mostrarMensaje('error', r.datos.mensaje || 'No se pudo cargar el listado.');
      return;
    }
    solicitudesActuales = r.datos.solicitudes;
    pintarTabla(solicitudesActuales, Boolean(consulta));
  }

  function pintarTabla(lista, conFiltros) {
    $('total').textContent = `(${lista.length})`;
    cuerpoTabla.replaceChildren();
    if (!lista.length) {
      const tr = document.createElement('tr');
      const td = celda(conFiltros ? 'No hay solicitudes que coincidan con la búsqueda.' : 'Todavía no hay solicitudes registradas.', 'vacio');
      td.colSpan = 7;
      tr.appendChild(td);
      cuerpoTabla.appendChild(tr);
      return;
    }
    for (const s of lista) {
      const tr = document.createElement('tr');
      tr.appendChild(celda(s.codigo_solicitud, 'codigo'));
      tr.appendChild(celda(`${s.equipo_codigo} - ${s.equipo_nombre}`));
      tr.appendChild(celda(s.solicitante));
      tr.appendChild(celda(etiqueta(s.prioridad, 'p-' + s.prioridad)));
      tr.appendChild(celda(etiqueta(s.estado, 'e-' + s.estado)));
      tr.appendChild(celda(formatearFecha(s.fecha_registro)));
      const acciones = document.createElement('div');
      acciones.className = 'acciones';
      acciones.append(
        boton('Ver', 'ver', s.id),
        boton('Editar', 'editar', s.id),
        boton('Estado', 'estado', s.id),
        boton('Eliminar', 'eliminar', s.id)
      );
      tr.appendChild(celda(acciones));
      cuerpoTabla.appendChild(tr);
    }
  }

  async function cargarEquipos() {
    const select = $('equipo_id');
    const r = await api('GET', '/api/equipos');
    select.replaceChildren();
    const vacia = new Option(r.ok ? 'Seleccione un equipo...' : 'No se pudieron cargar los equipos', '');
    select.appendChild(vacia);
    if (!r.ok) {
      mostrarMensaje('error', r.datos.mensaje || 'No se pudieron cargar los equipos.');
      return;
    }
    for (const e of r.datos.equipos) {
      select.appendChild(new Option(`${e.codigo} - ${e.nombre} (${e.ubicacion})`, e.id));
    }
  }

  // ---------- Registro y edición ----------

  function limpiarErrores() {
    form.querySelectorAll('.error-campo').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('.invalido').forEach((el) => el.classList.remove('invalido'));
  }

  function mostrarErrores(errores) {
    for (const [campo, texto] of Object.entries(errores || {})) {
      const aviso = form.querySelector(`.error-campo[data-campo="${campo}"]`);
      if (aviso) aviso.textContent = texto;
      const control = $(campo);
      if (control) control.classList.add('invalido');
    }
  }

  // Validación en el navegador para avisar rápido. El servidor vuelve a validar todo.
  function validarEnCliente(datos) {
    const errores = {};
    if (!datos.equipo_id) errores.equipo_id = 'Seleccione un equipo.';
    if (datos.solicitante.trim().length < 3) errores.solicitante = 'El solicitante debe tener al menos 3 caracteres.';
    if (datos.descripcion.trim().length < 10) errores.descripcion = 'La descripción debe tener al menos 10 caracteres.';
    if (!['BAJA', 'MEDIA', 'ALTA'].includes(datos.prioridad)) errores.prioridad = 'Seleccione una prioridad.';
    return errores;
  }

  function modoRegistro() {
    form.reset();
    $('solicitud-id').value = '';
    $('titulo-form').textContent = 'Nueva solicitud';
    btnGuardar.textContent = 'Registrar solicitud';
    btnCancelar.classList.add('oculto');
    form.parentElement.classList.remove('editando');
    limpiarErrores();
  }

  function modoEdicion(s) {
    limpiarErrores();
    $('solicitud-id').value = s.id;
    $('equipo_id').value = String(s.equipo_id);
    $('solicitante').value = s.solicitante;
    $('descripcion').value = s.descripcion;
    $('prioridad').value = s.prioridad;
    $('titulo-form').textContent = 'Editar ' + s.codigo_solicitud;
    btnGuardar.textContent = 'Guardar cambios';
    btnCancelar.classList.remove('oculto');
    form.parentElement.classList.add('editando');
    $('solicitante').focus();
  }

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limpiarErrores();
    const datos = {
      equipo_id: $('equipo_id').value,
      solicitante: $('solicitante').value,
      descripcion: $('descripcion').value,
      prioridad: $('prioridad').value
    };
    const erroresCliente = validarEnCliente(datos);
    if (Object.keys(erroresCliente).length) {
      mostrarErrores(erroresCliente);
      mostrarMensaje('advertencia', 'Revise los campos marcados.');
      return;
    }
    const id = $('solicitud-id').value;
    btnGuardar.disabled = true;
    const r = id ? await api('PUT', '/api/solicitudes/' + id, datos) : await api('POST', '/api/solicitudes', datos);
    btnGuardar.disabled = false;
    if (r.ok) {
      mostrarMensaje('exito', r.datos.mensaje);
      modoRegistro();
    } else {
      mostrarErrores(r.datos.errores);
      mostrarMensaje(r.status === 400 ? 'advertencia' : 'error', r.datos.mensaje || 'No se pudo guardar la solicitud.');
    }
    // Se recarga siempre para que la tabla refleje lo que hay en la base de datos.
    await cargarSolicitudes();
  });

  btnCancelar.addEventListener('click', modoRegistro);

  // ---------- Acciones de la tabla ----------

  async function obtenerSolicitud(id) {
    const r = await api('GET', '/api/solicitudes/' + id);
    if (!r.ok) {
      mostrarMensaje('error', r.datos.mensaje || 'No se pudo obtener la solicitud.');
      await cargarSolicitudes();
      return null;
    }
    return r.datos.solicitud;
  }

  async function verDetalle(id) {
    const s = await obtenerSolicitud(id);
    if (!s) return;
    const filas = [
      ['ID', s.id],
      ['Código', s.codigo_solicitud],
      ['Equipo', `${s.equipo_codigo} - ${s.equipo_nombre}`],
      ['Ubicación', s.equipo_ubicacion],
      ['Solicitante', s.solicitante],
      ['Descripción', s.descripcion],
      ['Prioridad', s.prioridad],
      ['Estado', s.estado.replace('_', ' ')],
      ['Fecha de registro', formatearFecha(s.fecha_registro)],
      ['Última actualización', formatearFecha(s.fecha_actualizacion)]
    ];
    const dl = $('detalle-datos');
    dl.replaceChildren();
    for (const [nombre, valor] of filas) {
      const dt = document.createElement('dt');
      dt.textContent = nombre;
      const dd = document.createElement('dd');
      dd.textContent = valor;
      dl.append(dt, dd);
    }
    $('dlg-detalle').showModal();
  }

  async function abrirEstado(id) {
    const s = await obtenerSolicitud(id);
    if (!s) return;
    seleccionada = s;
    const permitidos = TRANSICIONES[s.estado] || [];
    $('estado-texto').textContent = `${s.codigo_solicitud} está ${s.estado.replace('_', ' ')}. ` +
      (permitidos.length ? `Puede pasar a: ${permitidos.join(', ').replace(/_/g, ' ')}.` : 'Es un estado final.');
    $('estado-nuevo').value = permitidos[0] || s.estado;
    revisarTransicion();
    $('dlg-estado').showModal();
  }

  // Advierte antes de enviar si la transición elegida no está permitida.
  function revisarTransicion() {
    if (!seleccionada) return false;
    const nuevo = $('estado-nuevo').value;
    const permitido = (TRANSICIONES[seleccionada.estado] || []).includes(nuevo);
    const aviso = $('estado-aviso');
    if (permitido) {
      aviso.classList.add('oculto');
    } else {
      aviso.textContent = `Transición no permitida: de ${seleccionada.estado.replace('_', ' ')} no se puede pasar a ${nuevo.replace('_', ' ')}.`;
      aviso.classList.remove('oculto');
    }
    return permitido;
  }

  $('estado-nuevo').addEventListener('change', revisarTransicion);

  $('btn-confirmar-estado').addEventListener('click', async () => {
    if (!seleccionada) return;
    if (!revisarTransicion()) {
      mostrarMensaje('advertencia', $('estado-aviso').textContent);
      return;
    }
    const boton = $('btn-confirmar-estado');
    boton.disabled = true;
    const r = await api('PATCH', `/api/solicitudes/${seleccionada.id}/estado`, { estado: $('estado-nuevo').value });
    boton.disabled = false;
    $('dlg-estado').close();
    if (r.ok) mostrarMensaje('exito', r.datos.mensaje);
    else mostrarMensaje(r.status === 409 ? 'advertencia' : 'error', r.datos.mensaje || 'No se pudo cambiar el estado.');
    await cargarSolicitudes();
  });

  function abrirEliminar(id) {
    seleccionada = solicitudesActuales.find((s) => s.id === id) || null;
    if (!seleccionada) return;
    $('eliminar-texto').textContent = `¿Eliminar la solicitud ${seleccionada.codigo_solicitud} de ${seleccionada.solicitante}? ` +
      'Dejará de aparecer en el listado, pero el registro se conserva en la base de datos.';
    $('dlg-eliminar').showModal();
  }

  $('btn-confirmar-eliminar').addEventListener('click', async () => {
    if (!seleccionada) return;
    const boton = $('btn-confirmar-eliminar');
    boton.disabled = true;
    const r = await api('DELETE', '/api/solicitudes/' + seleccionada.id);
    boton.disabled = false;
    $('dlg-eliminar').close();
    if (r.ok) {
      mostrarMensaje('exito', r.datos.mensaje);
      if ($('solicitud-id').value === String(seleccionada.id)) modoRegistro();
    } else {
      mostrarMensaje('error', r.datos.mensaje || 'No se pudo eliminar la solicitud.');
    }
    await cargarSolicitudes();
  });

  cuerpoTabla.addEventListener('click', async (evento) => {
    const b = evento.target.closest('button[data-accion]');
    if (!b) return;
    const id = Number(b.dataset.id);
    if (b.dataset.accion === 'ver') return verDetalle(id);
    if (b.dataset.accion === 'estado') return abrirEstado(id);
    if (b.dataset.accion === 'eliminar') return abrirEliminar(id);
    if (b.dataset.accion === 'editar') {
      const s = await obtenerSolicitud(id);
      if (s) modoEdicion(s);
    }
  });

  document.querySelectorAll('dialog [data-cerrar]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  // Filtros: la búsqueda por texto espera a que el usuario deje de escribir.
  $('f-texto').addEventListener('input', () => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(cargarSolicitudes, 300);
  });
  $('f-prioridad').addEventListener('change', cargarSolicitudes);
  $('f-estado').addEventListener('change', cargarSolicitudes);
  $('form-filtros').addEventListener('submit', (e) => { e.preventDefault(); cargarSolicitudes(); });
  $('btn-limpiar').addEventListener('click', () => {
    $('form-filtros').reset();
    cargarSolicitudes();
  });

  cargarEquipos();
  cargarSolicitudes();
})();
