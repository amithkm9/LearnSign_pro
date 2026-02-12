// MongoDB-based Authentication System for LearnSign
console.log('MongoDB Auth System Loading...');

// Global variables
let currentUser = null;

// ============ VALIDATION FUNCTIONS ============

// Validation rules
const validationRules = {
    email: {
        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        message: 'Please enter a valid email address (e.g., name@example.com)'
    },
    phone: {
        pattern: /^[0-9]{10}$/,
        message: 'Phone number must be exactly 10 digits'
    },
    password: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecial: true,
        specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    },
    name: {
        minLength: 2,
        pattern: /^[a-zA-Z\s]+$/,
        message: 'Name must be at least 2 characters and contain only letters'
    }
};

// Validate email
function validateEmail(email) {
    const result = { valid: true, message: '' };
    
    if (!email || email.trim() === '') {
        result.valid = false;
        result.message = 'Email is required';
        return result;
    }
    
    if (!validationRules.email.pattern.test(email)) {
        result.valid = false;
        result.message = validationRules.email.message;
        return result;
    }
    
    return result;
}

// Validate phone number
function validatePhone(phone) {
    const result = { valid: true, message: '' };
    
    if (!phone || phone.trim() === '') {
        result.valid = false;
        result.message = 'Phone number is required';
        return result;
    }
    
    // Remove any spaces or dashes
    const cleanPhone = phone.replace(/[\s-]/g, '');
    
    if (!validationRules.phone.pattern.test(cleanPhone)) {
        result.valid = false;
        result.message = validationRules.phone.message;
        return result;
    }
    
    return result;
}

// Validate password with detailed requirements
function validatePassword(password) {
    const result = { valid: true, message: '', requirements: [] };
    const rules = validationRules.password;
    
    if (!password || password.trim() === '') {
        result.valid = false;
        result.message = 'Password is required';
        return result;
    }
    
    // Check minimum length
    if (password.length < rules.minLength) {
        result.requirements.push(`At least ${rules.minLength} characters`);
    }
    
    // Check uppercase
    if (rules.requireUppercase && !/[A-Z]/.test(password)) {
        result.requirements.push('At least one uppercase letter (A-Z)');
    }
    
    // Check lowercase
    if (rules.requireLowercase && !/[a-z]/.test(password)) {
        result.requirements.push('At least one lowercase letter (a-z)');
    }
    
    // Check number
    if (rules.requireNumber && !/[0-9]/.test(password)) {
        result.requirements.push('At least one number (0-9)');
    }
    
    // Check special character
    if (rules.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
        result.requirements.push('At least one special character (!@#$%^&*...)');
    }
    
    if (result.requirements.length > 0) {
        result.valid = false;
        result.message = 'Password must contain: ' + result.requirements.join(', ');
    }
    
    return result;
}

// Validate name
function validateName(name, fieldName = 'Name') {
    const result = { valid: true, message: '' };
    
    if (!name || name.trim() === '') {
        result.valid = false;
        result.message = `${fieldName} is required`;
        return result;
    }
    
    if (name.trim().length < validationRules.name.minLength) {
        result.valid = false;
        result.message = `${fieldName} must be at least ${validationRules.name.minLength} characters`;
        return result;
    }
    
    if (!validationRules.name.pattern.test(name)) {
        result.valid = false;
        result.message = `${fieldName} can only contain letters and spaces`;
        return result;
    }
    
    return result;
}

// Show field error
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    // Remove existing error
    clearFieldError(fieldId);
    
    // Add error class to field
    field.classList.add('error');
    field.parentElement.classList.add('error');
    
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error-message';
    errorDiv.innerHTML = `<span class="error-icon">⚠️</span> ${message}`;
    
    // Insert after the field or input-border
    const inputBorder = field.nextElementSibling;
    if (inputBorder && inputBorder.classList.contains('input-border')) {
        inputBorder.insertAdjacentElement('afterend', errorDiv);
    } else {
        field.insertAdjacentElement('afterend', errorDiv);
    }
}

