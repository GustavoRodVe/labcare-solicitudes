// Ejecuta database/labcare.sql con el usuario configurado en .env.
// Uso: npm run db:init  (el usuario necesita permisos sobre labcare_db)
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const script = fs.readFileSync(path.join(__dirname, 'labcare.sql'), 'utf8');
  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });
  const resultados = await conexion.query(script);
  const equipos = resultados[0][resultados[0].length - 1];
  console.log('Base de datos creada. Equipos semilla:');
  console.table(equipos);
  await conexion.end();
}

main().catch((err) => {
  console.error('No se pudo inicializar la base de datos:', err.message);
  process.exit(1);
});
