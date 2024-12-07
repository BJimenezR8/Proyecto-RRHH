const mysql = require("mysql");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const moment = require('moment');

const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
});

function validaCedula(cedula) {
  let vnTotal = 0;
  let vcCedula = cedula.replace(/-/g, "");
  let pLongCed = vcCedula.trim().length;
  let digitoMult = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1];

  if (pLongCed !== 11) {
    return false;
  }

  for (let vDig = 1; vDig <= pLongCed; vDig++) {
    let vCalculo = parseInt(vcCedula.charAt(vDig - 1)) * digitoMult[vDig - 1];
    if (vCalculo < 10) {
      vnTotal += vCalculo;
    } else {
      vnTotal +=
        parseInt(vCalculo.toString().charAt(0)) +
        parseInt(vCalculo.toString().charAt(1));
    }
    return vnTotal % 10 === 0;
  }
}

exports.registro = (req, res) => {
  console.log(req.body);

  const { nombre, email, cedula, password, passwordConfirm } = req.body;

  db.query(
    "SELECT email,cedula FROM users WHERE email = ? OR cedula = ?",
    [email, cedula],
    async (error, results) => {
      if (error) {
        console.log(error);
      }

      if (results.length > 0) {
        const emailExists = results.some((row) => row.email === email);
        const cedulaExists = results.some((row) => row.cedula === cedula);

        if (emailExists) {
          return res.render("registro", {
            failed: "El email ya está en uso",
          });
        }

        if (cedulaExists) {
          return res.render("registro", {
            failed: "La cédula ya está en uso",
          });
        }
      }

      if (!validaCedula(cedula)) {
        return res.render("registro", {
          failed: "La cédula no es válida",
        });
      }

      let hashedPassword = await bcrypt.hash(password, 8);
      console.log(hashedPassword);

      db.query(
        "INSERT INTO users SET ?",
        {
          username: nombre,
          email: email,
          cedula: cedula,
          password: hashedPassword,
        },
        (error, results) => {
          if (error) {
            console.log(error);
          } else {
            console.log(results);
            return res.render("registro", {
              success: "Usuario registrado",
            });
          }
        }
      );
    }
  );
};

exports.login = async (req, res) => {
  await db.query(
    "SELECT * FROM users WHERE email = ?",
    [req.body.email],
    async (error, results) => {
      if (error) {
        console.log(error);
      }

      if (
        results.length === 0 ||
        !(await bcrypt.compare(req.body.password, results[0].password))
      ) {
        res.status(401).render("login", {
          failed: "Email o contraseña incorrectos",
        });
      } else {
        console.log("The id is: " + results[0].id);
        console.log("The user is: " + results[0].username);
        const token = jwt.sign(
          { id: results[0].id ,
            username : results[0].username
          },
          process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRES_IN,
        });
        
        req.user = results[0];
        // console.log("The token is: " + token);

        const cookieOptions = {
          expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000
          ),
          httpOnly: true,
        };

        res.cookie("jwt", token, cookieOptions);
        if (results[0].rol === 'admin') {
          res.status(200).redirect("/auth/admin");
        } else if (results[0].rol === 'usuario') {
          res.status(200).redirect("/auth/usuario");
        } else {
          res.status(403).send('Acceso denegado');
        }
      }
    }
  );
}

exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET);

      await db.query(
        "SELECT * FROM users WHERE id = ?",
        [decoded.id],
        (error, results) => {
          if (!results) {
            return next();
          }

          req.user = results[0];
          return next();
        }
      );
    } catch (error) {
      return next();
    }
  } else {
    next();
  }
};

exports.logout = (req, res) => {
  res.cookie("jwt", "logout", {
    expires: new Date(Date.now() + 2 * 1000),
    httpOnly: true,
  });
  res.status(200).redirect("/");
}


