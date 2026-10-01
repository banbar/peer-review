// routes/admin.js
const cron = require('node-cron');
const { DateTime } = require('luxon');
const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { Student, Evaluation, Website, Project, sequelize, Sequelize } = require('../models'); // Import models from index.js
const { Op } = Sequelize;
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const fetch = require('node-fetch');
// =====================
// Project Routes
// =====================
/**
 * PATCH /admin/projects/:id
 * Updates the is_active status of the project.
 */
router.patch('/projects/:id', authenticate, authorizeAdmin, async (req, res) => {
    const projectId = req.params.id;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'The is_active field must be a boolean.' });
    }

    try {
        const project = await Project.findByPk(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found.' });
        }

        project.is_active = is_active;
        await project.save();

        res.json({ message: `Project has been ${is_active ? 'activated' : 'deactivated'}.`, project });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'An error occurred while updating the project.' });
    }
});

/**
 * GET /admin/projects
 * Lists all projects.
 */
router.get('/projects', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const projects = await Project.findAll({
            include: [{ model: require('../models').Website, as: 'websites' }]
        });
        res.json({ projects });
    } catch (error) {
        console.error('Error listing projects:', error);
        res.status(500).json({ error: 'An error occurred while listing the projects.' });
    }
});

/**
 * POST /admin/projects
 * Creates a new project.
 */
router.post('/projects', authenticate, authorizeAdmin, async (req, res) => {
    const { name, start_date, end_date, evaluation_deadline } = req.body;

    if (!name || !start_date) {
        return res.status(400).json({ error: 'Project name and start date are required.' });
    }

    // Yeni Doğrulamalar Başlangıcı

    const startDateObj = new Date(start_date);

    if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid start date format.' });
    }

    if (end_date) {
        const endDateObj = new Date(end_date);
        if (isNaN(endDateObj.getTime())) {
            return res.status(400).json({ error: 'Invalid end date format.' });
        }
        if (endDateObj < startDateObj) {
            return res.status(400).json({ error: 'End date cannot be before start date.' });
        }
    }

    if (evaluation_deadline) {
        const evalDeadlineObj = new Date(evaluation_deadline);
        if (isNaN(evalDeadlineObj.getTime())) {
            return res.status(400).json({ error: 'Invalid evaluation deadline format.' });
        }
        if (end_date) {
            const endDateObj = new Date(end_date);
            if (evalDeadlineObj < endDateObj) {
                return res.status(400).json({ error: 'Evaluation deadline must be after or equal to the end date.' });
            }
        } else {
            if (evalDeadlineObj < startDateObj) {
                return res.status(400).json({ error: 'Evaluation deadline must be after or equal to the start date.' });
            }
        }
    }

    // Yeni Doğrulamalar Sonu

    try {
        const newProject = await Project.create({
            name,
            start_date,
            end_date,
            evaluation_deadline,
            is_active: true
        });
        res.status(201).json({ message: 'Project created successfully.', project: newProject });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'An error occurred while creating the project.' });
    }
});

/**
 * PUT /admin/projects/:id
 * Updates an existing project.
 */
router.put('/projects/:id', authenticate, authorizeAdmin, async (req, res) => {
    const projectId = req.params.id;
    const { name, start_date, end_date, evaluation_deadline } = req.body;

    if (!name || !start_date) {
        return res.status(400).json({ error: 'Project name and start date are required.' });
    }

    // Yeni Doğrulamalar Başlangıcı

    const startDateObj = new Date(start_date);

    if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid start date format.' });
    }

    if (end_date) {
        const endDateObj = new Date(end_date);
        if (isNaN(endDateObj.getTime())) {
            return res.status(400).json({ error: 'Invalid end date format.' });
        }
        if (endDateObj < startDateObj) {
            return res.status(400).json({ error: 'End date cannot be before start date.' });
        }
    }

    if (evaluation_deadline) {
        const evalDeadlineObj = new Date(evaluation_deadline);
        if (isNaN(evalDeadlineObj.getTime())) {
            return res.status(400).json({ error: 'Invalid evaluation deadline format.' });
        }
        if (end_date) {
            const endDateObj = new Date(end_date);
            if (evalDeadlineObj < endDateObj) {
                return res.status(400).json({ error: 'Evaluation deadline must be after or equal to the end date.' });
            }
        } else {
            if (evalDeadlineObj < startDateObj) {
                return res.status(400).json({ error: 'Evaluation deadline must be after or equal to the start date.' });
            }
        }
    }

    // Yeni Doğrulamalar Sonu

    try {
        const project = await Project.findByPk(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found.' });
        }

        project.name = name;
        project.start_date = start_date;
        project.end_date = end_date;
        project.evaluation_deadline = evaluation_deadline;

        await project.save();

        res.json({ message: 'Project updated successfully.', project });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'An error occurred while updating the project.' });
    }
});

