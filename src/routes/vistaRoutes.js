// Rutas de las vistas. La pantalla principal se arma con EJS y luego
// consume la API desde public/js/app.js.
const express = require('express');
const { PRIORIDADES, ESTADOS } = require('../validators/solicitudValidator');
const { TRANSICIONES } = require('../services/solicitudService');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', { prioridades: PRIORIDADES, estados: ESTADOS, transiciones: TRANSICIONES });
});

module.exports = router;