exports.puestos = (req, res) => {
  db.query(
    "SELECT p.* FROM puestos p LEFT JOIN aplicaciones a ON p.id = a.puesto_id WHERE a.puesto_id IS NULL  AND p.estado = 'Activo';",
    (error, results) => {
      if (error) {
        console.log(error);
      } else {
        res.render("usuario/puestos", {
          puestos: results,
        });
      }
    }
  );
};

exports.aplicarPuesto = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No estás autenticado');
  }

  const { puestoId, nombre, nivel_riesgo, salario_minimo, salario_maximo, estado } = req.body;
  const userId = req.user.id;

  // Lógica para manejar la aplicación al puesto
  db.query(
    'INSERT INTO aplicaciones (user_id, puesto_id, nombre, nivel_riesgo, salario_minimo, salario_maximo, fecha_aplicacion)  VALUES (?, ?, ?, ?, ?, ?, CURDATE());',
    [userId, puestoId, nombre, nivel_riesgo, salario_minimo, salario_maximo, estado],
    (error, results) => {
      if (error) {
        console.log(error);
        res.status(500).send('Error al aplicar al puesto');
      } else {
        res.redirect('/auth/puestos');
      }
    }
  );
};

exports.getAplicacion = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No estás autenticado');
  }

  const userId = req.user.id;

  // Consulta para obtener las aplicaciones del usuario con los campos adicionales
  db.query(
    'SELECT a.id, p.nombre, p.nivel_riesgo, p.salario_minimo, p.salario_maximo, a.estado, DATE_FORMAT(a.fecha_aplicacion, "%d-%b-%Y") AS fecha_aplicacion, a.departamento, a.salario_aspirante, a.recomendado_por FROM aplicaciones a JOIN puestos p ON a.puesto_id = p.id WHERE a.user_id = ?;',
    [userId],
    (error, results) => {
      if (error) {
        console.log(error);
        res.status(500).send('Error al obtener las aplicaciones');
      } else {
        res.render('usuario/usuario', {
          aplicaciones: results,
          username: req.user.username // Pasar el nombre de usuario a la vista
        });
      }
    }
  );
};

exports.eliminarAplicacion = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No estás autenticado');
  }
  
  const { aplicacionId } = req.body;
  const userId = req.user.id;

  // Consulta para eliminar la aplicación del usuario
  db.query(
    'DELETE FROM aplicaciones WHERE id = ? AND user_id = ?',
    [aplicacionId, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al eliminar la aplicación');
      }

      res.redirect('/auth/usuario');
    }
  );
};

exports.mostrarFormularioCandidato = (req, res) => {
  const { puestoId, nombre, departamento } = req.query;
  const userId = req.user.id;
  const cedula = req.user.cedula; // Asumiendo que la cédula está en req.user
  const nombreUsuario = req.user.username;

  res.render('usuario/formulario-candidato', {
    puestoId,
    nombre,
    departamento,
    userId,
    cedula,
    nombreUsuario
  });
};

exports.guardarAplicacion = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { puestoId, cedula, nombre, salario_aspirante, recomendado_por } = req.body;
  const userId = req.user.id;
  const fechaAplicacion = new Date().toISOString().slice(0, 10); // Fecha actual en formato YYYY-MM-DD

  console.log(req.body); // Verifica los datos aquí

  db.query(
    'SELECT departamento FROM puestos WHERE id = ?',
    [puestoId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener el departamento del puesto');
      }

      if (results.length === 0) {
        return res.status(404).send('Puesto no encontrado');
      }

      const departamento = results[0].departamento;

    // Insertar en la tabla aplicaciones
    db.query(
      'INSERT INTO aplicaciones (user_id, puesto_id, fecha_aplicacion, cedula, nombre, departamento, salario_aspirante, recomendado_por, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, puestoId, fechaAplicacion, cedula, nombre, departamento, salario_aspirante, recomendado_por, 'Activo'],
      (error, results) => {
        if (error) {
          console.log(error);
          return res.status(500).send('Error al aplicar al puesto');
        }

        res.redirect('/auth/usuario');
      }
    );
   }
  );
};

