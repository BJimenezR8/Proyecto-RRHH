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

router.get('/puestos', authController.puestos);

router.post('/aplicarPuesto', authController.isLoggedIn, authController.aplicarPuesto);


module.exports = router;