// models/student.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Student = sequelize.define('Student', {
    student_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    first_name:     { type: DataTypes.STRING, allowNull: false },
    last_name:      { type: DataTypes.STRING, allowNull: false },
    role:           { type: DataTypes.STRING, allowNull: false, defaultValue: 'student' },
    password:       { type: DataTypes.STRING, allowNull: false },

    // Yeni alanlar
    email:                { type: DataTypes.STRING, allowNull: false, unique: true },
    is_verified:          { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    verification_code:    { type: DataTypes.STRING },      // 6 haneli kod
    verification_expires: { type: DataTypes.DATE } ,
    password_reset_token:  { type: DataTypes.STRING, allowNull: true },
    password_reset_expires:{ type: DataTypes.DATE,   allowNull: true },
    must_change_password: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

        // son kullanım
  }, {
    tableName: 'students',
    timestamps: false
  });

  Student.associate = (models) => {
    Student.hasMany(models.Website,   { foreignKey: 'student_id',  as: 'websites',    onDelete: 'CASCADE', hooks: true });
    Student.hasMany(models.Evaluation,{ foreignKey: 'evaluator_id',as: 'evaluations', onDelete: 'CASCADE', hooks: true });
  };

  return Student;
};
