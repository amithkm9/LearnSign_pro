// MongoDB-based Authentication System for LearnSign
console.log('MongoDB Auth System Loading...');

// Global variables
let currentUser = null;

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