/**
 * PUT /admin/websites/:id
 * Updates an existing website
 */
router.put('/websites/:id', authenticate, authorizeAdmin, async (req, res) => {
    const websiteId = req.params.id;
    const { url, project_id, student_id } = req.body;

    // Input Validation
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return res.status(400).json({ error: 'URL is required and must be a valid string.' });
    }
    if (!project_id || typeof project_id !== 'number') {
        return res.status(400).json({ error: 'project_id is required and must be a valid number.' });
    }
    if (!student_id || typeof student_id !== 'number') {
        return res.status(400).json({ error: 'student_id is required and must be a valid number.' });
    }

    try {
        // Find the website to update
        const website = await Website.findByPk(websiteId);
        if (!website) {
            return res.status(404).json({ error: 'Website not found.' });
        }

        // Check if the new project exists
        const project = await Project.findByPk(project_id);
        if (!project) {
            return res.status(404).json({ error: 'Specified project not found.' });
        }

        // Check if the new student exists and is a student role
        const student = await Student.findByPk(student_id);
        if (!student || student.role !== 'student') {
            return res.status(404).json({ error: 'Specified student not found or is not in a student role.' });
        }

        // Update the website details
        website.url = url.trim();
        website.project_id = project_id;
        website.student_id = student_id;

        await website.save();

        // Fetch the updated website with associations
        const updatedWebsite = await Website.findByPk(websiteId, {
            attributes: [
                'id',
                'url',
                'project_id',
                'student_id',
                [Sequelize.fn('COUNT', Sequelize.col('evaluations.id')), 'evaluation_count'],
                [Sequelize.fn('SUM', Sequelize.col('evaluations.score')), 'total_score'] // Total score
            ],
            include: [
                { 
                    model: Project, 
                    as: 'project', 
                    attributes: ['id', 'name'] 
                },
                { 
                    model: Student, 
                    as: 'student', 
                    attributes: ['id', 'student_number', 'first_name', 'last_name'] 
                },
                {
                    model: Evaluation,
                    as: 'evaluations',
                    attributes: [] // We do not want to include details
                }
            ],
            group: ['Website.id', 'project.id', 'student.id'],
        });

        res.json({ message: 'Website updated successfully.', website: updatedWebsite });
    } catch (error) {
        console.error('Error updating website:', error);
        res.status(500).json({ error: 'An error occurred while updating the website.', details: error.message });
    }
});
/**
 * DELETE /admin/projects/:id
 * Deletes a project.
 */
router.delete('/projects/:id', authenticate, authorizeAdmin, async (req, res) => {
    const projectId = req.params.id;

    try {
        const project = await Project.findByPk(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found.' });
        }

        await project.destroy();
        res.json({ message: 'Project deleted successfully.' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'An error occurred while deleting the project.' });
    }
});

// =====================
// Student Routes
// =====================

/**
 * List All Students
 */
