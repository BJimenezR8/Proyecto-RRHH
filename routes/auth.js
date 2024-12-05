const express = require('express');
const authController = require('../controllers/auth');

const router = express.Router();

router.get('/', authController.isLoggedIn, (req, res) => {
    res.render('index', {
      user: req.user
    });
  });

router.post('/registro', authController.registro);

router.post('/login', authController.login);

router.get('/puestos', authController.isLoggedIn, authController.puestos);

router.get('/usuario', authController.isLoggedIn, authController.getAplicacion);

router.get('/admin', authController.isLoggedIn, (req, res) => {
  res.render('admin/admin', {
    username: req.user.username
  });
});

router.get('/getAplicacion', authController.isLoggedIn, authController.getAplicacion);

router.post('/aplicarPuesto', authController.isLoggedIn, authController.aplicarPuesto);

router.post('/eliminarAplicacion', authController.isLoggedIn, authController.eliminarAplicacion);


module.exports = router;