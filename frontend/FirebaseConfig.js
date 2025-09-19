// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {initializeAuth, getReactNativePersistence } from "firebase/auth";
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDvjkZcRq2LerjAyLzYOf7MTt9OlUE5qCo",
  authDomain: "authdb-dd768.firebaseapp.com",
  projectId: "authdb-dd768",
  storageBucket: "authdb-dd768.firebasestorage.app",
  messagingSenderId: "403947687872",
  appId: "1:403947687872:web:ab49d713e8f42f30b0c225"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app,{
    persistence: getReactNativePersistence(AsyncStorage)
});