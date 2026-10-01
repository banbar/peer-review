// models/evaluation.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Evaluation = sequelize.define('Evaluation', {
        evaluator_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'students',
                key: 'id'
            }
        },
        website_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'websites',
                key: 'id'
            }
        },
        project_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'projects',
                key: 'id'
            }
        },
        score: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
          tableName: 'evaluations',
          timestamps: true,             // <-- AÇILDI
          createdAt: 'created_at',      // <-- pg kolon adları
          updatedAt: 'updated_at'
    });

    Evaluation.associate = (models) => {
        Evaluation.belongsTo(models.Student, {
            foreignKey: 'evaluator_id',
            as: 'evaluator'
        });
        Evaluation.belongsTo(models.Website, {
            foreignKey: 'website_id',
            as: 'website'
        });
        Evaluation.belongsTo(models.Project, {
            foreignKey: 'project_id',
            as: 'project'
        });
    };

    return Evaluation;
};
