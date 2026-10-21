-- Script de Base de Datos para Nueva Plantilla
-- Base de Datos: Sistema Base con Login, Usuarios y Subida de Archivos

CREATE DATABASE IF NOT EXISTS `mi_nuevo_proyecto` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `mi_nuevo_proyecto`;

-- 1. Tabla de Roles
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rol` VARCHAR(100) NOT NULL,
  `estatus` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `usuario` VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `nombres` VARCHAR(200) NOT NULL,
  `rol_id` INT DEFAULT 1,
  `estatus` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabla de Archivos
CREATE TABLE IF NOT EXISTS `archivos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre_archivo` VARCHAR(255) NOT NULL,
  `persona_id` INT DEFAULT NULL,
  `ruta_archivo` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Datos Iniciales de Ejemplo
INSERT INTO `roles` (`id`, `rol`, `estatus`) VALUES
(1, 'Administrador', 1),
(2, 'Usuario', 1)
ON DUPLICATE KEY UPDATE `rol` = VALUES(`rol`);

-- Usuario Administrador por defecto:
-- Usuario: admin@ejemplo.com
-- Contraseña inicial: admin123 (hash bcrypt)
INSERT INTO `users` (`id`, `usuario`, `password`, `nombres`, `rol_id`, `estatus`) VALUES
(1, 'admin@ejemplo.com', '$2b$10$32rB0HjQ3qT.W3zU8iM2e.FzHkS4M92c5vVf0vM38QxOaHwGfGzSy', 'Administrador General', 1, 1)
ON DUPLICATE KEY UPDATE `usuario` = VALUES(`usuario`);