router.get('/students', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const students = await Student.findAll({
            where: { role: 'student' }, // Only fetch users with student role
            attributes: ['id', 'student_number', 'first_name', 'last_name'],
            order: [['id', 'ASC']]
        });
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

/**
 * Search for a Student
 */
router.get('/students/search', authenticate, authorizeAdmin, async (req, res) => {
    const { first_name, last_name } = req.query;

    // At least one parameter is required
    if (!first_name && !last_name) {
        return res.status(400).json({ error: 'At least one search criterion (first_name or last_name) must be provided.' });
    }

    try {
        const whereClause = {
            role: 'student'
        };

        if (first_name && last_name) {
            whereClause[Op.and] = [
                { first_name: { [Op.iLike]: `%${first_name}%` } },
                { last_name: { [Op.iLike]: `%${last_name}%` } }
            ];
        } else if (first_name) {
            whereClause.first_name = { [Op.iLike]: `%${first_name}%` };
        } else if (last_name) {
            whereClause.last_name = { [Op.iLike]: `%${last_name}%` };
        }

        const students = await Student.findAll({
            where: whereClause,
            attributes: ['id', 'student_number', 'first_name', 'last_name'],
            order: [['id', 'ASC']]
        });

        res.json(students);
    } catch (error) {
        console.error('Error searching for student:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

/**
 * Update Student Information
 */
router.put('/students/:id', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, student_number } = req.body;

    // Simple validation
    if (!first_name || !last_name || !student_number) {
        return res.status(400).json({ error: 'First name, last name, and student number are required.' });
    }

    try {
        const student = await Student.findByPk(id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        // Check for uniqueness of student number
        if (student_number !== student.student_number) {
            const existingStudent = await Student.findOne({ where: { student_number } });
            if (existingStudent) {
                return res.status(400).json({ error: 'This student number is already in use.' });
            }
        }

        // Define updatable fields
        student.first_name = first_name;
        student.last_name = last_name;
        student.student_number = student_number;

        await student.save();

        res.json({ message: 'Student updated successfully.', student });
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

/**
 * Delete a Student
 */
router.delete('/students/:id', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const student = await Student.findByPk(id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        await student.destroy(); // This will automatically delete associated websites and evaluations
        res.json({ message: 'Student deleted successfully.' });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ error: 'An error occurred while deleting the student.' });
    }
});

// =====================
// Evaluation Routes
// =====================

/**
 * List All Evaluations
 * This route has been updated to allow filtering by project.
 * New query parameter: project_id
 */
router.get('/evaluations', authenticate, authorizeAdmin, async (req, res) => {
    const { project_id } = req.query; // Newly added: project-based filter
    try {
        let whereClause = {};
        if (project_id) {
            whereClause.project_id = project_id;
        }

        const evaluations = await Evaluation.findAll({
            where: whereClause, // Project-based filter
            attributes: ['id', 'evaluator_id', 'website_id', 'project_id', 'score', 'comment', 'created_at'],
            include: [
                { model: Student, as: 'evaluator', attributes: ['id', 'student_number', 'first_name', 'last_name'] },
                { model: Website, as: 'website', attributes: ['id', 'url'] }
            ],
            order: [['id', 'ASC']]
        });
        res.json(evaluations);
    } catch (error) {
        console.error('Error fetching evaluations:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

/**
 * Update an Evaluation
 */
router.put('/evaluations/:id', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    const { score, comment } = req.body;

    // Simple validation
    if (score === undefined || score < 1 || score > 5) {
        return res.status(400).json({ error: 'A valid score (1-5) is required.' });
    }

    try {
        const evaluation = await Evaluation.findByPk(id);
        if (!evaluation) {
            return res.status(404).json({ error: 'Evaluation not found.' });
        }

        evaluation.score = score;
        evaluation.comment = comment || evaluation.comment;

        await evaluation.save();
        res.json({ message: 'Evaluation updated successfully.', evaluation });
    } catch (error) {
        console.error('Error updating evaluation:', error);
        res.status(500).json({ error: 'An error occurred while updating the evaluation.', details: error.message });
    }
});

// =====================
// Website Routes
// =====================

/**
 * GET /admin/websites
 * Lists all websites or websites belonging to a specific project
 * Query Parameter: project_id (optional)
 */
router.get('/websites', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const { project_id } = req.query; // Get query parameter

        // Create WHERE clause
        let whereClause = {};
        if (project_id) {
            whereClause.project_id = project_id;
        }

        const websites = await Website.findAll({
            attributes: [
                'id',
                'url',
                'project_id',
                'student_id',
                [Sequelize.fn('COUNT', Sequelize.col('evaluations.id')), 'evaluation_count'],
                [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('evaluations.score')), 0), 'total_score'] // Total score, 0 if null
            ],
            include: [
                { 
                    model: Project, 
                    as: 'project', 
                    attributes: ['id', 'name'] 
                },
                { 
                    model: Student, 
                    as: 'student', 
                    attributes: ['id', 'student_number', 'first_name', 'last_name'] 
                },
                {
                    model: Evaluation,
                    as: 'evaluations',
                    attributes: [], // We do not want to include details
                    required: false, // Performs a LEFT JOIN, websites without evaluations are also listed
                }
            ],
            where: whereClause, // Apply filter
            group: ['Website.id', 'project.id', 'student.id'],
            order: [['id', 'ASC']],
            subQuery: false // May need to disable subQuery when using grouping
        });

        res.json(websites);
    } catch (error) {
        console.error('Error fetching websites:', error);
        res.status(500).json({ error: 'An error occurred while fetching the websites.', details: error.message });
    }
});

/**
 * PUT /admin/websites/:id
 * Updates an existing website
 */
router.put('/websites/:id', authenticate, authorizeAdmin, async (req, res) => {
    const websiteId = req.params.id;
    const { url, project_id, student_id } = req.body;

    // Input Validation
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return res.status(400).json({ error: 'URL is required and must be a valid string.' });
    }
    if (!project_id || typeof project_id !== 'number') {
        return res.status(400).json({ error: 'project_id is required and must be a valid number.' });
    }
    if (!student_id || typeof student_id !== 'number') {
        return res.status(400).json({ error: 'student_id is required and must be a valid number.' });
    }

    try {
        // Find the website to update
        const website = await Website.findByPk(websiteId);
        if (!website) {
            return res.status(404).json({ error: 'Website not found.' });
        }

        // Check if the new project exists
        const project = await Project.findByPk(project_id);
        if (!project) {
            return res.status(404).json({ error: 'Specified project not found.' });
        }

        // Check if the new student exists and is a student role
        const student = await Student.findByPk(student_id);
        if (!student || student.role !== 'student') {
            return res.status(404).json({ error: 'Specified student not found or is not in a student role.' });
        }

        // Update the website details
        website.url = url.trim();
        website.project_id = project_id;
        website.student_id = student_id;

        await website.save();

        // Fetch the updated website with associations
        const updatedWebsite = await Website.findByPk(websiteId, {
            attributes: [
                'id',
                'url',
                'project_id',
                'student_id',
                [Sequelize.fn('COUNT', Sequelize.col('evaluations.id')), 'evaluation_count'],
                [Sequelize.fn('COALESCE', Sequelize.col('evaluations.score'), 0), 'total_score'] // Total score, 0 if null
            ],
            include: [
                { 
                    model: Project, 
                    as: 'project', 
                    attributes: ['id', 'name'] 
                },
                { 
                    model: Student, 
                    as: 'student', 
                    attributes: ['id', 'student_number', 'first_name', 'last_name'] 
                },
                {
                    model: Evaluation,
                    as: 'evaluations',
                    attributes: [] // We do not want to include details
                }
            ],
            group: ['Website.id', 'project.id', 'student.id'],
        });

        res.json({ message: 'Website updated successfully.', website: updatedWebsite });
    } catch (error) {
        console.error('Error updating website:', error);
        res.status(500).json({ error: 'An error occurred while updating the website.', details: error.message });
    }
});
/**
 * DELETE /admin/websites/:id
 * Deletes a website
 */
router.delete('/websites/:id', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const website = await Website.findByPk(id);
        if (!website) {
            return res.status(404).json({ error: 'Website not found.' });
        }

        await website.destroy(); // This will automatically delete associated evaluations
        res.json({ message: 'Website deleted successfully.' });
    } catch (error) {
        console.error('Error deleting website:', error);
        res.status(500).json({ error: 'An error occurred while deleting the website.', details: error.message });
    }
});

