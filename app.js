const express = require('express');
const mysql = require('mysql');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');


dotenv.config({ path: './.env' });


const app = express();



const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
});

const publicDirectory = path.join(__dirname, './public');
app.use(express.static(publicDirectory));

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'hbs');

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('MySql Connected...');
});

app.use('/', require('./routes/pages'));
app.use('/auth', require('./routes/auth'));
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true,
  cokie: { maxAge: 60000 }
}));

app.listen(5000, () => {
  console.log('Server is running on port 5000');
});