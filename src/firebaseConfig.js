import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCqtYK0D9xdsyv1AHOiVqrhyBsf_IFU3C0",
  authDomain: "damas-online-ed36d.firebaseapp.com",
  projectId: "damas-online-ed36d",
  storageBucket: "damas-online-ed36d.firebasestorage.app",
  messagingSenderId: "905892998497",
  appId: "1:905892998497:web:9aac6c3339e31331b86920"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);