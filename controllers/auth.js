const mysql = require('mysql');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
          vnTotal += parseInt(vCalculo.toString().charAt(0)) + parseInt(vCalculo.toString().charAt(1));
      }
    return vnTotal % 10 === 0;
  }
}

exports.registro = (req, res) => { 
  console.log(req.body);

  const { nombre, email, cedula, password, passwordConfirm } = req.body;

  

  db.query('SELECT email,cedula FROM users WHERE email = ? OR cedula = ?', [email, cedula], async (error, results) => {
    if (error) {
      console.log(error);
    }

    if (results.length > 0) {
      const emailExists = results.some(row => row.email === email);
      const cedulaExists = results.some(row => row.cedula === cedula);

      if (emailExists) {
          return res.render('registro', {
            failed: 'El email ya está en uso'
          });
      }

      if (cedulaExists) {
          return res.render('registro', {
            failed: 'La cédula ya está en uso'
          });
      }
  }

    if (!validaCedula(cedula)) {
    return res.render('registro', {
      failed: 'La cédula no es válida'
    });
}

    let hashedPassword = await bcrypt.hash(password, 8);
    console.log(hashedPassword);

    db.query('INSERT INTO users SET ?', { username: nombre, email: email, cedula:cedula , password: hashedPassword }, (error, results) => {
      if (error) {
        console.log(error);
      } else {
        console.log(results);
        return res.render('registro', {
          success: 'Usuario registrado'
        });
      }
    });
  });
};

exports.login = async (req, res) => {
  console.log(req.body);

  const { email, password } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [email], async (error, results) => {
    if (error) {
      console.log(error);
    } else if (results.length > 0 && (await bcrypt.compare(password, results[0].password))) {
      console.log(results);
      console.log('Login exitoso');

      const userRole = results[0].rol;
      
      if (userRole === 'usuario') {
        res.render('usuario/usuario', {
          username: results[0].username});
      } else if (userRole === 'admin') {
        res.render('admin/admin');
      } else {
        console.log('Rol desconocido');
        res.status(403).send('Acceso denegado');
      }
    } else {
      console.log('Email o contraseña incorrectos');
      return res.render('login', {
        failed: 'Email o contraseña incorrectos'
      });
    }
  });
};