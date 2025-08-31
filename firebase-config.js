// firebase-config.js

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyArCUJIyzqN_hP2CnY0UtszdkB97uZfG-Q",
  authDomain: "hishab-khata-df234.firebaseapp.com",
  projectId: "hishab-khata-df234",
  storageBucket: "hishab-khata-df234.firebasestorage.app",
  messagingSenderId: "102804548984",
  appId: "1:102804548984:web:8a40e5c04a3eb01925ac8d",
  measurementId: "G-YL1KX013H7"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Optional: Set up Firestore rules for security
// In Firebase Console -> Firestore Database -> Rules
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null; // Only authenticated users can read/write
    }
  }
}
*/
