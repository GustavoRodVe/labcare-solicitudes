// Rutas de la API REST del módulo de solicitudes.
const express = require('express');
const controlador = require('../controllers/solicitudController');

const router = express.Router();

router.get('/equipos', controlador.equipos);

router.get('/solicitudes', controlador.listar);
router.get('/solicitudes/:id', controlador.detalle);
router.post('/solicitudes', controlador.crear);
router.put('/solicitudes/:id', controlador.actualizar);
router.patch('/solicitudes/:id/estado', controlador.cambiarEstado);
router.delete('/solicitudes/:id', controlador.eliminar);

// Cualquier otra ruta de la API responde 404 en JSON.
router.use((req, res) => res.status(404).json({ mensaje: 'Recurso no encontrado.' }));

module.exports = router;