exports.mostrarFormularioEdicion = (req, res) => {
  const aplicacionId = req.params.id;
  const userId = req.user.id;

  // Consulta para obtener los datos de la aplicación
  db.query(
    'SELECT * FROM aplicaciones WHERE id = ? AND user_id = ?',
    [aplicacionId, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener los datos de la aplicación');
      }

      if (results.length === 0) {
        return res.status(404).send('Aplicación no encontrada');
      }

      const aplicacion = results[0];
      res.render('usuario/formulario-candidato', {
        puestoId: aplicacion.puesto_id,
        cedula: aplicacion.cedula,
        nombre: aplicacion.nombre,
        departamento: aplicacion.departamento,
        salario_aspirante: aplicacion.salario_aspirante,
        recomendado_por: aplicacion.recomendado_por,
        aplicacionId: aplicacion.id // Añadir el ID de la aplicación para la actualización
      });
    }
  );
};

exports.actualizarAplicacion = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { aplicacionId, puestoId, cedula, nombre, departamento, salario_aspirante, recomendado_por } = req.body;
  const userId = req.user.id;

  // Consulta para actualizar la aplicación
  db.query(
    'UPDATE aplicaciones SET puesto_id = ?, cedula = ?, nombre = ?, departamento = ?, salario_aspirante = ?, recomendado_por = ? WHERE id = ? AND user_id = ?',
    [puestoId, cedula, nombre, departamento, salario_aspirante, recomendado_por, aplicacionId, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al actualizar la aplicación');
      }

      res.redirect('/auth/usuario');
    }
  );
};


exports.mostrarPerfil = (req, res) => {
  const userId = req.user.id;

  // Consulta para obtener las competencias del usuario
  const queryCompetencias = 'SELECT * FROM competencias WHERE id_user = ?';
  const queryExperienciaLaboral = 'SELECT id, empresa, puesto_ocupado, DATE_FORMAT(fecha_desde, "%d-%b-%Y") AS fecha_desde, DATE_FORMAT(fecha_hasta, "%d-%b-%Y") AS fecha_hasta, salario FROM experiencia_laboral WHERE id_user = ?';
  const queryIdiomas = 'SELECT * FROM idiomas WHERE id_user = ?';
  const queryCapacitaciones = 'SELECT id, descripcion, institucion, DATE_FORMAT(fecha_inicio, "%d-%b-%Y") AS fecha_inicio, DATE_FORMAT(fecha_fin, "%d-%b-%Y") AS fecha_fin, descripcion FROM capacitaciones WHERE id_user = ?';

  db.query(queryCompetencias, [userId], (errorCompetencias, competencias) => {
    if (errorCompetencias) {
      console.log(errorCompetencias);
      return res.status(500).send('Error al obtener las competencias');
    }

    db.query(queryExperienciaLaboral, [userId], (errorExperiencia, experiencia_laboral) => {
      if (errorExperiencia) {
        console.log(errorExperiencia);
        return res.status(500).send('Error al obtener la experiencia laboral');
      }

      db.query(queryIdiomas, [userId], (errorIdiomas, idiomas) => {
        if (errorIdiomas) {
          console.log(errorIdiomas);
          return res.status(500).send('Error al obtener los idiomas');
        }

        db.query(queryCapacitaciones, [userId], (errorCapacitaciones, capacitaciones) => {
          if (errorCapacitaciones) {
            console.log(errorCapacitaciones);
            return res.status(500).send('Error al obtener las capacitaciones');
          }

          res.render('usuario/perfil', {
            competencias: competencias,
            experiencia_laboral: experiencia_laboral,
            idiomas: idiomas,
            capacitaciones: capacitaciones,
            username: req.user.username // Pasar el nombre de usuario a la vista
          });
        });
      });
    });
  });
};
exports.agregarCompetencia = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { descripcion, estado } = req.body;
  const userId = req.user.id;

  // Insertar en la tabla competencias
  db.query(
    'INSERT INTO competencias (id_user, descripcion, estado) VALUES (?, ?, ?)',
    [userId, descripcion, estado],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al agregar la competencia');
      }

      res.redirect('/auth/perfil');
    }
  );
};

