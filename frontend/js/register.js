document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const studentNumber   = document.getElementById('student_number').value.trim();
  const firstName       = document.getElementById('first_name').value.trim();
  const lastName        = document.getElementById('last_name').value.trim();
  const emailInput      = document.getElementById('email');
  const emailRaw        = emailInput ? emailInput.value.trim() : '';
  const password        = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm_password').value;
  const errorMessage    = document.getElementById('errorMessage');
  const spinner         = document.getElementById('spinner');
  const backHome        = document.getElementById('backHome');

  errorMessage.innerText = '';
  errorMessage.style.color = 'red';
  backHome.style.display = 'none';

  if (password !== confirmPassword) {
    errorMessage.innerText = 'Passwords do not match.';
    return;
  }

  const email = (emailRaw || '').toLowerCase();
  const hacettepeRegex = /^[a-z0-9._%+-]+@hacettepe\.edu\.tr$/;
  if (!email) {
    errorMessage.innerText = 'Email is required.';
    return;
  }
  if (!hacettepeRegex.test(email)) {
    errorMessage.innerText = 'Only emails with the @hacettepe.edu.tr extension are accepted.';
    return;
  }

  const requestBody = {
    student_number: studentNumber,
    first_name: firstName,
    last_name: lastName,
    email,
    password
  };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  spinner.style.display = 'block';  // Spinner göster

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok) {
      errorMessage.innerText = 'Registration successful! Please verify your email.';
      errorMessage.style.color = 'green';
      backHome.style.display = 'block'; // Başarı sonrası buton göster
    } else {
      errorMessage.innerText = data.error || 'An error occurred during registration.';
      errorMessage.style.color = 'red';
    }
  } catch (error) {
    console.error('Error:', error);
    errorMessage.innerText = 'An error occurred during registration.';
    errorMessage.style.color = 'red';
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    spinner.style.display = 'none'; // Spinner gizle
  }
});
