// models/index.js
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

// Veritabanı bağlantı bilgilerinizi doğrudan tanımla
/*
const DB_NAME = 'gmt458_wp';       // Örneğin: 'my_database'
const DB_USER = 'postgres';        // Örneğin: 'root'
const DB_PASSWORD = 'postgre';             // Örneğin: 'password123'
const DB_HOST = 'localhost';             // Örneğin: 'localhost'
const DB_DIALECT = 'postgres';           // Kullanılan veritabanı türü: 'postgres', 'mysql', 'sqlite', 'mariadb', 'mssql'
*/

const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST = process.env.DB_HOST;
const DB_DIALECT = process.env.DB_DIALECT;

// Veritabanı bağlantınızı yapılandırın
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    dialect: DB_DIALECT,
    logging: false, // SQL sorgularını konsola yazdırmak için true yapabilirsiniz
});

// Modelleri dinamik olarak yükleme
const models = {};
const modelsPath = path.join(__dirname);

// Tüm model dosyalarını oku ve içe aktar
fs.readdirSync(modelsPath)
    .filter(file => {
        return (file.indexOf('.') !== 0) && (file !== 'index.js') && (file.slice(-3) === '.js');
    })
    .forEach(file => {
        const model = require(path.join(modelsPath, file))(sequelize, DataTypes);
        models[model.name] = model;
    });

// İlişkileri kurma
Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

// Export edilen objeye sequelize ve modelleri ekleme
models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