exports.editarCompetencia = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { id, descripcion, estado } = req.body;
  const userId = req.user.id;

  // Actualizar la competencia
  db.query(
    'UPDATE competencias SET descripcion = ? WHERE id = ? AND id_user = ?',
    [descripcion, id, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al actualizar la competencia');
      }

      res.redirect('/auth/perfil');
    }
  );
};

exports.eliminarCompetencia = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { id } = req.body;
  const userId = req.user.id;

  // Eliminar la competencia
  db.query(
    'DELETE FROM competencias WHERE id = ? AND id_user = ?',
    [id, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al eliminar la competencia');
      }

      res.redirect('/auth/perfil');
    }
  );
};

exports.mostrarFormularioEdicionCompetencia = (req, res) => {
  const competenciaId = req.params.id;
  const userId = req.user.id;

  // Consulta para obtener los datos de la competencia
  db.query(
    'SELECT * FROM competencias WHERE id = ? AND id_user = ?',
    [competenciaId, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener los datos de la competencia');
      }

      if (results.length === 0) {
        return res.status(404).send('Competencia no encontrada');
      }

      const competencia = results[0];
      res.render('usuario/agregar-competencia', {
        id: competencia.id,
        descripcion: competencia.descripcion,
        estado: competencia.estado
      });
    }
  );
};

exports.actualizarCompetencia = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { id, descripcion, estado } = req.body;
  const userId = req.user.id;

  // Actualizar la competencia
  db.query(
    'UPDATE competencias SET descripcion = ?, estado = ? WHERE id = ? AND id_user = ?',
    [descripcion, estado, id, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al actualizar la competencia');
      }

      res.redirect('/auth/perfil');
    }
  );
};


// Controladores para experiencia laboral
exports.agregarExperiencia = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { empresa, puesto_ocupado, fecha_desde, fecha_hasta, salario } = req.body;
  console.log("experiencia laboral"+ req.body);
  const userId = req.user.id;

  // Insertar en la tabla experiencia_laboral
  db.query(
    'INSERT INTO experiencia_laboral (id_user, empresa, puesto_ocupado, fecha_desde, fecha_hasta, salario) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, empresa, puesto_ocupado, fecha_desde, fecha_hasta, salario],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al agregar la experiencia laboral');
      }

      res.redirect('/auth/perfil');
    }
  );
};

exports.mostrarFormularioEdicionExperiencia = (req, res) => {
  const experienciaId = req.params.id;
  const userId = req.user.id;

  // Consulta para obtener los datos de la experiencia laboral
  db.query(
    'SELECT * FROM experiencia_laboral WHERE id = ? AND id_user = ?',
    [experienciaId, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener los datos de la experiencia laboral');
      }

      if (results.length === 0) {
        return res.status(404).send('Experiencia laboral no encontrada');
      }

      const experiencia = results[0];
      res.render('usuario/agregar-experiencia', {
        id: experiencia.id,
        empresa: experiencia.empresa,
        puesto_ocupado: experiencia.puesto_ocupado,
        fecha_desde: experiencia.fecha_desde,
        fecha_hasta: experiencia.fecha_hasta,
        salario: experiencia.salario
      });
    }
  );
};

exports.actualizarExperiencia = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { id, empresa, puesto_ocupado, fecha_desde, fecha_hasta, salario } = req.body;
  const userId = req.user.id;

  // Actualizar la experiencia laboral
  db.query(
    'UPDATE experiencia_laboral SET empresa = ?, puesto_ocupado = ?, fecha_desde = ?, fecha_hasta = ?, salario = ? WHERE id = ? AND id_user = ?',
    [empresa, puesto_ocupado, fecha_desde, fecha_hasta, salario, id, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al actualizar la experiencia laboral');
      }

      res.redirect('/auth/perfil');
    }
  );
};

