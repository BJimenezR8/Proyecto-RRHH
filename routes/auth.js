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
router.get('/formulario-candidato', authController.isLoggedIn, authController.mostrarFormularioCandidato);
router.get('/editarAplicacion/:id', authController.isLoggedIn, authController.mostrarFormularioEdicion);
router.post('/actualizarAplicacion', authController.isLoggedIn, authController.actualizarAplicacion);
router.post('/guardarAplicacion', authController.isLoggedIn, authController.guardarAplicacion);

router.get('/perfil', authController.isLoggedIn, authController.mostrarPerfil);

router.post('/agregarCompetencia', authController.isLoggedIn, authController.agregarCompetencia);
router.get('/editarCompetencia/:id', authController.isLoggedIn, authController.mostrarFormularioEdicionCompetencia);
router.post('/actualizarCompetencia', authController.isLoggedIn, authController.actualizarCompetencia);
router.post('/eliminarCompetencia', authController.isLoggedIn, authController.eliminarCompetencia);

router.post('/agregarExperiencia', authController.isLoggedIn, authController.agregarExperiencia);
router.get('/editarExperiencia/:id', authController.isLoggedIn, authController.mostrarFormularioEdicionExperiencia);
router.post('/actualizarExperiencia', authController.isLoggedIn, authController.actualizarExperiencia);
router.post('/eliminarExperiencia', authController.isLoggedIn, authController.eliminarExperiencia);

router.post('/agregarIdioma', authController.isLoggedIn, authController.agregarIdioma);
router.get('/editarIdioma/:id', authController.isLoggedIn, authController.mostrarFormularioEdicionIdioma);
router.post('/actualizarIdioma', authController.isLoggedIn, authController.actualizarIdioma);
router.post('/eliminarIdioma', authController.isLoggedIn, authController.eliminarIdioma);

router.post('/agregarCapacitacion', authController.isLoggedIn, authController.agregarCapacitacion);
router.get('/editarCapacitacion/:id', authController.isLoggedIn, authController.mostrarFormularioEdicionCapacitacion);
router.post('/actualizarCapacitacion', authController.isLoggedIn, authController.actualizarCapacitacion);
router.post('/eliminarCapacitacion', authController.isLoggedIn, authController.eliminarCapacitacion);

router.post('/agregarCandidato', authController.isLoggedIn, authController.agregarCandidato);
router.get('/editarCandidato/:id', authController.isLoggedIn, authController.mostrarFormularioEdicionCandidato);
router.post('/actualizarCandidato', authController.isLoggedIn, authController.actualizarCandidato);
router.post('/eliminarCandidato', authController.isLoggedIn, authController.eliminarCandidato);
router.get('/candidatos', authController.isLoggedIn, authController.mostrarCandidatos);

router.get('/puestos', authController.isLoggedIn, (req, res) => {
  db.query('SELECT id, nombre FROM puestos WHERE estado = "Activo"', (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).send('Error al obtener los puestos disponibles');
    }
    res.json(results);
  });
});


module.exports = router;