// Clear field error
function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    field.classList.remove('error');
    field.parentElement.classList.remove('error');
    
    // Remove error message
    const errorMsg = field.parentElement.querySelector('.field-error-message');
    if (errorMsg) {
        errorMsg.remove();
    }
}

// Show field success
function showFieldSuccess(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    clearFieldError(fieldId);
    field.classList.add('success');
    field.parentElement.classList.add('success');
}

// Real-time validation on blur
function setupRealTimeValidation() {
    // Email validation
    const loginEmail = document.getElementById('login-email');
    const registerEmail = document.getElementById('register-email');
    
    [loginEmail, registerEmail].forEach(field => {
        if (field) {
            field.addEventListener('blur', function() {
                const result = validateEmail(this.value);
                if (!result.valid) {
                    showFieldError(this.id, result.message);
                } else {
                    showFieldSuccess(this.id);
                }
            });
            field.addEventListener('input', function() {
                clearFieldError(this.id);
            });
        }
    });
    
    // Phone validation
    const registerPhone = document.getElementById('register-phone');
    if (registerPhone) {
        registerPhone.addEventListener('blur', function() {
            const result = validatePhone(this.value);
            if (!result.valid) {
                showFieldError(this.id, result.message);
            } else {
                showFieldSuccess(this.id);
            }
        });
        registerPhone.addEventListener('input', function() {
            // Only allow numbers
            this.value = this.value.replace(/[^0-9]/g, '');
            // Limit to 10 digits
            if (this.value.length > 10) {
                this.value = this.value.slice(0, 10);
            }
            clearFieldError(this.id);
        });
    }
    
    // Password validation
    const loginPassword = document.getElementById('login-password');
    const registerPassword = document.getElementById('register-password');
    
    if (registerPassword) {
        registerPassword.addEventListener('blur', function() {
            const result = validatePassword(this.value);
            if (!result.valid) {
                showFieldError(this.id, result.message);
            } else {
                showFieldSuccess(this.id);
            }
        });
        registerPassword.addEventListener('input', function() {
            clearFieldError(this.id);
            // Show password strength indicator
            updatePasswordStrength(this.value);
        });
    }
    
    // Name validation
    const registerFname = document.getElementById('register-fname');
    const registerLname = document.getElementById('register-lname');
    
    [registerFname, registerLname].forEach(field => {
        if (field) {
            const fieldName = field.id === 'register-fname' ? 'First name' : 'Last name';
            field.addEventListener('blur', function() {
                const result = validateName(this.value, fieldName);
                if (!result.valid) {
                    showFieldError(this.id, result.message);
                } else {
                    showFieldSuccess(this.id);
                }
            });
            field.addEventListener('input', function() {
                clearFieldError(this.id);
            });
        }
    });
}

// Password strength indicator
function updatePasswordStrength(password) {
    let strength = 0;
    let strengthText = '';
    let strengthClass = '';
    
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) strength++;
    
    if (strength <= 2) {
        strengthText = 'Weak';
        strengthClass = 'weak';
    } else if (strength <= 4) {
        strengthText = 'Medium';
        strengthClass = 'medium';
    } else {
        strengthText = 'Strong';
        strengthClass = 'strong';
    }
    
    // Update or create strength indicator
    let strengthIndicator = document.querySelector('.password-strength');
    if (!strengthIndicator && password.length > 0) {
        strengthIndicator = document.createElement('div');
        strengthIndicator.className = 'password-strength';
        const passwordField = document.getElementById('register-password');
        if (passwordField) {
            passwordField.parentElement.appendChild(strengthIndicator);
        }
    }
    
    if (strengthIndicator) {
        if (password.length === 0) {
            strengthIndicator.remove();
        } else {
            strengthIndicator.innerHTML = `
                <div class="strength-bar">
                    <div class="strength-fill ${strengthClass}" style="width: ${(strength/6) * 100}%"></div>
                </div>
                <span class="strength-text ${strengthClass}">${strengthText}</span>
            `;
        }
    }
}