exports.eliminarExperiencia = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { id } = req.body;
  const userId = req.user.id;

  // Eliminar la experiencia laboral
  db.query(
    'DELETE FROM experiencia_laboral WHERE id = ? AND id_user = ?',
    [id, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al eliminar la experiencia laboral');
      }

      res.redirect('/auth/perfil');
    }
  );
};

// Controladores para idiomas
exports.agregarIdioma = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { nombre, nivel, estado } = req.body;
  const userId = req.user.id;

  // Insertar en la tabla idiomas
  db.query(
    'INSERT INTO idiomas (id_user, nombre, nivel, estado) VALUES (?, ?, ?, ?)',
    [userId, nombre, nivel, estado],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al agregar el idioma');
      }

      res.redirect('/auth/perfil');
    }
  );
};

exports.mostrarFormularioEdicionIdioma = (req, res) => {
  const idiomaId = req.params.id;
  const userId = req.user.id;

  // Consulta para obtener los datos del idioma
  db.query(
    'SELECT * FROM idiomas WHERE id = ? AND id_user = ?',
    [idiomaId, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener los datos del idioma');
      }

      if (results.length === 0) {
        return res.status(404).send('Idioma no encontrado');
      }

      const idioma = results[0];
      res.render('usuario/agregar-idioma', {
        id: idioma.id,
        nombre: idioma.nombre,
        nivel: idioma.nivel,
        estado: idioma.estado
      });
    }
  );
};

exports.actualizarIdioma = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { id, nombre, nivel, estado } = req.body;
  const userId = req.user.id;

  // Actualizar el idioma
  db.query(
    'UPDATE idiomas SET nombre = ?, nivel = ?, estado = ? WHERE id = ? AND id_user = ?',
    [nombre, nivel, estado, id, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al actualizar el idioma');
      }

      res.redirect('/auth/perfil');
    }
  );
};

exports.eliminarIdioma = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { id } = req.body;
  const userId = req.user.id;

  // Eliminar el idioma
  db.query(
    'DELETE FROM idiomas WHERE id = ? AND id_user = ?',
    [id, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al eliminar el idioma');
      }

      res.redirect('/auth/perfil');
    }
  );
};

// Controladores para capacitaciones
exports.agregarCapacitacion = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { descripcion, nivel, fecha_inicio, fecha_fin, institucion } = req.body;
  const userId = req.user.id;

  // Insertar en la tabla capacitaciones
  db.query(
    'INSERT INTO capacitaciones (id_user, descripcion, nivel, fecha_inicio, fecha_fin, institucion) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, descripcion, nivel, fecha_inicio, fecha_fin, institucion],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al agregar la capacitación');
      }

      // Imprimir los datos del registro agregado en la consola
      console.log('Capacitación agregada:', {
        id: results.insertId,
        id_user: userId,
        descripcion: descripcion,
        nivel: nivel,
        fecha_inicio: fecha_inicio,
        fecha_fin: fecha_fin,
        institucion: institucion
      });

      res.redirect('/auth/perfil');
    }
  );
};

exports.mostrarFormularioEdicionCapacitacion = (req, res) => {
  const capacitacionId = req.params.id;
  const userId = req.user.id;

  // Consulta para obtener los datos de la capacitación
  db.query(
    'SELECT * FROM capacitaciones WHERE id = ? AND id_user = ?',
    [capacitacionId, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener los datos de la capacitación');
      }

      if (results.length === 0) {
        return res.status(404).send('Capacitación no encontrada');
      }

      const capacitacion = results[0];
      res.render('usuario/agregar-capacitacion', {
        id: capacitacion.id,
        descripcion: capacitacion.descripcion,
        nivel: capacitacion.nivel,
        fecha_inicio: capacitacion.fecha_inicio,
        fecha_fin: capacitacion.fecha_fin,
        institucion: capacitacion.institucion
      });
    }
  );
};

