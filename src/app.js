// Punto de entrada de la aplicación LabCare.
require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const apiRoutes = require('./routes/apiRoutes');
const vistaRoutes = require('./routes/vistaRoutes');
const manejarErrores = require('./middlewares/manejoErrores');
const { probarConexion } = require('./config/db');

const app = express();

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', apiRoutes);
app.use('/', vistaRoutes);

app.use((req, res) => res.status(404).send('Página no encontrada.'));
app.use(manejarErrores);

const PORT = Number(process.env.PORT) || 3000;

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`LabCare escuchando en http://localhost:${PORT}`);
    try {
      console.log(`Conectado a la base de datos ${await probarConexion()}.`);
    } catch (err) {
      console.error('Aviso: no se pudo conectar a MySQL:', err.code || err.message);
    }
  });
}

module.exports = app;