// Validate entire registration form
function validateRegistrationForm() {
    let isValid = true;
    const errors = [];
    
    // Validate first name
    const fname = document.getElementById('register-fname');
    if (fname) {
        const result = validateName(fname.value, 'First name');
        if (!result.valid) {
            showFieldError('register-fname', result.message);
            errors.push(result.message);
            isValid = false;
        }
    }
    
    // Validate last name
    const lname = document.getElementById('register-lname');
    if (lname) {
        const result = validateName(lname.value, 'Last name');
        if (!result.valid) {
            showFieldError('register-lname', result.message);
            errors.push(result.message);
            isValid = false;
        }
    }
    
    // Validate email
    const email = document.getElementById('register-email');
    if (email) {
        const result = validateEmail(email.value);
        if (!result.valid) {
            showFieldError('register-email', result.message);
            errors.push(result.message);
            isValid = false;
        }
    }
    
    // Validate phone
    const phone = document.getElementById('register-phone');
    if (phone) {
        const result = validatePhone(phone.value);
        if (!result.valid) {
            showFieldError('register-phone', result.message);
            errors.push(result.message);
            isValid = false;
        }
    }
    
    // Validate password
    const password = document.getElementById('register-password');
    if (password) {
        const result = validatePassword(password.value);
        if (!result.valid) {
            showFieldError('register-password', result.message);
            errors.push(result.message);
            isValid = false;
        }
    }
    
    // Validate age group
    const ageGroup = document.getElementById('register-age-group');
    if (ageGroup && !ageGroup.value) {
        showFieldError('register-age-group', 'Please select an age group');
        errors.push('Age group is required');
        isValid = false;
    }
    
    // Validate user type
    const userType = document.querySelector('input[name="userType"]:checked');
    if (!userType) {
        showErrorMessage('Please select a user type (Student, Parent, or Educator)');
        errors.push('User type is required');
        isValid = false;
    }
    
    // Validate terms agreement
    const terms = document.getElementById('terms-agreement');
    if (terms && !terms.checked) {
        showErrorMessage('Please agree to the Terms of Service and Privacy Policy');
        errors.push('Terms agreement is required');
        isValid = false;
    }
    
    return { isValid, errors };
}

// Validate login form
function validateLoginForm() {
    let isValid = true;
    
    // Validate email
    const email = document.getElementById('login-email');
    if (email) {
        const result = validateEmail(email.value);
        if (!result.valid) {
            showFieldError('login-email', result.message);
            isValid = false;
        }
    }
    
    // Validate password (just check if not empty for login)
    const password = document.getElementById('login-password');
    if (password && !password.value.trim()) {
        showFieldError('login-password', 'Password is required');
        isValid = false;
    }
    
    return isValid;
}

// DOM Elements
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const emailLoginForm = document.getElementById('email-login-form');
const emailRegisterForm = document.getElementById('email-register-form');
const successMessage = document.getElementById('success-message');

// Initialize authentication system
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing auth system...');
    
    // Ensure profile is hidden by default
    initializeHeaderState();
    
    // Check if user is already logged in (from session)
    checkLoginStatus();
    
    // Setup event listeners only if we're on the login page
    if (window.location.pathname === '/login') {
        setupEventListeners();
    }
});

// Initialize header state (profile hidden by default)
function initializeHeaderState() {
    const loginBtn = document.getElementById('login-btn');
    const userProfile = document.getElementById('user-profile');
    
    if (loginBtn && userProfile) {
        // Ensure login button is visible and profile is hidden by default
        loginBtn.style.display = 'inline-block';
        userProfile.style.display = 'none';
        console.log('Header initialized - login button visible, profile hidden');
    }
}

