import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Konfigurasi rahasia Firebase milik Academic Hub
const firebaseConfig = {
  apiKey: "AIzaSyBJcVpoiiNyvhiAQLoHt6N7PtEVUZVq5e8",
  authDomain: "academic-hub-50208.firebaseapp.com",
  projectId: "academic-hub-50208",
  storageBucket: "academic-hub-50208.firebasestorage.app",
  messagingSenderId: "1095849550415",
  appId: "1:1095849550415:web:d60bf04612c3c3296f803a"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Ekspor koneksi Database agar bisa dipakai oleh file AcademicHub.jsx
export const db = getFirestore(app);