// Import the functions you need from the SDKs you need

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";


//  Firebase configuration
// const firebaseConfig = {
//     //apiKey: "AIzaSyA1ELcXA-sFGJxnGUJc6U3xgWeB4-f7nxY",
//     authDomain: "edusign-e315e.firebaseapp.com",
//     projectId: "edusign-e315e",
//     storageBucket: "edusign-e315e.firebasestorage.app",
//     messagingSenderId: "354617663673",
//     appId: "1:354617663673:web:d36a17e9ff19e2492f7b68",
//     measurementId: "G-XBT16KY57X"
// };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Tab switching functionality
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Function to switch between login and register tabs
loginTab.addEventListener('click', function () {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';

    // Update the header text
    document.querySelector('.auth-header h1').textContent = 'Log In to learnSign';
    document.querySelector('.auth-header p').textContent = 'Welcome back! Please enter your credentials to continue';
});

registerTab.addEventListener('click', function () {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';

    // Update the header text
    document.querySelector('.auth-header h1').textContent = 'Join learnSign Today';
    document.querySelector('.auth-header p').textContent = 'Start your family\'s sign language learning journey with our FREE courses';
});

// Login functionality
const loginSubmitBtn = document.getElementById('login-submit-btn');
loginSubmitBtn.addEventListener("click", function (event) {
    event.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Signed in 
            const user = userCredential.user;
            alert("Welcome back! Redirecting to your learning dashboard.");
            // Redirect user to dashboard
            window.location.href = "/dashboard";
        })
        .catch((error) => {
            console.error("Login error:", error);
            console.log("Error code:", error.code);
            console.log("Error message:", error.message);
            alert(error.message);
        });
});

// Registration functionality
const registerSubmitBtn = document.getElementById('register-submit-btn');
registerSubmitBtn.addEventListener("click", function (event) {
    event.preventDefault();

    // Get all form values
    const fullName = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const userType = document.querySelector('input[name="user-type"]:checked').value;
    const termsAgreed = document.getElementById("terms-agree").checked;

    // Validate form
    if (!fullName || !email || !password || !confirmPassword) {
        alert("Please fill in all required fields");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords don't match");
        return;
    }

    if (!termsAgreed) {
        alert("You must agree to the Terms of Service and Privacy Policy");
        return;
    }

    // Create user account
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Account created successfully
            const user = userCredential.user;

            // Here you would typically save additional user info to your database
            // For example, the full name and user type
            
            // Store user info in localStorage for now
            localStorage.setItem('userInfo', JSON.stringify({
                name: fullName,
                email: email,
                userType: userType
            }));

            alert("Account created successfully! Welcome to learnSign! Redirecting to your learning dashboard.");

            // Redirect to dashboard
            window.location.href = "/dashboard";
        })
        .catch((error) => {
            console.error("Registration error:", error);
            console.log("Error code:", error.code);
            console.log("Error message:", error.message);
            alert(error.message);
        });
});