exports.actualizarCapacitacion = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { id, descripcion, nivel, fecha_inicio, fecha_fin, institucion } = req.body;
  const userId = req.user.id;

  // Actualizar la capacitación
  db.query(
    'UPDATE capacitaciones SET descripcion = ?, nivel = ?, fecha_inicio = ?, fecha_fin = ?, institucion = ? WHERE id = ? AND id_user = ?',
    [descripcion, nivel, fecha_inicio, fecha_fin, institucion, id, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al actualizar la capacitación');
      }

      res.redirect('/auth/perfil');
    }
  );
};

exports.eliminarCapacitacion = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { id } = req.body;
  const userId = req.user.id;

  // Eliminar la capacitación
  db.query(
    'DELETE FROM capacitaciones WHERE id = ? AND id_user = ?',
    [id, userId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al eliminar la capacitación');
      }

      res.redirect('/auth/perfil');
    }
  );
};

// Controladores para candidatos
exports.agregarCandidato = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { cedula, nombre, departamento, salario_aspirante, recomdado_por } = req.body;
  const userId = req.user.id;

  // Insertar en la tabla candidatos
  db.query(
    'INSERT INTO candidatos (user_id, cedula, nombre, departamento, salario_aspirante, recomdado_por) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, cedula, nombre, departamento, salario_aspirante, recomdado_por],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al agregar el candidato');
      }

      // Imprimir los datos del registro agregado en la consola
      console.log('Candidato agregado:', {
        id: results.insertId,
        user_id: userId,
        cedula: cedula,
        nombre: nombre,
        departamento: departamento,
        salario_aspirante: salario_aspirante,
        recomdado_por: recomdado_por
      });

      res.redirect('/auth/perfil');
    }
  );
};

exports.mostrarFormularioEdicionCandidato = (req, res) => {
  const candidatoId = req.params.id;

  // Consulta para obtener los datos del candidato
  db.query(
    'SELECT a.*, u.username as username FROM aplicaciones a JOIN users u ON a.user_id = u.id WHERE a.id = ?;',
    [candidatoId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener los datos del candidato');
      }

      if (results.length === 0) {
        return res.status(404).send('Candidato no encontrado');
      }

      const candidato = results[0];

      // Consulta para obtener los nombres de puestos únicos
      db.query(
        'SELECT id, nombre FROM puestos WHERE estado = "Activo"',
        (error, puestos) => {
          if (error) {
            console.log(error);
            return res.status(500).send('Error al obtener los puestos disponibles');
          }

          // Imprimir los puestos obtenidos en la consola
          console.log('Puestos disponibles:', puestos);

          res.render('admin/editar-candidato', {
            candidato: candidato,
            puestos_disponibles: puestos
          });
        }
      );
    }
  );
};

exports.actualizarCandidato = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { id, nombre, cedula, departamento, recomendado_por, salario_aspirante } = req.body;

  // Actualizar el candidato
  db.query(
    'UPDATE aplicaciones SET nombre = ?, cedula = ?, departamento = ?,  recomendado_por = ?, salario_aspirante = ? WHERE id = ?',
    [nombre, cedula, departamento, recomendado_por, salario_aspirante, id],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al actualizar el candidato');
      }

      res.redirect('/auth/candidatos');
    }
  );
};