// Check if user is logged in (from session storage or server session)
async function checkLoginStatus() {
    try {
        // Check local storage first
        const storedUser = localStorage.getItem('learnSignUser');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            console.log('Found stored user:', userData.email);
            currentUser = userData;
            updateHeaderForLoggedInUser(userData);
            
            // Show already logged in message if on login page
            if (window.location.pathname === '/login') {
                showAlreadyLoggedInMessage(userData);
            }
        } else {
            console.log('No stored user found');
            updateHeaderForLoggedOutUser();
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        updateHeaderForLoggedOutUser();
    }
}

// Event Listeners Setup (only for login page)
function setupEventListeners() {
    console.log('Setting up event listeners...');
    console.log('loginTab:', loginTab);
    console.log('registerTab:', registerTab);
    console.log('emailLoginForm:', emailLoginForm);
    console.log('emailRegisterForm:', emailRegisterForm);
    
    if (!loginTab || !registerTab) {
        console.error('Login/Register tabs not found!');
        return;
    }
    
    // Mode tabs (Login vs Register)
    loginTab.addEventListener('click', () => switchMode('login'));
    registerTab.addEventListener('click', () => switchMode('register'));
    
    // Form submissions
    if (emailLoginForm) {
        console.log('Adding login form event listener');
        emailLoginForm.addEventListener('submit', handleEmailLogin);
    } else {
        console.error('Login form not found!');
    }
    
    if (emailRegisterForm) {
        console.log('Adding register form event listener');
        emailRegisterForm.addEventListener('submit', handleEmailRegister);
    } else {
        console.error('Register form not found!');
    }
    
    // Setup real-time validation
    setupRealTimeValidation();
    
    console.log('Event listeners setup complete');
}

// Switch between login and register modes
function switchMode(mode) {
    const isLogin = mode === 'login';
    
    // Update tabs
    loginTab.classList.toggle('active', isLogin);
    registerTab.classList.toggle('active', !isLogin);
    
    // Update forms
    emailLoginForm.style.display = isLogin ? 'block' : 'none';
    emailRegisterForm.style.display = isLogin ? 'none' : 'block';
    
    // Clear any previous messages
    clearMessages();
}

// Handle email login
async function handleEmailLogin(e) {
    e.preventDefault();
    console.log('Login form submitted!');
    
    // Validate form first
    if (!validateLoginForm()) {
        return;
    }
    
    const emailField = document.getElementById('login-email');
    const passwordField = document.getElementById('login-password');
    
    if (!emailField || !passwordField) {
        console.error('Login form fields not found!');
        showErrorMessage('Login form error. Please refresh the page.');
        return;
    }
    
    const email = emailField.value;
    const password = passwordField.value;
    
    console.log('Attempting login for:', email);
    console.log('Password length:', password.length);
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('Login successful:', data.user.email);
            
            // Store user data
            currentUser = data.user;
            localStorage.setItem('learnSignUser', JSON.stringify(data.user));
            
            // Update header
            updateHeaderForLoggedInUser(data.user);
            
            // Show success message
            showSuccessMessage('Login successful! Redirecting to dashboard...');
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
            
        } else {
            showErrorMessage(data.message || 'Login failed. Please try again.');
        }
    } catch (error) {
        console.error('Login error:', error);
        showErrorMessage('Login failed. Please check your connection and try again.');
    }
}

