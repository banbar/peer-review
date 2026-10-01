const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { sequelize, Student, Project, Website, Evaluation } = require('../models'); // Import sequelize
require('dotenv').config(); // Use .env file

// JWT Secret Key
const JWT_SECRET = process.env.JWT_SECRET;

// ==================
// Database Connection Check
// ==================
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Veritabanı bağlantısı başarılı.');
    } catch (error) {
        console.error('Veritabanı bağlantısı başarısız:', error);
        // Uygulamanın başlatılmasını durdurmak için process.exit kullanabilirsiniz.
        process.exit(1);
    }
})();

// Middleware for authenticating JWT tokens
const authenticateToken = (req, res, next) => {
  const token = req.cookies?.token;  // cookie’den al
  if (!token) return res.status(401).json({ error: 'No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token.' });
    req.user = user;
    next();
  });
};

// ==================
// Student Management
// ==================

// Student Registration
router.post('/register', async (req, res) => {
  const { student_number, first_name, last_name, email, password } = req.body;
  if (!student_number || !first_name || !last_name || !email || !password) {
    return res.status(400).json({ error: 'All required fields must be filled.' });
  }

  const emailNorm = String(email).trim().toLowerCase();
  const hacettepeRegex = /^[a-z0-9._%+-]+@hacettepe\.edu\.tr$/;
  if (!hacettepeRegex.test(emailNorm)) {
    return res.status(400).json({ error: 'Only @hacettepe.edu.tr emails are accepted.' });
  }

  try {
    const existing = await Student.findOne({
      where: { [Op.or]: [{ student_number }, { email: emailNorm }] }
    });
    if (existing) {
      const conflict =
        existing.student_number === student_number
          ? 'This student number is already registered.'
          : 'This email is already registered.';
      return res.status(409).json({ error: conflict });
    }

    const hashed = await bcrypt.hash(password, 10);

    // 6 haneli doğrulama kodu + 15 dk son kullanım
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    const newStudent = await Student.create({
      student_number,
      first_name,
      last_name,
      email: emailNorm,
      password: hashed,
      role: 'student',
      is_verified: false,
      verification_code: code,
      verification_expires: expires
    });

    // Mail gönder (server.js içine gömdüğümüz fonksiyon)
    try {
      await req.app.locals.sendVerificationEmail({ to: emailNorm, code });
    } catch (mailErr) {
      console.error('Send mail error:', mailErr);
      // Mail başarısız olsa bile kayıt oldu — kullanıcıya tekrar kod isteyebileceğini söyleyebilirsin.
    }

    return res.status(201).json({
      message: 'Registration successful! Please verify your email.',
      showVerifyWarning: true
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'This student number or email is already registered.' });
    }
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.errors?.[0]?.message || 'Validation error.' });
    }
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'An error occurred during registration.' });
  }
});


// Student Login
// Student Login
router.post('/login', async (req, res) => {
  const { student_number, password } = req.body;
  if (!student_number || !password) {
    return res.status(400).json({ error: 'Student number and password are required.' });
  }

  try {
    const student = await Student.findOne({ where: { student_number } });
    if (!student) return res.status(400).json({ error: 'Invalid student number or password.' });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid student number or password.' });

    // <<< BURASI YENİ
    if (!student.is_verified) {
      const emailHint = student.email.replace(/(.{2}).+(@.+)/, '$1***$2');
      return res.status(401).json({
        error: 'E-posta doğrulanmamış. Lütfen e-posta doğrulamasını tamamlayın.',
        needsVerification: true,
        emailHint
      });
    }
    // >>> BURASI YENİ

    const token = jwt.sign({ id: student.id, role: student.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful!', token });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'An error occurred during login.' });
  }
});

// GET /api/me
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const student = await Student.findByPk(req.user.id, {
            attributes: ['first_name', 'last_name']
        });

        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        res.json({ first_name: student.first_name, last_name: student.last_name });
    } catch (error) {
        console.error('Error fetching student info:', error);
        res.status(500).json({ error: 'An error occurred while fetching student information.' });
    }
});

