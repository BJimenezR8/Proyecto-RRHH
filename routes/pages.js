const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index');
});

router.get('/registro', (req, res) => {
  res.render('registro');
});

router.get('/login', (req, res) => {  
  res.render('login');
});

router.get('/usuario', (req, res) => {
  res.render('usuario/usuario');
});

router.get('/aplicaciones', (req, res) => {
  res.render('usuario/aplicaciones');
});

router.get('/admin', (req, res) => {
  res.render('admin/admin');
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

module.exports = router;