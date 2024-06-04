const e = require('express');
const { Sequelize, DataTypes } = require('sequelize');

// Configurar Sequelize
const sequelize = new Sequelize('bxv90uo6q0zaovhloxbw', 'u7ejxe464fjxu68r', 'S88iB7HeRZhHUXk3CFcm', {
  host: 'bxv90uo6q0zaovhloxbw-mysql.services.clever-cloud.com',
  dialect: 'mysql',
  dialectModule: require('mysql2')
});

// Modelo User
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'client'),
    allowNull: false,
    defaultValue: 'admin',
  },
});

// Modelo Client
const Client = sequelize.define('Client', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('client'),
    allowNull: false,
    defaultValue: 'client',
  }, 
});

// Modelo Company
const Company = sequelize.define('Company', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: false,
    defaultValue: 0,
  },
});

// Modelo Rating
const Rating = sequelize.define('Rating', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  value: {
    type: DataTypes.FLOAT, // Cambiado de INTEGER a FLOAT
    allowNull: false,
    validate: {
      min: 0.5,
      max: 5, // Suponiendo un sistema de calificación de 1 a 5
    },
  },
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Client,
      key: 'id',
    },
  },
  companyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Company,
      key: 'id',
    },
  },
});

// Establecer relaciones
User.hasMany(Rating, { foreignKey: 'userId' });
Rating.belongsTo(User, { foreignKey: 'userId' });

Company.hasMany(Rating, { foreignKey: 'companyId' });
Rating.belongsTo(Company, { foreignKey: 'companyId' });

// Hook para después de crear un Rating
Rating.afterCreate(async (rating, options) => {
  await updateCompanyRating(rating.companyId);
});

// Hook para después de actualizar un Rating
Rating.afterUpdate(async (rating, options) => {
  const { companyId } = rating;
  await updateCompanyRating(companyId);
});

// Función para actualizar el rating de la compañía
async function updateCompanyRating(companyId) {
  const company = await Company.findByPk(companyId);
  const ratings = await Rating.findAll({ where: { companyId } });

  try {
    if (ratings.length > 0) {
      const totalRatings = ratings.reduce((sum, rating) => sum + rating.value, 0);
      const averageRating = totalRatings / ratings.length;
  
      company.rating = averageRating.toFixed(2);
      await company.save();
    } else {
      // Si no hay ratings, establecer el rating de la compañía en 0
      company.rating = '0.00';
      await company.save();
    }
  } catch (error) {
    console.log(error);
  }
}

// Sincronizar los modelos con la base de datos
sequelize.sync({ force: false })
  .then(() => {
    console.log('Tablas sincronizadas con la base de datos.');
  })
  .catch(error => {
    console.error('Error al sincronizar las tablas:', error);
  });

// Exportar los modelos y la instancia de Sequelize
module.exports = {
  sequelize,
  User,
  Client,
  Company,
  Rating,
};