// ==================
// Project Management
// ==================

// Get Active Projects
router.get('/active-projects', authenticateToken, async (req, res) => {
    try {
        const projects = await Project.findAll({
            where: {
                is_active: true
            },
            attributes: ['id', 'name', 'start_date', 'end_date', 'evaluation_deadline']
        });
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'An error occurred while fetching projects.' });
    }
});

// GET /api/project/:project_id
// Retrieve details of a specific project (start_date, end_date, evaluation_deadline)
router.get('/project/:project_id', authenticateToken, async (req, res) => {
    try {
        const { project_id } = req.params;

        const project = await Project.findOne({
            where: { id: project_id, is_active: true },
            attributes: ['id', 'name', 'start_date', 'end_date', 'evaluation_deadline']
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found or inactive.' });
        }

        res.json(project);
    } catch (error) {
        console.error('Project endpoint error:', error);
        res.status(500).json({ error: 'An error occurred while fetching the project.', details: error.message });
    }
});

// ==================
// Website Management
// ==================

// GET /api/submit-website?project_id=xxx
router.get('/submit-website', authenticateToken, async (req, res) => {
    const { project_id } = req.query;
    const studentId = req.user.id;

    if (!project_id) {
        return res.status(400).json({ error: 'project_id query parameter is required.' });
    }

    try {
        const website = await Website.findOne({
            where: {
                student_id: studentId,
                project_id: project_id
            }
        });

        if (!website) {
            return res.status(404).json({ error: 'No website found for this project.' });
        }

        res.json({ url: website.url });
    } catch (error) {
        console.error('Error fetching website:', error);
        res.status(500).json({ error: 'An error occurred while fetching the website.' });
    }
});

// POST /api/submit-website
// Submit or create a website for a project
router.post('/submit-website', authenticateToken, async (req, res) => {
    const { project_id, url } = req.body;
    const studentId = req.user.id;

    if (!project_id || !url) {
        return res.status(400).json({ error: 'project_id and url are required.' });
    }

    try {
        // Check if the project exists and is active
        const project = await Project.findOne({
            where: {
                id: project_id,
                is_active: true // Only active projects
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Active project not found.' });
        }

        const now = new Date();

        // Check if current date is within the submission period
        if (now < project.start_date || now > project.end_date) {
            return res.status(400).json({ error: 'Submission period for this project is not active.' });
        }

        // Check if the student already has a website for this project
        let website = await Website.findOne({
            where: {
                student_id: studentId,
                project_id: project_id
            }
        });

        if (website) {
            // Update existing website
            website.url = url;
            await website.save();
            return res.json({
                message: 'Web sitesi başarıyla güncellendi.',
                website
            });
        } else {
            // Create a new website
            website = await Website.create({
                url,
                student_id: studentId,
                project_id: project_id
            });
            return res.status(201).json({
                message: 'Web sitesi başarıyla oluşturuldu.',
                website
            });
        }
    } catch (error) {
        console.error('Error submitting website:', error);
        res.status(500).json({ error: 'An error occurred while submitting the website.', details: error.message });
    }
});

// PUT /api/submit-website
// Update the website for a project
router.put('/submit-website', authenticateToken, async (req, res) => {
    const { project_id, url } = req.body;
    const studentId = req.user.id;

    if (!project_id || !url) {
        return res.status(400).json({ error: 'Both project_id and url are required.' });
    }

    try {
        // Check if the project exists and is active
        const project = await Project.findOne({
            where: {
                id: project_id,
                is_active: true
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Active project not found.' });
        }

        const now = new Date();

        // Check if current date is within the submission period
        if (now > project.end_date) {
            return res.status(400).json({ error: 'Submission period for this project has ended.' });
        }

        // Check if the website exists
        const website = await Website.findOne({
            where: {
                student_id: studentId,
                project_id: project_id
            }
        });

        if (!website) {
            return res.status(404).json({ error: 'Website to update not found.' });
        }

        // Update the URL
        website.url = url;
        await website.save();

        res.json({ message: 'Website successfully updated.', website });
    } catch (error) {
        console.error('Error updating website:', error);
        res.status(500).json({ error: 'An error occurred while updating the website.', details: error.message });
    }
});
    
// ==================
// Evaluation Management
// ==================

// GET /api/my-evaluations
router.get('/my-evaluations', authenticateToken, async (req, res) => {
    try {
        const studentId = req.user.id;
        const { project_id } = req.query;

        // Check if project_id is provided
        if (!project_id) {
            return res.status(400).json({ error: 'project_id query parameter is required.' });
        }

        // Verify if the project exists and is active
        const project = await Project.findOne({
            where: { id: project_id, is_active: true }
        });

        if (!project) {
            return res.status(404).json({ error: 'Specified project not found or inactive.' });
        }

        // Retrieve evaluations made by the student for the specified project
        const evaluations = await Evaluation.findAll({
            where: {
                evaluator_id: studentId,
                score: { [Op.ne]: null },
            },
            include: [
                {
                    model: Website,
                    as: 'website',
                    required: true, // INNER JOIN
                    where: { project_id: project_id }, // Specific project
                    attributes: ['id', 'url']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Format evaluations
        const formattedEvaluations = evaluations.map(evaluation => ({
            website_id: evaluation.website.id,
            url: evaluation.website.url,
            score: evaluation.score,
            comment: evaluation.comment,
            date: evaluation.created_at,
            can_update: new Date() <= project.evaluation_deadline // Ekstra bilgi: Güncelleyebilir mi?
        }));

        res.json(formattedEvaluations);
    } catch (error) {
        console.error('my-evaluations endpoint error:', error);
        res.status(500).json({ error: 'An error occurred while fetching evaluations.', details: error.message });
    }
});

// GET /api/evaluations-on-my-websites
router.get('/evaluations-on-my-websites', authenticateToken, async (req, res) => {
    try {
        const studentId = req.user.id;
        const { project_id } = req.query;

        // Check if project_id is provided
        if (!project_id) {
            return res.status(400).json({ error: 'project_id query parameter is required.' });
        }

        // Verify if the project exists and is active
        const project = await Project.findOne({
            where: { id: project_id, is_active: true }
        });

        if (!project) {
            return res.status(404).json({ error: 'Specified project not found or inactive.' });
        }

        // Find websites owned by the student for the specified project
        const myWebsites = await Website.findAll({
            where: { student_id: studentId, project_id: project_id },
            attributes: ['id', 'url']
        });

        if (myWebsites.length === 0) {
            return res.json({ message: 'You do not have any active websites for the specified project.' });
        }

        const websiteIds = myWebsites.map(ws => ws.id);

        // Retrieve evaluations made on the student's websites (up to 3)
        const evaluations = await Evaluation.findAll({
            where: {
                website_id: { [Op.in]: websiteIds },
                score: { [Op.ne]: null }
            },
            include: [
                {
        model: Website,
        as: 'website',
        attributes: ['id', 'url']
    },
                {
                    model: Website,
                    as: 'website',
                    attributes: ['id', 'url']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: 3
        });

        // Format evaluations
        const formattedEvaluations = evaluations.map(evaluation => ({
    website_id: evaluation.website.id,
    url: evaluation.website.url,
    score: evaluation.score,
    comment: evaluation.comment,
    date: evaluation.created_at
}));

res.json(formattedEvaluations);
        res.json(formattedEvaluations);
    } catch (error) {
        console.error('evaluations-on-my-websites endpoint error:', error);
        res.status(500).json({ error: 'An error occurred while fetching evaluations.', details: error.message });
    }
});

// GET /api/assigned-websites
router.get('/assigned-websites', authenticateToken, async (req, res) => {
    try {
        const studentId = req.user.id;
        const { project_id } = req.query;

        // Check if project_id is provided
        if (!project_id) {
            return res.status(400).json({ error: 'project_id query parameter is required.' });
        }

        // Verify if the project exists and is active
        const project = await Project.findOne({
            where: { id: project_id, is_active: true }
        });

        if (!project) {
            return res.status(404).json({ error: 'Specified project not found or inactive.' });
        }

        // Retrieve assigned but not yet evaluated websites for the specified project
        const evaluations = await Evaluation.findAll({
            where: {
                evaluator_id: studentId,
                score: null,
                comment: null
            },
            include: [
                {
                    model: Website,
                    as: 'website',
                    required: true, // INNER JOIN
                    attributes: ['id', 'url'],
                    include: [
                        {
                            model: Project,
                            as: 'project',
                            where: { is_active: true, id: project_id },
                            attributes: [] // Leave empty if project details are not needed
                        }
                    ]
                }
            ],
            limit: 3
        });

        // Log evaluations
        console.log('Evaluations:', JSON.stringify(evaluations, null, 2));

        // Format websites
        const websites = evaluations.map(evaluation => ({
            id: evaluation.website.id,
            url: evaluation.website.url,
            score: evaluation.score,      // null
            comment: evaluation.comment   // null
        }));

        res.json(websites);
    } catch (error) {
        console.error('assigned-websites endpoint error:', error);
        res.status(500).json({ error: 'An error occurred while fetching websites.', details: error.message });
    }
});

// POST /api/evaluate
router.post('/evaluate', authenticateToken, async (req, res) => {
    const { evaluations } = req.body; // evaluations: [{ website_id, score, comment }, ...]
    const { project_id } = req.query; // Project ID taken as a query parameter

    // Validation: Check if evaluations array exists, is an array, and each evaluation object is correct
    if (!evaluations || !Array.isArray(evaluations) || evaluations.length === 0) {
        return res.status(400).json({ error: 'You must make at least one evaluation.' });
    }

    // Check if project_id is provided
    if (!project_id) {
        return res.status(400).json({ error: 'project_id query parameter is required.' });
    }

    // Check if project_id is a valid number
    if (isNaN(project_id)) {
        return res.status(400).json({ error: 'project_id must be a valid number.' });
    }

    const studentId = req.user.id;

    try {
        // Verify if the project exists and is active
        const project = await Project.findOne({
            where: { id: project_id, is_active: true }
        });

        if (!project) {
            return res.status(404).json({ error: 'Specified project not found or inactive.' });
        }

        const now = new Date();

        // Check if current date is within the evaluation period
        if (now < project.end_date || now > project.evaluation_deadline) {
            return res.status(400).json({ error: 'Evaluation period is not active.' });
        }

        // Perform operations within a transaction to ensure data consistency
        await sequelize.transaction(async (t) => {
            // Use a Set to track used scores for uniqueness within the project
            const usedScores = new Set();

            // Retrieve existing evaluations for the student in this project
            const existingScores = await Evaluation.findAll({
                where: {
                    evaluator_id: studentId,
                },
                include: [{
                    model: Website,
                    as: 'website',
                    where: { project_id: project_id },
                    attributes: []
                }],
                transaction: t
            });

            existingScores.forEach(evaluation => {
                if (evaluation.score !== null) {
                    usedScores.add(evaluation.score);
                }
            });

            for (let evalItem of evaluations) {
                const { website_id, score, comment } = evalItem;

                // Validate the score (1-5)
                if (typeof score !== 'number' || score < 1 || score > 5) {
                    throw new Error('Scores must be between 1 and 5.');
                }

                // Check if the website exists and belongs to the specified project
                const website = await Website.findOne({
                    where: { id: website_id, project_id: project_id },
                    include: [
                        {
                            model: Project,
                            as: 'project',
                            where: { is_active: true }, // Active projects
                            attributes: []
                        }
                    ],
                    transaction: t
                });

                if (!website) {
                    throw new Error(`Website ID ${website_id} not found or does not belong to the specified project.`);
                }

                // Prevent evaluating own website
                if (website.student_id === studentId) {
                    throw new Error('You cannot evaluate your own website.');
                }

                // Ensure the same score is not given to multiple websites within the same project
                if (usedScores.has(score)) {
                    throw new Error(`Score ${score} has already been assigned to another website in this project.`);
                }

                // Find the assigned evaluation record that hasn't been evaluated yet
                const evaluationRecord = await Evaluation.findOne({
                    where: {
                        evaluator_id: studentId,
                        website_id: website_id,
                        score: null,
                        comment: null
                    },
                    transaction: t
                });

                if (!evaluationRecord) {
                    throw new Error(`No assigned evaluation found for Website ID ${website_id} or it has already been evaluated.`);
                }

                // Update the evaluation and set the created_at field to the current date
                evaluationRecord.score = score;
                evaluationRecord.comment = comment;
                evaluationRecord.created_at = new Date(); // Update the created_at field
                await evaluationRecord.save({ transaction: t });

                // Add the used score to the Set
                usedScores.add(score);
            }
        });

        res.json({ message: 'Evaluations successfully saved.' });
    } catch (error) {
        console.error('evaluate endpoint error:', error);
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/evaluate/:website_id
router.put('/evaluate/:website_id', authenticateToken, async (req, res) => {
    const { website_id } = req.params;
    const { score, comment } = req.body;
    const { project_id } = req.query; // Project ID taken as a query parameter
    const studentId = req.user.id;

    // Check if project_id is provided
    if (!project_id) {
        return res.status(400).json({ error: 'project_id query parameter is required.' });
    }

    // Check if project_id is a valid number
    if (isNaN(project_id)) {
        return res.status(400).json({ error: 'project_id must be a valid number.' });
    }

    try {
        // Verify if the project exists and is active
        const project = await Project.findOne({
            where: { id: project_id, is_active: true }
        });

        if (!project) {
            return res.status(404).json({ error: 'Specified project not found or inactive.' });
        }

        const now = new Date();

        // Check if current date is within the evaluation period
        if (now > project.evaluation_deadline) {
            return res.status(400).json({ error: 'Evaluation deadline has passed. Updates are no longer allowed.' });
        }

        // Perform operations within a transaction to ensure data consistency
        await sequelize.transaction(async (t) => {
            // Check if the evaluation exists and belongs to the specified project
            const evaluation = await Evaluation.findOne({
                where: {
                    evaluator_id: studentId,
                    website_id: website_id,
                },
                include: [
                    {
                        model: Website,
                        as: 'website',
                        where: { project_id: project_id }, // Specific project
                        include: [
                            {
                                model: Project,
                                as: 'project',
                                where: { is_active: true }, // Active projects
                                attributes: []
                            }
                        ],
                        attributes: ['id', 'url']
                    }
                ],
                transaction: t
            });

            if (!evaluation) {
                throw new Error('Evaluation not found or does not belong to the specified project.');
            }

            // Validate the score (1-5)
            if (typeof score !== 'number' || score < 1 || score > 5) {
                throw new Error('Scores must be between 1 and 5.');
            }

            // Ensure the same score is not given to multiple websites within the same project
            const existingScore = await Evaluation.findOne({
                where: {
                    evaluator_id: studentId,
                    score: score,
                    website_id: { [Op.ne]: website_id }
                },
                include: [{
                    model: Website,
                    as: 'website',
                    where: { project_id: project_id },
                    attributes: []
                }],
                transaction: t
            });

            if (existingScore) {
                throw new Error(`Score ${score} has already been assigned to another website in this project.`);
            }

            // Update the evaluation and set the created_at field to the current date
            evaluation.score = score;
            evaluation.comment = comment;
            evaluation.created_at = new Date(); // Update the created_at field
            await evaluation.save({ transaction: t });
        });

        res.json({ message: 'Evaluation successfully updated.' });
    } catch (error) {
        console.error('Evaluation update error:', error);
        res.status(400).json({ error: error.message });
    }
});

// ==================
// Export Router
// ==================
module.exports = router;
