const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const verificarToken = require('../middlewares/authMiddleware');

// Rutas Públicas
router.post('/login', userController.login);

// Rutas Protegidas (CRUD Usuarios)
router.get('/', verificarToken, userController.getUsers);
router.post('/register', verificarToken, userController.createUser);
router.put('/:id', verificarToken, userController.updateUser);
router.patch('/:id/password', verificarToken, userController.updatePassword);
router.delete('/:id', verificarToken, userController.deleteUser);
router.get('/roles', verificarToken, userController.getRoles);

module.exports = router;