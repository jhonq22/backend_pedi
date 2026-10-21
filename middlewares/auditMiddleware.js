// middlewares/auditMiddleware.js

/**
 * Middleware para inyectar datos de auditoría estándar en req.audit
 * Estos campos coinciden con las columnas de auditoría en la base de datos:
 * - audit_usu_id
 * - audit_ip
 * - audit_dep_id
 */
const inyectarAuditoria = (req, res, next) => {
    const usuarioId = req.usuario?.id ? String(req.usuario.id) : (req.usuario?.usuario || 'SISTEMA');
    
    // Obtener IP del cliente (considerando proxies inversos)
    const rawIp = req.headers['x-forwarded-for'] || 
                  req.socket?.remoteAddress || 
                  req.ip || 
                  '127.0.0.1';
    // Limpiar formato IPv6 de localhost (::ffff:127.0.0.1 o ::1)
    const auditIp = typeof rawIp === 'string' ? rawIp.replace(/^.*:/, '') || '127.0.0.1' : '127.0.0.1';
    
    // Departamento / servicio clínico asignado
    const auditDepId = req.headers['x-departamento-id'] || 
                       (req.usuario?.dep_id ? String(req.usuario.dep_id) : '1'); // 1 = Cardiología / Pediatría por defecto

    req.audit = {
        audit_usu_id: usuarioId,
        audit_ip: auditIp.substring(0, 45),
        audit_dep_id: auditDepId.substring(0, 50)
    };

    next();
};

module.exports = inyectarAuditoria;
