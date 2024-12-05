const mysql = require("mysql");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

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


  // Consulta para obtener las aplicaciones del usuario
  db.query(
    'SELECT a.id, p.nombre, p.nivel_riesgo, p.salario_minimo, p.salario_maximo, a.estado, DATE_FORMAT(a.fecha_aplicacion, "%d-%b-%Y") AS fecha_aplicacion FROM aplicaciones a JOIN puestos p ON a.puesto_id = p.id WHERE a.user_id = ?;',
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
        res.status(500).send('Error al eliminar la aplicación');
      } else {
        res.redirect('/auth/usuario');
      }
    }
  );
};

