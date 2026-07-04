import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBncLpnXmd5KIvE8Sq4iKi1ug4bl4hxhqk",
    authDomain: "kmt-tracker-62159.firebaseapp.com",
    databaseURL: "https://kmt-tracker-62159-default-rtdb.firebaseio.com",
    projectId: "kmt-tracker-62159",
    storageBucket: "kmt-tracker-62159.firebasestorage.app",
    messagingSenderId: "1093592499284",
    appId: "1:1093592499284:web:4853d75fc34b31879859c1",
    measurementId: "G-9C4RLRMQK0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser environment)
let analytics = null;
isSupported().then((supported) => {
    if (supported) {
        analytics = getAnalytics(app);
    }
});

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Storage
export const storage = getStorage(app);

// Export app instance
export default app;
