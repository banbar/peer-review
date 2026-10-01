// models/project.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Project = sequelize.define('Project', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        // duration_days sütunu kaldırıldı
        start_date: {
            type: DataTypes.DATE,
            allowNull: false
        },
        end_date: {
            type: DataTypes.DATE,
            allowNull: true
        },
        evaluation_deadline: { // Yeni Alan
            type: DataTypes.DATE,
            allowNull: true
        },
        is_active: { // Yeni Alan
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        evaluation_assigned_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'projects',
        timestamps: false
    });

    // İlişkileri Tanımlama
    Project.associate = (models) => {
        Project.hasMany(models.Website, {
            foreignKey: 'project_id',
            as: 'websites',
            onDelete: 'CASCADE',
            hooks: true
        });
        Project.hasMany(models.Evaluation, {
            foreignKey: 'project_id',
            as: 'evaluations',
            onDelete: 'CASCADE',
            hooks: true
        });
    };

    return Project;
};