exports.eliminarCandidato = (req, res) => {
  if (!req.user) {
    return res.status(401).send('No autorizado');
  }

  const { id } = req.body;

  // Obtener los datos del candidato antes de eliminarlo
  db.query(
    'SELECT * FROM aplicaciones WHERE id = ?',
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener los datos del candidato');
      }

      if (results.length === 0) {
        return res.status(404).send('Candidato no encontrado');
      }

      const candidato = results[0];

      // Imprimir los datos del candidato en la consola
      console.log('Candidato a eliminar:', candidato);

      // Eliminar el candidato
      db.query(
        'DELETE FROM aplicaciones WHERE id = ?',
        [id],
        (error, results) => {
          if (error) {
            console.log(error);
            return res.status(500).send('Error al eliminar el candidato');
          }

          res.redirect('/auth/candidatos');
        }
      );
    }
  );
};

exports.mostrarCandidatos = (req, res) => {
  db.query('SELECT a.*,a.nombre AS puesto_aplicado, u.username AS nombre FROM aplicaciones a LEFT JOIN puestos p ON a.puesto_id = p.id LEFT JOIN users u ON a.user_id = u.id;', (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).send('Error al obtener los datos de las aplicaciones');
    }

    console.log(results);

    res.render('admin/candidatos', {
      aplicaciones: results
    });
  });
};

// Controlador para contratar un candidato
exports.contratarCandidato = (req, res) => {
  const { id, salario_mensual } = req.body;

  // Obtener los datos del candidato antes de eliminarlo
  db.query(
    'SELECT * FROM aplicaciones WHERE id = ?',
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener los datos del candidato');
      }

      if (results.length === 0) {
        return res.status(404).send('Candidato no encontrado');
      }

      const candidato = results[0];

      // Insertar los datos del candidato en la tabla empleados
      db.query(
        'INSERT INTO empleados (puesto_id, nombre, cedula, departamento, salario) VALUES (?, ?, ?, ?, ?)',
        [candidato.puesto_id, candidato.nombre, candidato.cedula, candidato.departamento, salario_mensual],
        (error, results) => {
          if (error) {
            console.log(error);
            return res.status(500).send('Error al contratar el candidato');
          }

          // Eliminar la aplicación del candidato
          db.query(
            'DELETE FROM aplicaciones WHERE id = ?',
            [id],
            (error, results) => {
              if (error) {
                console.log(error);
                return res.status(500).send('Error al eliminar la aplicación del candidato');
              }

              res.redirect('/auth/candidatos');
            }
          );
        }
      );
    }
  );
};

// Controlador para mostrar la vista de contratar candidato
exports.mostrarFormularioContratarCandidato = (req, res) => {
  const candidatoId = req.params.id;

  // Consulta para obtener los datos del candidato
  db.query(
    'SELECT a.*, p.salario_minimo, p.salario_maximo, u.username FROM aplicaciones a JOIN puestos p ON a.puesto_id = p.id JOIN users u ON u.id = a.user_id WHERE a.id = ?',
    [candidatoId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener los datos del candidato');
      }

      if (results.length === 0) {
        return res.status(404).send('Candidato no encontrado');
      }

      const candidato = results[0];

      res.render('admin/contratar-candidato', {
        candidato: candidato
      });
    }
  );
};



// Obtener todos los puestos
exports.obtenerPuestos = (req, res) => {
  db.query('SELECT * FROM puestos', (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).send('Error al obtener los puestos');
    }
    res.render('admin/trabajos', {
      puestos: results
    });
  });
};
// Obtener un puesto por ID
exports.obtenerPuestoPorId = (req, res) => {
  const puestoId = req.params.id;
  db.query('SELECT * FROM puestos WHERE id = ?', [puestoId], (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).send('Error al obtener el puesto');
    }
    if (results.length === 0) {
      return res.status(404).send('Puesto no encontrado');
    }
    res.json(results[0]);
  });
};

// Crear un nuevo puesto
exports.crearPuesto = (req, res) => {
  const { nombre, nivel_riesgo, salario_minimo, salario_maximo, estado } = req.body;
  db.query(
    'INSERT INTO puestos (nombre, nivel_riesgo, salario_minimo, salario_maximo, estado) VALUES (?, ?, ?, ?, ?)',
    [nombre, nivel_riesgo, salario_minimo, salario_maximo, estado],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al crear el puesto');
      }
      res.status(201).send('Puesto creado exitosamente');
    }
  );
};

