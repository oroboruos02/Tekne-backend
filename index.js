const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { sequelize, User, Client, Company, Rating } = require('./database');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  console.log(`Solicitud recibida: ${req.method} ${req.url}`);
  next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

// Sincronizar la base de datos
sequelize.sync()
  .then(() => {
    console.log('Base de datos sincronizada');
  })
  .catch(err => {
    console.error('Error al sincronizar la base de datos:', err);
  });

// Función para agregar una calificación
async function addRating(userId, companyId, value) {
  try {
    // Crea una nueva calificación
    const newRating = await Rating.create({
      userId: userId,
      companyId: companyId,
      value: value,
    });

    console.log(`El usuario ${userId} ha calificado con ${value} a la compañía ${companyId}`);
  } catch (error) {
    console.error('Error al agregar la calificación:', error);
  }
}

app.get("/", (req, res) => {
  res.send("Hola")
})

// Registro de clientes
app.post('/register-client', async (req, res) => {
  const { name, email, password } = req.body;

  console.log('Datos recibidos en /register-client:', { name, email, password });

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const client = await Client.create({ name, email, password: hashedPassword });
    res.status(201).json({ message: 'Cliente registrado con éxito' });
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(400).json({ error: 'No se pudo registrar el cliente' });
  }
});

// Registro de administradores
app.post('/register-admin', async (req, res) => {
  const { name, email, password } = req.body;

  console.log('Datos recibidos en /register-admin:', { name, email, password });

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    res.status(201).json({ message: 'Administrador registrado con éxito' });
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(400).json({ error: 'No se pudo registrar el administrador' });
  }
});

// Inicio de sesión de administradores
app.post('/login-admin', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(400).json({ error: 'Correo electrónico o contraseña incorrectos' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Correo electrónico o contraseña incorrectos' });
    }

    res.json({ userId: user.id }); // Devuelve el ID del usuario
  } catch (error) {
    res.status(400).json({ error: 'No se pudo iniciar sesión' });
  }
});

// Inicio de sesión de clientes
app.post('/login-client', async (req, res) => {
  const { email, password } = req.body;
  console.log('Datos recibidos:', { email, password });

  try {
    const client = await Client.findOne({ where: { email } });
    console.log('Cliente encontrado:', client);

    if (!client) {
      console.log('Correo electrónico no encontrado');
      return res.status(400).json({ error: 'Correo electrónico o contraseña incorrectos' });
    }

    const isPasswordValid = await bcrypt.compare(password, client.password);
    console.log('Contraseña válida:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('Contraseña incorrecta');
      return res.status(400).json({ error: 'Correo electrónico o contraseña incorrectos' });
    }

    res.json({ userId: client.id }); // Asegúrate de devolver client.id en lugar de user.id
  } catch (error) {
    console.error('Error durante el inicio de sesión:', error);
    res.status(400).json({ error: 'No se pudo iniciar sesión' });
  }
});

// Obtener empresas
app.get('/companies', async (req, res) => {
  try {
    const companies = await Company.findAll();
    res.json(companies);
  } catch (error) {
    console.error('Error al obtener las empresas:', error);
    res.status(500).json({ message: 'Error al obtener las empresas', error });
  }
});

// Obtener empresas con calificaciones promedio
app.get('/companies-ratings', async (req, res) => {
  try {
    const companies = await Company.findAll({
      include: {
        model: Rating,
        attributes: [],
      },
      attributes: {
        include: [[sequelize.fn('AVG', sequelize.col('Ratings.value')), 'averageRating']],
      },
      group: ['Company.id'],
    });

    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo obtener la lista de empresas' });
  }
});

// Enviar calificación al servidor
app.post('/rate-company', async (req, res) => {
  const { clientId, companyId, value } = req.body;

  try {
    const result = await Rating.findOne({ where: { clientId, companyId} })
    if(result !== null){
      await result.update({value})

    }else{
    const newRating = await Rating.create({value, clientId, companyId})
    res.status(200).json(newRating)
    }
  } catch (error) {
    console.log(error);
  }

  console.log('Datos recibidos', {clientId, companyId, value})
});

// Agregar empresas
app.post('/companies', async (req, res) => {
  try {
    const { name, rating, user_id } = req.body;

    console.log('Datos recibidos en /companies:', { name, rating, user_id });

    const newCompany = await Company.create({ name, rating, user_id });

    res.status(201).json(newCompany);
  } catch (error) {
    console.error('Error al agregar la empresa:', error);
    res.status(400).json({ message: 'Error al agregar la empresa', error });
  }
});

// Enviar correo usando nodemailer
app.post('/enviar-correo', async (req, res) => {
  const { nombre, correo, mensaje } = req.body;

  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  let mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'arc.eseisnos@gmail.com',
    subject: `Nuevo mensaje de ${nombre}`,
    text: `Nombre: ${nombre}\nCorreo: ${correo}\n\nMensaje:\n${mensaje}`,
    html: `<p>Nombre: ${nombre}</p><p>Correo: ${correo}</p><p>Mensaje:</p><p>${mensaje}</p>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      res.status(500).send('Error al enviar el mensaje');
    } else {
      console.log('Correo enviado: ' + info.response);
      res.status(200).send('Mensaje enviado correctamente');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Servidor backend iniciado en http://localhost:${PORT}`);
});