// models/website.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Website = sequelize.define('Website', {
        url: {
            type: DataTypes.STRING,
            allowNull: false
        },
        project_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'projects',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        student_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'students',
                key: 'id'
            },
            onDelete: 'CASCADE'
        }
    }, {
        tableName: 'websites',
        timestamps: false
    });

    // İlişkileri Tanımlama
    Website.associate = (models) => {
        Website.belongsTo(models.Project, {
            foreignKey: 'project_id',
            as: 'project'
        });
        Website.belongsTo(models.Student, {
            foreignKey: 'student_id',
            as: 'student'
        });
        Website.hasMany(models.Evaluation, {
            foreignKey: 'website_id',
            as: 'evaluations',
            onDelete: 'CASCADE',
            hooks: true
        });
    };

    return Website;
};
