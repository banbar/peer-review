// dashboard.js

// Token verification

const BASE_URL = '/api'; 

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
});

/**
 * Formats a date string to 'dd-mm-yyyy' format.
 * @param {string} dateString - ISO format date string.
 * @returns {string} - Formatted date string.
 */
function formatDate(dateString) {
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-GB', options);
}

/**
 * GET /api/me
 * Retrieves the logged-in student's information.
 */
async function loadStudentInfo() {
    try {
        const response = await fetch(`${BASE_URL}/me`, {
            method: 'GET',
            headers: {
              
            },
            credentials: 'include'
        });

        const student = await response.json();

        if (response.ok) {
            document.getElementById('studentName').innerText = `${student.first_name} ${student.last_name}`;
        } else {
            document.getElementById('studentName').innerText = 'Student';
            console.error('Error fetching student info:', student.error);
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('studentName').innerText = 'Student';
    }
}

/**
 * GET /api/active-projects
 * Retrieves active projects.
 */
async function loadActiveProjects() {
      try {
        const response = await fetch(`${BASE_URL}/active-projects`, {
            method: 'GET',
            credentials: 'include'
        });

        const projects = await response.json();

        if (response.ok) {
            const projectSelect = document.getElementById('projectSelect');
            const evaluationProjectSelect = document.getElementById('evaluationProjectSelect');

            // Populate project dropdown for saving website
            projectSelect.innerHTML = '<option value="">Select a project</option>';
            // Populate project dropdown for evaluations
            evaluationProjectSelect.innerHTML = '<option value="">Select a project</option>';

            projects.forEach(project => {
                const option1 = document.createElement('option');
                option1.value = project.id;
                option1.textContent = `${project.name}`;
                projectSelect.appendChild(option1);

                const option2 = document.createElement('option');
                option2.value = project.id;
                option2.textContent = `${project.name}`;
                evaluationProjectSelect.appendChild(option2);
            });

            if (projects.length === 0) {
                const message = document.createElement('p');
                message.textContent = 'No active projects available.';
                message.style.color = 'red';
                document.getElementById('submitWebsiteForm').appendChild(message);
                document.getElementById('evaluationProjectSection').style.display = 'none';
            }
        } else {
            alert('An error occurred while fetching active projects: ' + (projects.error || 'Unknown Error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while fetching active projects.');
    }
}
// Form modu: 'create' | 'update'
let submitMode = 'create';

function setSubmitMode(mode, url = '') {
  submitMode = mode; // 'create' veya 'update'
  const btn = submitWebsiteForm.querySelector('button[type="submit"]');
  const title = document.querySelector('section h2'); // ilk başlığa erişiyor

  if (mode === 'update') {
    btn.textContent = 'Update Website';
    websiteUrlInput.value = url || '';
    if (title) title.textContent = 'Update Your Website';
  } else {
    btn.textContent = 'Save Website';
    websiteUrlInput.value = '';
    if (title) title.textContent = 'Select Project and Save Website';
  }
}

/**
 * Function to load and initialize all necessary data on page load
 */
document.addEventListener('DOMContentLoaded', async () => {
    await loadAllData();
});

/**
 * Load All Data
 */
async function loadAllData() {
    await loadActiveProjects();
    await loadStudentInfo();
    // No need to load assigned websites initially, they load upon project selection
}

document.getElementById('evaluationProjectSelect').addEventListener('change', async (e) => {
  const pid = e.target.value;
  if (pid) await refreshProjectData(pid);
});


async function refreshProjectData(project_id) {
  if (!project_id) return;
  // Tarih/faz bilgisini ve form görünürlüklerini günceller
  await loadProjectDetails(project_id);
  // Butonsuz otomatik veri yüklemeleri
  await loadAssignedWebsites(project_id);
  await loadMyEvaluations(project_id);
  await loadEvaluationsOnMyWebsites(project_id);
}

/**
 * GET /api/project/:project_id
 * Retrieves details of a specific project (start_date, end_date, evaluation_deadline).
 */
async function loadProjectDetails(project_id) {
    try {
        const response = await fetch(`${BASE_URL}/project/${project_id}`, {
            method: 'GET',
            headers: {
               
            },
            credentials: 'include'
        });

        const project = await response.json();

        if (response.ok) {
            
            const projectDates = document.getElementById('projectDates');
            // Extract project start, end, and evaluation_deadline dates in 'dd-mm-yyyy' format
            const startDate = formatDate(project.start_date);
            const endDate = formatDate(project.end_date);
            const evaluationDeadline = formatDate(project.evaluation_deadline);
            projectDates.innerText = `Start Date: ${startDate}, End Date: ${endDate}, Evaluation Deadline: ${evaluationDeadline}`;

            // ✅ DOĞRUSU: loadProjectDetails içinde, response.ok true olduktan sonra
const now = new Date();
let phase = 'closed';
if (now >= new Date(project.start_date) && now <= new Date(project.end_date)) {
  phase = 'submission';
} else if (now > new Date(project.end_date) && now <= new Date(project.evaluation_deadline)) {
  phase = 'evaluation';
}
window._projectPhase = phase; // 'submission' | 'evaluation' | 'closed'


            // Determine the current phase of the project
            if (now >= new Date(project.start_date) && now <= new Date(project.end_date)) {
                // Submission Period
                document.getElementById('submitWebsiteForm').style.display = 'block';
                document.getElementById('submitWebsiteForm').disabled = false;

                document.getElementById('evaluateForm').style.display = 'none';
                document.getElementById('listAssignedWebsitesBtn').disabled = true;
                document.getElementById('evaluationsOnMyWebsitesBtn').disabled = true;

                // Remove any previous messages
                const messages = document.querySelectorAll('.message.warning');
                messages.forEach(msg => msg.remove());
            } else if (now > new Date(project.end_date) && now <= new Date(project.evaluation_deadline)) {
                // Evaluation Period
                document.getElementById('submitWebsiteForm').style.display = 'none';
                document.getElementById('listAssignedWebsitesBtn').disabled = false;
                document.getElementById('evaluationsOnMyWebsitesBtn').disabled = false;

                document.getElementById('evaluateForm').style.display = 'block';

                // Remove any previous messages
                const messages = document.querySelectorAll('.message.warning');
                messages.forEach(msg => msg.remove());
            } else {
                // Past Evaluation Deadline
                document.getElementById('submitWebsiteForm').style.display = 'none';
                document.getElementById('evaluateForm').style.display = 'none';
                document.getElementById('listAssignedWebsitesBtn').disabled = true;
                document.getElementById('evaluationsOnMyWebsitesBtn').disabled = true;

                // Show messages
                const submissionMessage = document.createElement('p');
                submissionMessage.innerText = 'Website submission period has ended.';
                submissionMessage.className = 'message warning';
                document.getElementById('submitWebsiteForm').parentNode.appendChild(submissionMessage);

                const evaluationMessage = document.createElement('p');
                evaluationMessage.innerText = 'Evaluation period has ended.';
                evaluationMessage.className = 'message warning';
                document.getElementById('evaluateForm').parentNode.appendChild(evaluationMessage);
            }
        } else {
            document.getElementById('projectDates').innerText = 'An error occurred while loading project details.';
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('projectDates').innerText = 'An error occurred while loading project details.';
    }
}

/**
 * Function to check if a website is already registered for the selected project
 * GET /api/submit-website?project_id=xxx
 */
async function checkWebsiteExists(project_id) {
    try {
        const response = await fetch(`${BASE_URL}/submit-website?project_id=${project_id}`, {
            method: 'GET',
            headers: {
                
            },
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            // API'nin yanıt yapısına göre ayarlayın
            // Örneğin: { url: "https://example.com" }
            return data; 
        } else if (response.status === 404) {
            // Website not found for this project
            return null;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Unknown Error');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Web sitesi kaydı kontrol edilirken bir hata oluştu.');
        return null;
    }
}

// Event listener for project selection in "Select Project and Save Website" section
const projectSelect = document.getElementById('projectSelect');
const submitWebsiteForm = document.getElementById('submitWebsiteForm');
const submitWebsiteMessage = document.getElementById('submitWebsiteMessage');
const websiteUrlInput = document.getElementById('websiteUrl');
const currentWebsiteUrl = document.getElementById('currentWebsiteUrl');

projectSelect.addEventListener('change', async (e) => {
  const selectedProjectId = e.target.value;

  if (!selectedProjectId) {
    setSubmitMode('create');
    submitWebsiteForm.style.display = 'block';
    submitWebsiteMessage.innerHTML = '';
    submitWebsiteMessage.className = 'message';
    currentWebsiteUrl.innerHTML = '';
    return;
  }

  await loadProjectDetails(selectedProjectId); // fazı güncelle
  const existingWebsite = await checkWebsiteExists(selectedProjectId);

  if (existingWebsite) {
    currentWebsiteUrl.innerHTML = `Current Website: <a href="${existingWebsite.url}" target="_blank">${existingWebsite.url}</a>`;

    if (window._projectPhase === 'submission') {
      // ❗ Artık modal yok; aynı formda update yapıyoruz
      submitWebsiteForm.style.display = 'block';
      submitWebsiteMessage.innerHTML = '';
      submitWebsiteMessage.className = 'message';
      setSubmitMode('update', existingWebsite.url);
    } else {
      submitWebsiteForm.style.display = 'none';
      submitWebsiteMessage.innerHTML = `Updates are not allowed in the current phase.`;
      submitWebsiteMessage.className = 'message warning';
    }
  } else {
    if (window._projectPhase === 'submission') {
      submitWebsiteForm.style.display = 'block';
      submitWebsiteMessage.innerHTML = '';
      submitWebsiteMessage.className = 'message';
      currentWebsiteUrl.innerHTML = '';
      setSubmitMode('create');
    } else {
      submitWebsiteForm.style.display = 'none';
      submitWebsiteMessage.innerHTML = 'Website submission period is not active.';
      submitWebsiteMessage.className = 'message warning';
      currentWebsiteUrl.innerHTML = '';
      setSubmitMode('create');
    }
  }
});


/**
 * POST /api/submit-website
 * Saves the website associated with the selected project.
 */
submitWebsiteForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const project_id = document.getElementById('projectSelect').value;
  const url = websiteUrlInput.value.trim();

  if (!project_id || !url) {
    submitWebsiteMessage.innerText = 'Project and Website URL are required.';
    submitWebsiteMessage.className = 'message error';
    return;
  }

  const requestBody = { project_id: parseInt(project_id), url };

  // 🔁 Moda göre method seçimi
  const method = (submitMode === 'update') ? 'PUT' : 'POST';

  try {
    const response = await fetch(`${BASE_URL}/submit-website`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok) {
      if (submitMode === 'update') {
        submitWebsiteMessage.innerText = data.message || 'Website successfully updated.';
        submitWebsiteMessage.className = 'message success';
        currentWebsiteUrl.innerHTML = `Current Website: <a href="${url}" target="_blank">${url}</a>`;
      } else {
        submitWebsiteMessage.innerText = data.message || 'Website successfully saved.';
        submitWebsiteMessage.className = 'message success';
        // Kaydettikten sonra update moduna geç
        setSubmitMode('update', url);
        currentWebsiteUrl.innerHTML = `Current Website: <a href="${url}" target="_blank">${url}</a>`;
      }
      await loadActiveProjects();
    } else {
      submitWebsiteMessage.innerText = data.error || 'An error occurred while saving the website.';
      submitWebsiteMessage.className = 'message error';
    }
  } catch (error) {
    console.error('Error:', error);
    submitWebsiteMessage.innerText = 'An error occurred while saving the website.';
    submitWebsiteMessage.className = 'message error';
  }
});


/**
 * PUT /api/submit-website
 * Updates the website associated with the selected project.
 */
const updateWebsiteForm = document.getElementById('updateWebsiteForm');
const updateWebsiteMessage = document.getElementById('updateWebsiteMessage');

updateWebsiteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const project_id = updateWebsiteForm.dataset.projectId;
    const newUrl = document.getElementById('updateWebsiteUrl').value.trim();

    if (!project_id || !newUrl) {
        updateWebsiteMessage.innerText = 'Project ID and New URL are required.';
        updateWebsiteMessage.className = 'message error';
        return;
    }

    const requestBody = { project_id: parseInt(project_id), url: newUrl };

    try {
        const response = await fetch(`${BASE_URL}/submit-website`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (response.ok) {
            updateWebsiteMessage.innerText = data.message || 'Website successfully updated.';
            updateWebsiteMessage.className = 'message success';
            // Reload active projects to reflect changes
            await loadActiveProjects();
            // Update the current website URL display
            currentWebsiteUrl.innerHTML = `Current Website: <a href="${newUrl}" target="_blank">${newUrl}</a>`;
            // Close the modal after a short delay
            setTimeout(() => {
                const updateWebsiteModal = document.getElementById('updateWebsiteModal');
                updateWebsiteModal.style.display = 'none';
                updateWebsiteForm.reset();
                updateWebsiteMessage.innerText = '';
                updateWebsiteMessage.className = 'message';
            }, 1500);
        } else {
            updateWebsiteMessage.innerText = data.error || 'Website could not be updated.';
            updateWebsiteMessage.className = 'message error';
        }
    } catch (error) {
        console.error('Error:', error);
        updateWebsiteMessage.innerText = 'An error occurred while updating the website.';
        updateWebsiteMessage.className = 'message error';
    }
});

/**
 * GET /api/assigned-websites
 * Retrieves websites assigned to the logged-in student based on the selected project_id.
 * @param {string} project_id - ID of the selected project
 */
async function loadAssignedWebsites(project_id) {
    console.log(`Loading assigned websites for project ID: ${project_id}`); // Debugging
    try {
        // Add project_id as a query parameter
        const url = project_id ? `${BASE_URL}/assigned-websites?project_id=${project_id}` : `${BASE_URL}/assigned-websites`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                
            },
            credentials: 'include'
        });

        const websites = await response.json();

        console.log('API Response:', websites); // Debugging

        if (response.ok) {
            const list = document.getElementById('assignedWebsitesList');
            list.innerHTML = '';

            const evaluationFields = document.getElementById('evaluationFields');
            evaluationFields.innerHTML = ''; // Clear previous evaluations

            if (websites.message) {
                list.innerHTML = `<li>${websites.message}</li>`;
                return;
            }

            if (websites.length === 0) {
                list.innerHTML = '<li>No websites assigned to the selected project.</li>';
                return;
            }

            websites.forEach((ws, index) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <strong>Site ${index + 1}:</strong> <a href="${ws.url}" target="_blank" rel="noopener noreferrer">${ws.url}</a><br>
                `;
                list.appendChild(listItem);

                // Add fields to the evaluation form
                evaluationFields.innerHTML += `
                    <div>
                        <strong><a href="${ws.url}" target="_blank" rel="noopener noreferrer">${ws.url}</a></strong><br>
                        <label for="score_${ws.id}">Score (1-5):</label>
                        <input type="number" id="score_${ws.id}" name="score_${ws.id}" min="1" max="5" required><br>
                        <label for="comment_${ws.id}">Comment:</label>
                        <textarea id="comment_${ws.id}" name="comment_${ws.id}" placeholder="Your comment"></textarea><br><br>
                    </div>
                `;
            });
        } else {
            alert('An error occurred while fetching websites: ' + (websites.error || 'Unknown Error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while fetching websites.');
    }
}

// Event listener for the "Get Assigned Websites" button


/**
 * POST /api/evaluate
 * Allows the student to evaluate assigned websites.
 * Requires project_id as a query parameter for project-based operation.
 */
const evaluateForm = document.getElementById('evaluateForm');
const evaluateMessage = document.getElementById('evaluateMessage');

evaluateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const evaluationProjectSelect = document.getElementById('evaluationProjectSelect').value;
    if (!evaluationProjectSelect) {
        evaluateMessage.innerText = 'You must select a project before evaluating.';
        evaluateMessage.className = 'message error';
        return;
    }

    const evaluationFields = document.getElementById('evaluationFields');
    const inputs = evaluationFields.querySelectorAll('input[type="number"]');
    const textareas = evaluationFields.querySelectorAll('textarea');

    const evaluations = [];

    inputs.forEach(input => {
        const website_id = input.id.split('_')[1];
        const score = parseInt(input.value);
        const comment = document.getElementById(`comment_${website_id}`).value.trim();

        evaluations.push({
            website_id: parseInt(website_id),
            score,
            comment
        });
    });

    // Ensure at least one evaluation is made
    if (evaluations.length === 0) {
        evaluateMessage.innerText = 'You must make at least one evaluation.';
        evaluateMessage.className = 'message error';
        return;
    }

    // Validate scores for each evaluation
    for (let evalItem of evaluations) {
        if (evalItem.score < 1 || evalItem.score > 5) {
            evaluateMessage.innerText = 'Scores must be between 1 and 5.';
            evaluateMessage.className = 'message error';
            return;
        }
    }

    const requestBody = { evaluations };

    try {
        const response = await fetch(`${BASE_URL}/evaluate?project_id=${evaluationProjectSelect}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (response.ok) {
  evaluateMessage.innerText = data.message;
  evaluateMessage.className = 'message success';

  // ✅ Kendi değerlendirmelerimi anında güncelle
  await loadMyEvaluations(evaluationProjectSelect);

  // (Opsiyonel) atananları yenilemek istersen kalsın
  await loadAssignedWebsites(evaluationProjectSelect);

  evaluateForm.reset();
} else {
            // Handle error messages
            evaluateMessage.innerText = data.error || 'Evaluation failed.';
            evaluateMessage.className = 'message error';
        }
    } catch (error) {
        console.error('Error:', error);
        evaluateMessage.innerText = 'An error occurred during evaluation.';
        evaluateMessage.className = 'message error';
    }
});

