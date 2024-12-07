const express = require('express');

const authController = require('../controllers/auth');

const router = express.Router();

router.get('/', authController.isLoggedIn, (req, res) => {
  res.render('index', {
    user: req.user
  });
});

router.get('/registro', (req, res) => {
  res.render('registro');
});

router.get('/login', (req, res) => {  
  res.render('login');
});

/* router.get('/usuario', (req, res) => {
  res.render('usuario/usuario');
}); */

router.get('/puestos', (req, res) => {
  res.render('usuario/puestos');
});

router.get('/admin', authController.isLoggedIn, (req, res) => {
  res.render('admin/admin', {
    username: req.user.username
  });
});

router.get('/empleados', (req, res) => {
  res.render('admin/empleados');
});

router.get('/candidatos', (req, res) => {
  res.render('admin/candidatos');
});

router.get('/reportes', (req, res) => {
  res.render('admin/reportes');
});

router.get('/trabajos', (req, res) => {
  res.render('admin/trabajos');
});

router.get('/logout', (req, res) => {
  res.render('logout');
});

router.get('/formulario-candidatos', (req, res) => {
  res.render('usuario/formulario-candidatos');
});

router.get('perfil', authController.isLoggedIn,(req, res) => {
  res.render('usuario/perfil');
});

router.get('candidatos', authController.isLoggedIn,(req, res) => {
  res.render('admin/candidatos');
});

router.get('/editar-candidato',authController.isLoggedIn, (req, res) => {
  res.render('admin/editar-candidato');
});


router.get('/agregar-competencia',authController.isLoggedIn, (req, res) => {
  res.render('usuario/agregar-competencia');
});

router.get('/agregar-idioma', (req, res) => {
  res.render('usuario/agregar-idioma');
});

router.get('/agregar-experiencia', (req, res) => {
  res.render('usuario/agregar-experiencia');
});

router.get('/agregar-capacitacion', (req, res) => {
  res.render('usuario/agregar-capacitacion');
});


router.get('/usuario', authController.isLoggedIn, (req, res) => {
  if (req.user) {
    if (req.user.rol === 'admin') {
      res.render('admin/admin');
    } else {
      res.render('usuario/usuario', {
        user: req.user
      });
    }
  } else {
    res.redirect('/login');
  }
});


module.exports = router;