// Actualizar un puesto por ID
exports.actualizarPuesto = (req, res) => {
  const puestoId = req.params.id;
  const { nombre, nivel_riesgo, salario_minimo, salario_maximo, estado } = req.body;
  db.query(
    'UPDATE puestos SET nombre = ?, nivel_riesgo = ?, salario_minimo = ?, salario_maximo = ?, estado = ? WHERE id = ?',
    [nombre, nivel_riesgo, salario_minimo, salario_maximo, estado, puestoId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al actualizar el puesto');
      }
      if (results.affectedRows === 0) {
        return res.status(404).send('Puesto no encontrado');
      }
      res.send('Puesto actualizado exitosamente');
    }
  );
};

// Eliminar un puesto por ID
exports.eliminarPuesto = (req, res) => {
  const puestoId = req.params.id;
  db.query('DELETE FROM puestos WHERE id = ?', [puestoId], (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).send('Error al eliminar el puesto');
    }
    if (results.affectedRows === 0) {
      return res.status(404).send('Puesto no encontrado');
    }
    res.send('Puesto eliminado exitosamente');
  });
};

// Controlador para mostrar el formulario de edición de trabajo
exports.mostrarFormularioEdicionTrabajo = (req, res) => {
  const puestoId = req.params.id;

  // Consulta para obtener los datos del puesto
  db.query(
    'SELECT * FROM puestos WHERE id = ?',
    [puestoId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener los datos del puesto');
      }

      if (results.length === 0) {
        return res.status(404).send('Puesto no encontrado');
      }

      const puesto = results[0];

      res.render('admin/editar-trabajo', {
        puesto: puesto
      });
    }
  );
};

// Controlador para actualizar un trabajo
exports.actualizarTrabajo = (req, res) => {
  const { id, nombre, nivel_riesgo, salario_minimo, salario_maximo, estado, departamento } = req.body;

  db.query(
    'UPDATE puestos SET nombre = ?, nivel_riesgo = ?, salario_minimo = ?, salario_maximo = ?, estado = ?, departamento = ? WHERE id = ?',
    [nombre, nivel_riesgo, salario_minimo, salario_maximo, estado, departamento, id],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al actualizar el puesto');
      }
      if (results.affectedRows === 0) {
        return res.status(404).send('Puesto no encontrado');
      }
      res.redirect('/auth/trabajos');
    }
  );
};

// Controlador para eliminar un trabajo
exports.eliminarTrabajo = (req, res) => {
  const { id } = req.body;

  // Obtener los datos del trabajo antes de eliminarlo
  db.query(
    'SELECT * FROM puestos WHERE id = ?',
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al obtener los datos del trabajo');
      }

      if (results.length === 0) {
        return res.status(404).send('Trabajo no encontrado');
      }

      const trabajo = results[0];

      // Imprimir los datos del trabajo en la consola
      console.log('Trabajo a eliminar:', trabajo);

      // Eliminar el trabajo
      db.query(
        'DELETE FROM puestos WHERE id = ?',
        [id],
        (error, results) => {
          if (error) {
            console.log(error);
            return res.status(500).send('Error al eliminar el trabajo');
          }

          res.redirect('/auth/trabajos');
        }
      );
    }
  );
};

exports.agregarTrabajo = (req, res) => {
  const { nombre, departamento, nivel_riesgo, salario_minimo, salario_maximo, estado } = req.body;

  db.query(
    'INSERT INTO puestos (nombre, departamento, nivel_riesgo, salario_minimo, salario_maximo, estado) VALUES (?, ?, ?, ?, ?, ?)',
    [nombre, departamento, nivel_riesgo, salario_minimo, salario_maximo, estado],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al agregar el trabajo');
      }
      res.redirect('/auth/trabajos');
    }
  );
};