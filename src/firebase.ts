import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA44jpTAox4wI7QvRrJnoaXF5CaX3qFV30",
  authDomain: "newapp-5178a.firebaseapp.com",
  databaseURL: "https://newapp-5178a.firebaseio.com",
  projectId: "newapp-5178a",
  storageBucket: "newapp-5178a.appspot.com",
  messagingSenderId: "362018966769",
  appId: "1:362018966769:web:1e9516fd64126db502ed50"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "reshelved");
export const storage = getStorage(app);
export default app;
