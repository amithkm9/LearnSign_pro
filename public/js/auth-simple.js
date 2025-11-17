// Simple MongoDB Authentication for LearnSign
console.log('Simple Auth System Loading...');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - setting up auth system');
    
    // Initialize header state
    initializeHeader();
    
    // Check if user is already logged in
    checkLoginStatus();
    
    // Setup login page if we're on it
    if (window.location.pathname === '/login') {
        setupLoginPage();
    }
});

function initializeHeader() {
    const loginBtn = document.getElementById('login-btn');
    const userDropdown = document.getElementById('user-dropdown');
    const dashboardNav = document.getElementById('dashboard-nav-item');
    
    console.log('Initializing header - loginBtn:', !!loginBtn, 'userDropdown:', !!userDropdown);
    
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (userDropdown) userDropdown.style.display = 'none';
    
    // Hide dashboard nav by default (will be shown when user logs in)
    if (dashboardNav) dashboardNav.style.display = 'none';
    
    // Setup dropdown toggle functionality
    setupDropdownToggle();
}

function checkLoginStatus() {
    const storedUser = localStorage.getItem('learnSignUser');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            console.log('Found stored user:', user.email);
            // Ensure userId is set for analytics
            if (user._id && !localStorage.getItem('userId')) {
                localStorage.setItem('userId', user._id);
            }
            updateHeaderForLoggedInUser(user);
        } catch (error) {
            console.error('Error parsing stored user:', error);
            localStorage.removeItem('learnSignUser');
            localStorage.removeItem('userId');
        }
    }
}

function setupLoginPage() {
    console.log('Setting up login page');
    
    const loginForm = document.getElementById('email-login-form');
    const registerForm = document.getElementById('email-register-form');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    
    console.log('Forms found:', {
        loginForm: !!loginForm,
        registerForm: !!registerForm,
        loginTab: !!loginTab,
        registerTab: !!registerTab
    });
    
    // Setup tabs
    if (loginTab) {
        loginTab.addEventListener('click', function() {
            console.log('Login tab clicked');
            switchToLogin();
        });
    }
    
    if (registerTab) {
        registerTab.addEventListener('click', function() {
            console.log('Register tab clicked');
            switchToRegister();
        });
    }
    
    // Setup forms
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Login form submitted');
            handleLogin();
        });
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Register form submitted');
            handleRegister();
        });
    }
}

function switchToLogin() {
    const loginForm = document.getElementById('email-login-form');
    const registerForm = document.getElementById('email-register-form');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    if (loginTab) loginTab.classList.add('active');
    if (registerTab) registerTab.classList.remove('active');
}

function switchToRegister() {
    const loginForm = document.getElementById('email-login-form');
    const registerForm = document.getElementById('email-register-form');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    if (loginTab) loginTab.classList.remove('active');
    if (registerTab) registerTab.classList.add('active');
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    console.log('Attempting login for:', email);
    
    if (!email || !password) {
        showMessage('Please enter both email and password', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (response.ok) {
            // Store user data
            localStorage.setItem('learnSignUser', JSON.stringify(data.user));
            localStorage.setItem('userId', data.user._id); // Store userId for analytics
            
            // Update header
            updateHeaderForLoggedInUser(data.user);
            
            // Show success message
            showMessage('Login successful! Redirecting...', 'success');
            
            // Redirect immediately
            window.location.href = '/';
            
        } else {
            showMessage(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Login failed. Please try again.', 'error');
    }
}

async function handleRegister() {
    const firstName = document.getElementById('register-fname').value;
    const lastName = document.getElementById('register-lname').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const countryCode = document.getElementById('register-country-code').value;
    const password = document.getElementById('register-password').value;
    const ageGroup = document.getElementById('register-age-group').value;
    const userType = document.querySelector('input[name="userType"]:checked')?.value;
    
    console.log('Attempting registration for:', email);
    
    if (!firstName || !lastName || !email || !password) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }
    
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
        console.log('Register response:', data);
        
        if (response.ok) {
            // Store user data
            localStorage.setItem('learnSignUser', JSON.stringify(data.user));
            localStorage.setItem('userId', data.user._id); // Store userId for analytics
            
            // Update header
            updateHeaderForLoggedInUser(data.user);
            
            // Show success message
            showMessage('Registration successful! Redirecting...', 'success');
            
            // Redirect immediately
            window.location.href = '/';
            
        } else {
            showMessage(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('Registration failed. Please try again.', 'error');
    }
}

function updateHeaderForLoggedInUser(user) {
    const loginBtn = document.getElementById('login-btn');
    const userDropdown = document.getElementById('user-dropdown');
    const dashboardNav = document.getElementById('dashboard-nav-item');
    
    console.log('Updating header for user:', user.name);
    
    if (loginBtn) loginBtn.style.display = 'none';
    if (userDropdown) userDropdown.style.display = 'block';
    
    // Show dashboard nav item when logged in
    if (dashboardNav) dashboardNav.style.display = 'block';
    
    // Update user info in dropdown
    const userName = document.getElementById('user-name');
    const userFullName = document.getElementById('user-full-name');
    const userEmail = document.getElementById('user-email');
    const userInitials = document.getElementById('user-initials');
    
    if (userName) userName.textContent = user.name;
    if (userFullName) userFullName.textContent = user.name;
    if (userEmail) userEmail.textContent = user.email;
    if (userInitials) {
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        userInitials.textContent = initials;
    }
}

function updateHeaderForLoggedOutUser() {
    const loginBtn = document.getElementById('login-btn');
    const userDropdown = document.getElementById('user-dropdown');
    const dashboardNav = document.getElementById('dashboard-nav-item');
    
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (userDropdown) userDropdown.style.display = 'none';
    
    // Hide dashboard nav item when logged out
    if (dashboardNav) dashboardNav.style.display = 'none';
}

function showMessage(message, type) {
    const messageElement = document.getElementById('success-message');
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `success-message ${type}`;
        messageElement.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 5000);
    } else {
        // Fallback to alert
        alert(message);
    }
}

function handleLogout() {
    console.log('Logging out...');
    localStorage.removeItem('learnSignUser');
    localStorage.removeItem('userId');
    updateHeaderForLoggedOutUser();
    window.location.href = '/';
}

function setupDropdownToggle() {
    const dropdownToggle = document.getElementById('user-dropdown-toggle');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (dropdownToggle && userDropdown) {
        dropdownToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!userDropdown.contains(e.target)) {
                userDropdown.classList.remove('active');
            }
        });
    }
}

// Make functions available globally
window.handleLogout = handleLogout;
window.handleProfileLogout = handleLogout;

console.log('Simple Auth System Loaded');