/**
 * GET /api/my-evaluations
 * Retrieves evaluations made by the logged-in student.
 * Requires project_id as a query parameter for project-based operation.
 */

/**
 * Function to load evaluations made by the student
 * GET /api/my-evaluations
 */
async function loadMyEvaluations(project_id) {
    try {
        const response = await fetch(`${BASE_URL}/my-evaluations?project_id=${project_id}`, {
            method: 'GET',
            headers: {
            
            },
            credentials: 'include'
        });

        const myEvaluations = await response.json();

        console.log('My Evaluations:', myEvaluations); // Debugging

        if (response.ok) {
            const list = document.getElementById('myEvaluationsList');
            list.innerHTML = '';

            if (myEvaluations.length === 0) {
                list.innerHTML = '<li>You have not made any evaluations yet.</li>';
                return;
            }

            myEvaluations.forEach((evalItem, index) => {
                const canUpdate = evalItem.can_update;
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <strong>Evaluation ${index + 1}:</strong><br>
                    <strong>Site:</strong> <a href="${evalItem.url}" target="_blank" rel="noopener noreferrer">${evalItem.url}</a><br>
                    <strong>Score:</strong> ${evalItem.score}<br>
                    <strong>Comment:</strong> ${evalItem.comment}<br>
                    ${canUpdate ? `<button class="update-btn" onclick="openUpdateModal(${evalItem.website_id}, ${evalItem.score}, '${evalItem.comment.replace(/'/g, "\\'")}')">Update</button>` : ''}
                    <br><br>
                `;
                list.appendChild(listItem);
            });
        } else {
            alert('An error occurred while fetching evaluations: ' + (myEvaluations.error || 'Unknown Error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while fetching evaluations.');
    }
}

/**
 * Function to load evaluations made on the student's websites
 * GET /api/evaluations-on-my-websites
 */
async function loadEvaluationsOnMyWebsites(project_id) {
    console.log(`Loading evaluations for project ID: ${project_id}`); // Debugging
    try {
        const response = await fetch(`${BASE_URL}/evaluations-on-my-websites?project_id=${project_id}`, {
            method: 'GET',
            headers: {
            
            },
            credentials: 'include'
        });

        const evaluationsOnMyWebsites = await response.json();

        console.log('API Response:', evaluationsOnMyWebsites); // Debugging

        if (response.ok) {
            const list = document.getElementById('evaluationsOnMyWebsitesList');
            list.innerHTML = '';

            if (evaluationsOnMyWebsites.message) {
                list.innerHTML = `<li>${evaluationsOnMyWebsites.message}</li>`;
                return;
            }

            if (evaluationsOnMyWebsites.length === 0) {
                list.innerHTML = '<li>No evaluations have been made on your websites yet.</li>';
                return;
            }

            evaluationsOnMyWebsites.forEach((evalItem, index) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <strong>Evaluation ${index + 1}:</strong><br>
                    <strong>Site:</strong> <a href="${evalItem.url}" target="_blank" rel="noopener noreferrer">${evalItem.url}</a><br>
                    <strong>Score:</strong> ${evalItem.score}<br>
                    <strong>Comment:</strong> ${evalItem.comment}<br>
                `;
                list.appendChild(listItem);
            });
        } else {
            alert('An error occurred while fetching evaluations: ' + (evaluationsOnMyWebsites.error || 'Unknown Error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while fetching evaluations.');
    }
}

/**
 * Open Update Evaluation Modal
 * @param {number} website_id - The ID of the website being evaluated
 * @param {number} currentScore - The current score assigned
 * @param {string} currentComment - The current comment
 */
function openUpdateModal(website_id, currentScore, currentComment) {
    const updateModal = document.getElementById('updateModal');
    const newScoreInput = document.getElementById('newScore');
    const newCommentTextarea = document.getElementById('newComment');
    const updateForm = document.getElementById('updateForm');
    const updateMessage = document.getElementById('updateMessage');

    newScoreInput.value = currentScore;
    newCommentTextarea.value = currentComment;

    updateForm.dataset.websiteId = website_id;
    updateForm.dataset.projectId = document.getElementById('evaluationProjectSelect').value; // Store project_id for updating
    updateMessage.innerText = '';
    updateMessage.className = 'message';

    updateModal.style.display = 'block';
}

/**
 * Close Update Evaluation Modal
 */
document.getElementById('closeUpdateModal').addEventListener('click', () => {
    const updateModal = document.getElementById('updateModal');
    const updateForm = document.getElementById('updateForm');
    const updateMessage = document.getElementById('updateMessage');

    updateModal.style.display = 'none';
    updateForm.reset();
    updateMessage.innerText = '';
    updateMessage.className = 'message';
});

document.getElementById('closeModalBtn').addEventListener('click', () => {
    const updateModal = document.getElementById('updateModal');
    const updateForm = document.getElementById('updateForm');
    const updateMessage = document.getElementById('updateMessage');

    updateModal.style.display = 'none';
    updateForm.reset();
    updateMessage.innerText = '';
    updateMessage.className = 'message';
});

/**
 * Open Update Website Modal
 * @param {number} project_id - The ID of the project whose website is being updated
 * @param {string} currentUrl - The current URL of the website
 */
function openUpdateWebsiteModal(project_id, currentUrl) {
    const updateWebsiteModal = document.getElementById('updateWebsiteModal');
    const updateWebsiteUrlInput = document.getElementById('updateWebsiteUrl');
    const updateWebsiteForm = document.getElementById('updateWebsiteForm');
    const updateWebsiteMessage = document.getElementById('updateWebsiteMessage');

    updateWebsiteUrlInput.value = currentUrl;
    updateWebsiteForm.dataset.projectId = project_id; // Store project_id for updating
    updateWebsiteMessage.innerText = '';
    updateWebsiteMessage.className = 'message';

    updateWebsiteModal.style.display = 'block';
}

/**
 * Close Update Website Modal
 */
document.getElementById('closeUpdateWebsiteModal').addEventListener('click', () => {
    const updateWebsiteModal = document.getElementById('updateWebsiteModal');
    const updateWebsiteForm = document.getElementById('updateWebsiteForm');
    const updateWebsiteMessage = document.getElementById('updateWebsiteMessage');

    updateWebsiteModal.style.display = 'none';
    updateWebsiteForm.reset();
    updateWebsiteMessage.innerText = '';
    updateWebsiteMessage.className = 'message';
});

document.getElementById('closeUpdateWebsiteBtn').addEventListener('click', () => {
    const updateWebsiteModal = document.getElementById('updateWebsiteModal');
    const updateWebsiteForm = document.getElementById('updateWebsiteForm');
    const updateWebsiteMessage = document.getElementById('updateWebsiteMessage');

    updateWebsiteModal.style.display = 'none';
    updateWebsiteForm.reset();
    updateWebsiteMessage.innerText = '';
    updateWebsiteMessage.className = 'message';
});
// Event listener for the "Get Evaluations on My Websites" button

/**
 * PUT /api/evaluate/:website_id
 * Updates a specific evaluation.
 */
const updateFormElement = document.getElementById('updateForm');
const updateMessageElement = document.getElementById('updateMessage');

updateFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    const website_id = updateFormElement.dataset.websiteId;
    const project_id = updateFormElement.dataset.projectId;
    const newScore = parseInt(document.getElementById('newScore').value);
    const newComment = document.getElementById('newComment').value.trim();

    if (!website_id || !project_id || !newScore) {
        updateMessageElement.innerText = 'All fields are required.';
        updateMessageElement.className = 'message error';
        return;
    }

    if (newScore < 1 || newScore > 5) {
        updateMessageElement.innerText = 'Score must be between 1 and 5.';
        updateMessageElement.className = 'message error';
        return;
    }

    const requestBody = { score: newScore, comment: newComment };

    try {
        const response = await fetch(`${BASE_URL}/evaluate/${website_id}?project_id=${project_id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (response.ok) {
            updateMessageElement.innerText = data.message || 'Evaluation successfully updated.';
            updateMessageElement.className = 'message success';
            // Reload evaluations to reflect changes
            await loadAssignedWebsites(project_id);
            // Reload evaluations list if it's open
            await loadMyEvaluations(project_id);
            // Close the modal after a short delay
            setTimeout(() => {
                const updateModal = document.getElementById('updateModal');
                updateModal.style.display = 'none';
                updateFormElement.reset();
                updateMessageElement.innerText = '';
                updateMessageElement.className = 'message';
            }, 1500);
        } else {
            updateMessageElement.innerText = data.error || 'Evaluation could not be updated.';
            updateMessageElement.className = 'message error';
        }
    } catch (error) {
        console.error('Error:', error);
        updateMessageElement.innerText = 'An error occurred while updating the evaluation.';
        updateMessageElement.className = 'message error';
    }
});
