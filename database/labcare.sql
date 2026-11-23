-- Script de base de datos del módulo de solicitudes de mantenimiento de LabCare.
-- Motor: MySQL 8.4 (las restricciones CHECK se aplican desde MySQL 8.0.16).
-- Crea la base, las tablas equipo y solicitud, sus restricciones y los cuatro equipos semilla.
-- No contiene contraseñas: el usuario de la aplicación se crea aparte (ver README.md).

CREATE DATABASE IF NOT EXISTS labcare_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE labcare_db;

-- Se borra primero la tabla hija para no romper la clave foránea.
DROP TABLE IF EXISTS solicitud;
DROP TABLE IF EXISTS equipo;

-- Catálogo de equipos. Para este examen solo se consulta desde la aplicación.
CREATE TABLE equipo (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo     VARCHAR(10)  NOT NULL,
  nombre     VARCHAR(100) NOT NULL,
  ubicacion  VARCHAR(100) NOT NULL,
  estado     VARCHAR(20)  NOT NULL DEFAULT 'OPERATIVO',
  CONSTRAINT pk_equipo PRIMARY KEY (id),
  CONSTRAINT uq_equipo_codigo UNIQUE (codigo),
  CONSTRAINT ck_equipo_estado CHECK (estado IN ('OPERATIVO', 'EN_MANTENIMIENTO', 'DE_BAJA'))
) ENGINE = InnoDB;

-- Solicitudes de mantenimiento. "activo" permite la eliminación lógica.
CREATE TABLE solicitud (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo_solicitud    VARCHAR(20)  NOT NULL,
  equipo_id           INT UNSIGNED NOT NULL,
  solicitante         VARCHAR(100) NOT NULL,
  descripcion         VARCHAR(500) NOT NULL,
  prioridad           VARCHAR(5)   NOT NULL,
  estado              VARCHAR(12)  NOT NULL DEFAULT 'PENDIENTE',
  fecha_registro      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  activo              BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT pk_solicitud PRIMARY KEY (id),
  CONSTRAINT uq_solicitud_codigo UNIQUE (codigo_solicitud),
  CONSTRAINT fk_solicitud_equipo FOREIGN KEY (equipo_id) REFERENCES equipo (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT ck_solicitud_prioridad CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA')),
  CONSTRAINT ck_solicitud_estado CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'RESUELTA', 'CANCELADA')),
  CONSTRAINT ck_solicitud_solicitante CHECK (CHAR_LENGTH(TRIM(solicitante)) >= 3),
  CONSTRAINT ck_solicitud_descripcion CHECK (CHAR_LENGTH(TRIM(descripcion)) >= 10),
  INDEX ix_solicitud_filtros (activo, estado, prioridad)
) ENGINE = InnoDB;

-- Datos semilla entregados en el enunciado del examen.
INSERT INTO equipo (codigo, nombre, ubicacion, estado) VALUES
  ('EQ-001', 'Computadora de escritorio', 'Laboratorio 1', 'OPERATIVO'),
  ('EQ-002', 'Proyector multimedia', 'Aula 204', 'OPERATIVO'),
  ('EQ-003', 'Router de laboratorio', 'Laboratorio de Redes', 'OPERATIVO'),
  ('EQ-004', 'Impresora de oficina', 'Secretaría', 'OPERATIVO');

-- Comprobación de los datos semilla.
SELECT id, codigo, nombre, ubicacion, estado FROM equipo ORDER BY codigo;