// Handle email registration
async function handleEmailRegister(e) {
    e.preventDefault();
    
    // Validate form first
    const validation = validateRegistrationForm();
    if (!validation.isValid) {
        console.log('Validation failed:', validation.errors);
        return;
    }
    
    const firstName = document.getElementById('register-fname').value;
    const lastName = document.getElementById('register-lname').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const countryCode = document.getElementById('register-country-code').value;
    const password = document.getElementById('register-password').value;
    const ageGroup = document.getElementById('register-age-group').value;
    const userType = document.querySelector('input[name="userType"]:checked').value;
    
    console.log('Attempting registration for:', email);
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: `${firstName} ${lastName}`,
                firstName,
                lastName,
                email,
                phone: `${countryCode}${phone}`,
                password,
                ageGroup,
                userType
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('Registration successful:', data.user.email);
            
            // Store user data
            currentUser = data.user;
            localStorage.setItem('learnSignUser', JSON.stringify(data.user));
            
            // Update header
            updateHeaderForLoggedInUser(data.user);
            
            // Show success message
            showSuccessMessage('Registration successful! Redirecting to dashboard...');
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
            
        } else {
            showErrorMessage(data.message || 'Registration failed. Please try again.');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showErrorMessage('Registration failed. Please check your connection and try again.');
    }
}

// Update header for logged in user
function updateHeaderForLoggedInUser(user) {
    const loginBtn = document.getElementById('login-btn');
    const userProfile = document.getElementById('user-profile');
    
    if (loginBtn && userProfile) {
        loginBtn.style.display = 'none';
        userProfile.style.display = 'flex';
        
        const profileName = document.getElementById('profile-name');
        const profileEmail = document.getElementById('profile-email');
        const profileInitials = document.getElementById('profile-initials');
        
        if (profileName) profileName.textContent = user.name || 'User';
        if (profileEmail) profileEmail.textContent = user.email;
        if (profileInitials) {
            const name = user.name || user.email;
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            profileInitials.textContent = initials;
        }
        
        console.log('Header updated for logged in user:', user.name);
    }
}

// Update header for logged out user
function updateHeaderForLoggedOutUser() {
    const loginBtn = document.getElementById('login-btn');
    const userProfile = document.getElementById('user-profile');
    
    if (loginBtn && userProfile) {
        loginBtn.style.display = 'inline-block';
        userProfile.style.display = 'none';
        console.log('Header updated for logged out user');
    }
}

// Handle logout
function handleLogout() {
    console.log('Logging out user...');
    
    // Clear stored data
    currentUser = null;
    localStorage.removeItem('learnSignUser');
    
    // Update header
    updateHeaderForLoggedOutUser();
    
    // Redirect to home page
    window.location.href = '/';
}

// Handle profile logout (from dropdown)
function handleProfileLogout() {
    handleLogout();
}

// Show already logged in message
function showAlreadyLoggedInMessage(user) {
    const alreadyLoggedInDiv = document.createElement('div');
    alreadyLoggedInDiv.className = 'already-logged-in-message';
    alreadyLoggedInDiv.innerHTML = `
        <div class="info-content">
            <div class="info-icon">ℹ️</div>
            <div class="info-text">
                <h3>Already Logged In</h3>
                <p>You are currently logged in as <strong>${user.email}</strong></p>
                <div class="info-actions">
                    <a href="/dashboard" class="btn btn-primary">Go to Dashboard</a>
                    <button onclick="handleLogout()" class="btn btn-secondary">Logout</button>
                </div>
            </div>
        </div>
    `;
    
    const loginForm = document.querySelector('.auth-form-container');
    if (loginForm) {
        loginForm.prepend(alreadyLoggedInDiv);
    }
}

// Utility functions for messages
function showSuccessMessage(message) {
    if (successMessage) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        successMessage.className = 'success-message success';
    }
}

function showErrorMessage(message) {
    if (successMessage) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        successMessage.className = 'success-message error';
    }
}

function clearMessages() {
    if (successMessage) {
        successMessage.style.display = 'none';
        successMessage.textContent = '';
    }
}

// Make functions available globally
window.authFunctions = {
    handleLogout,
    handleProfileLogout,
    checkLoginStatus,
    currentUser: () => currentUser
};

// Global functions for onclick handlers
window.handleLogout = handleLogout;
window.handleProfileLogout = handleProfileLogout;

console.log('MongoDB Auth System Loaded Successfully');