// =====================
// Evaluation Routes
// =====================

/**
 * Populate the Evaluation Table
 * (To ensure fair distribution using the Fisher-Yates shuffle algorithm)
 */
function shuffleArray(array) {
    const arr = array.slice(); // Create a copy
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function populateEvaluations(project_id, tExternal = null) {
  const t = tExternal || await Evaluation.sequelize.transaction();
  try {
    console.log(`Starting to populate the evaluation table for project ID: ${project_id}...`);

    // Clean existing evaluation data (specific to the project)
    await Evaluation.destroy({ where: { project_id }, transaction: t });
    console.log('Existing evaluations data cleaned.');

    // Get websites associated with the selected project
    const websites = await Website.findAll({ where: { project_id }, transaction: t });
    console.log(`Total ${websites.length} websites fetched.`);
    if (websites.length === 0) throw new Error('No websites found for the selected project.');

    // Unique student_ids
    const studentIds = [...new Set(websites.map(w => w.student_id))];
    console.log(`Total ${studentIds.length} unique student IDs fetched.`);
    if (studentIds.length < 4) throw new Error('At least 4 evaluators are required to assign 3 different evaluators per website.');

    // Help

    const shuffledWebsites = shuffleArray(websites);
    const shuffledEvaluators = shuffleArray(studentIds);

    const evaluations = [];
    const evaluatorEvalCounts = Object.fromEntries(studentIds.map(id => [id, 0]));

    for (const website of shuffledWebsites) {
      let possibleEvaluators = shuffledEvaluators
        .filter(id => id !== website.student_id && evaluatorEvalCounts[id] < 3)
        .sort((a, b) => evaluatorEvalCounts[a] - evaluatorEvalCounts[b]);

      if (possibleEvaluators.length < 3) {
        throw new Error(`Not enough evaluators available for website ID ${website.id}. Available: ${possibleEvaluators.length}`);
      }

      const selected = possibleEvaluators.slice(0, 3);
      selected.forEach(student_id => {
        evaluations.push({
          evaluator_id: student_id,
          website_id: website.id,
          project_id,
          score: null,
          comment: null,
        });
        evaluatorEvalCounts[student_id] += 1;
      });
    }

    // Insert (unique index zaten koruyor; istersen ignoreDuplicates: true ekleyebilirsin)
    await Evaluation.bulkCreate(evaluations, { transaction: t /*, ignoreDuplicates: true */ });
    console.log('Evaluations table populated successfully.');

    if (!tExternal) await t.commit();
  } catch (err) {
    if (!tExternal) await t.rollback();
    throw err;
  }
}

async function safePopulate(project_id) {
  const t = await sequelize.transaction();
  try {
    // 1) Advisory lock: aynı anda tek populate
    const row = await sequelize.query(
      "SELECT pg_try_advisory_xact_lock(hashtext(:k)) AS locked;",
      { replacements: { k: `populate:${project_id}` },
        type: Sequelize.QueryTypes.SELECT, transaction: t }
    );
    if (!row[0].locked) { await t.rollback(); return; }

    // 2) Proje ve durum kontrolleri
    const project = await Project.findByPk(project_id, { transaction: t });
    if (!project) { await t.rollback(); return; }

    // Zaten atandıysa bitir
    if (project.evaluation_assigned_at) { await t.rollback(); return; }

    // Altında evaluation var mı? (güvenlik için)
    const anyEval = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1
        FROM websites w
        JOIN evaluations e ON e.website_id = w.id
        WHERE w.project_id = :pid
      ) AS has_any
    `, { replacements: { pid: project_id },
         type: Sequelize.QueryTypes.SELECT, transaction: t });
    if (anyEval[0].has_any) { await t.rollback(); return; }

    // 3) Adaylar
    const websites = await Website.findAll({ where: { project_id }, transaction: t });
    if (websites.length === 0) { await t.rollback(); return; }

    const studentIds = [...new Set(websites.map(w => w.student_id))];
    if (studentIds.length < 4) { await t.rollback(); return; }

    const shuffledWebsites   = shuffleArray(websites);
    const shuffledEvaluators = shuffleArray(studentIds);

    const buffer = [];
    const loadPerEval = Object.fromEntries(studentIds.map(id => [id, 0]));

    for (const w of shuffledWebsites) {
      const cand = shuffledEvaluators
        .filter(id => id !== w.student_id && loadPerEval[id] < 3)
        .sort((a,b) => loadPerEval[a] - loadPerEval[b]);
      if (cand.length < 3) {
        await t.rollback();
        throw new Error(`Not enough evaluators for website ${w.id}`);
      }
      const chosen = cand.slice(0, 3);
      chosen.forEach(eid => {
        buffer.push({ evaluator_id: eid, website_id: w.id, project_id, score: null, comment: null });
        loadPerEval[eid] += 1;
      });
    }

    // 4) Toplu INSERT (silme yok). On conflict, do nothing:
    await Evaluation.bulkCreate(buffer, {
      transaction: t,
      ignoreDuplicates: true // Sequelize 6: (INSERT ... ON CONFLICT DO NOTHING)
    });

    // 5) Damga: artık tablo “assign edilmiş” sayılır
    await Project.update(
      { evaluation_assigned_at: new Date() },
      { where: { id: project_id }, transaction: t }
    );

    await t.commit();
  } catch (e) {
    await t.rollback();
    throw e;
  }
}



// =====================
// Website Routes (Duplicate Section Removed)
// =====================

/**
 * DELETE /admin/websites/:id
 * Deletes a website
 */
router.delete('/websites/:id', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const website = await Website.findByPk(id);
        if (!website) {
            return res.status(404).json({ error: 'Website not found.' });
        }

        await website.destroy(); // This will automatically delete associated evaluations
        res.json({ message: 'Website deleted successfully.' });
    } catch (error) {
        console.error('Error deleting website:', error);
        res.status(500).json({ error: 'An error occurred while deleting the website.', details: error.message });
    }
});

// =====================
// RAPOR: Öğrenci - Proje Pivot (Excel)
// =====================
router.get('/reports/student-project-pivot', authenticate, authorizeAdmin, async (req, res) => {
  try {
    // SQL sorgusu
    const result = await sequelize.query(`
      SELECT
        s.student_number,
        s.first_name,
        s.last_name,
        p.name AS project_name,
        COALESCE(SUM(e.score), 0) AS total_score
      FROM students s
      JOIN websites w ON w.student_id = s.id
      JOIN projects p ON p.id = w.project_id
      LEFT JOIN evaluations e ON e.website_id = w.id
      GROUP BY s.student_number, s.first_name, s.last_name, p.name
      ORDER BY s.student_number;
    `, { type: Sequelize.QueryTypes.SELECT });

    // Proje isimlerini al
    const projectNames = [...new Set(result.map(r => r.project_name))];

    // Öğrenci bazlı gruplama
    const grouped = {};
    result.forEach(r => {
      const key = r.student_number;
      if (!grouped[key]) {
        grouped[key] = {
          StudentNumber: r.student_number,
          FirstName: r.first_name,
          LastName: r.last_name,
        };
      }
      grouped[key][r.project_name] = r.total_score;
    });

    const exportRows = Object.values(grouped);

    // ExcelJS workbook oluştur
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pivot');

    // Başlıklar
    worksheet.columns = [
      { header: 'StudentNumber', key: 'StudentNumber', width: 15 },
      { header: 'FirstName', key: 'FirstName', width: 20 },
      { header: 'LastName', key: 'LastName', width: 20 },
      ...projectNames.map(name => ({ header: name, key: name, width: 25 }))
    ];

    // Satırları ekle
    exportRows.forEach(row => worksheet.addRow(row));

    // Başlık stil
    worksheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    });

    // HTTP response header
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=student-project-pivot.xlsx'
    );

    // Excel dosyasını response’a yaz
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});



// =====================
// Evaluation Routes (Duplicate Section Removed)
// =====================

/**
 * Populate the Evaluation Table
 * (To ensure fair distribution using the Fisher-Yates shuffle algorithm)
 */
function shuffleArray(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
async function populateEvaluations(project_id) {
    const transaction = await Evaluation.sequelize.transaction();
    try {
        const project = await Project.findByPk(project_id, { transaction: t });
const existingCount = await Evaluation.count({
  include: [{ model: Website, as: 'website', where: { project_id } }],
  transaction: t
});
if (project?.evaluation_assigned_at || existingCount > 0) {
  console.log(`⛔ populate skipped for project ${project_id} (already assigned or has evaluations)`);
  if (!tExternal) await t.rollback();
  return;
}

        console.log(`Starting to populate the evaluation table for project ID: ${project_id}...`);
    
        // Get websites associated with the selected project
        const websites = await Website.findAll({ where: { project_id }, transaction });
        console.log(`Total ${websites.length} websites fetched.`);

        if (websites.length === 0) {
            throw new Error('No websites found for the selected project.');
        }

        // Unique student_ids (each student_id represents a user)
        const studentIds = [...new Set(websites.map(w => w.student_id))];
        console.log(`Total ${studentIds.length} unique student IDs fetched.`);

        if (studentIds.length < 4) { // At least 4 evaluators are required
            throw new Error('At least 4 evaluators are required to assign 3 different evaluators per website.');
        }

        // Shuffle websites to ensure fair distribution
        const shuffledWebsites = shuffleArray(websites);

        // Shuffle evaluators to ensure fair distribution
        const shuffledEvaluators = shuffleArray(studentIds);

        // Create evaluation records
        const evaluations = [];

        // Track the number of evaluations per evaluator
        const evaluatorEvalCounts = {};
        studentIds.forEach(student_id => {
            evaluatorEvalCounts[student_id] = 0;
        });

        // Select 3 evaluators for each website
        for (const website of shuffledWebsites) {
            console.log(`Selecting evaluators for website ID ${website.id}...`);

            // Determine evaluator candidates (excluding the website owner and those with less than 3 evaluations)
            let possibleEvaluators = shuffledEvaluators.filter(student_id => 
                student_id !== website.student_id && evaluatorEvalCounts[student_id] < 3
            );

            // If possible, sort to balance the number of evaluations per evaluator
            possibleEvaluators = possibleEvaluators.sort((a, b) => evaluatorEvalCounts[a] - evaluatorEvalCounts[b]);

            if (possibleEvaluators.length < 3) {
                throw new Error(`Not enough evaluators available for website ID ${website.id}. Available candidates: ${possibleEvaluators.length}`);
            }

            // Select the first 3 evaluators
            const selectedEvaluators = possibleEvaluators.slice(0, 3);

            console.log(`Selected Evaluators: ${selectedEvaluators.join(', ')}`);

            selectedEvaluators.forEach(student_id => {
                evaluations.push({
                    evaluator_id: student_id,
                    website_id: website.id,
                    project_id: project_id, // Add Project ID
                    score: null,
                    comment: null,
                });
                evaluatorEvalCounts[student_id] += 1;
            });
        }

        // Bulk insert evaluation records into the Evaluation table
        console.log('Inserting records into the evaluations table...');
        await Evaluation.bulkCreate(evaluations, { transaction });
        console.log('Evaluations table populated successfully.');

        // Commit the transaction
        await transaction.commit();
        console.log('Transaction committed successfully.');
    } catch (err) {
        console.error('Error occurred, rolling back:', err.message);
        await transaction.rollback();
        throw err; // Propagate the error to be handled in the frontend
    }
}
// routes/admin.js (veya cron'u tanımladığın yer)
// cron: her gece 02:00
const runAutoPopulate = async () => {
  if (process.env.EVAL_AUTO_ASSIGN !== 'true') return;

  const now = DateTime.now().setZone('Europe/Istanbul').startOf('day').toJSDate();

  // end_date <= today && evaluation_deadline >= today
  // ve daha önce atanmamış (evaluation_assigned_at IS NULL)
  // ve altında hiç evaluation yok (geri dönülmezlik için)
  const projects = await sequelize.query(`
    SELECT p.*
    FROM projects p
    WHERE p.end_date <= :now
      AND p.evaluation_deadline >= :now
      AND p.evaluation_assigned_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM websites w
        JOIN evaluations e ON e.website_id = w.id
        WHERE w.project_id = p.id
      )
  `, { replacements: { now }, type: Sequelize.QueryTypes.SELECT });

  for (const p of projects) {
    try {
      await safePopulate(p.id);     // Aşağıda
      console.log(`✅ Populated: ${p.name}`);
    } catch (e) {
      console.warn(`⚠️ Populate failed for ${p.name}:`, e.message);
    }
  }
};


// Cron'u ENV'e bağla (tamamen kapatmak istersen env ile kapatırsın)
if (process.env.EVAL_AUTO_ASSIGN === 'true') {
  cron.schedule('0 2 * * *', runAutoPopulate, { timezone: 'Europe/Istanbul' });
} else {
  console.log('⚑ Cron not scheduled (EVAL_AUTO_ASSIGN!=true)');
}




// =====================
// Website Routes (Duplicate Section Removed)
// =====================


// Export the router
module.exports = router;
