// screens/ProfileScreen.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { getAuth, signOut } from "firebase/auth";
import LoginScreen from "./Login";
import { CommonActions } from "@react-navigation/native";
export default function ProfileScreen({ navigation }) {
  const auth = getAuth();
const handleLogout = () => {
  signOut(auth)
    .then(() => {
      Alert.alert("Success", "You have been logged out.");
      // No navigation needed here 🚀
    })
    .catch((error) => {
      Alert.alert("Error", error.message);
    });
};


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Edit Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Change Password</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Privacy Policy</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Help & Support</Text>
      </TouchableOpacity>

      {/* Logout button */}
      <TouchableOpacity style={[styles.button, styles.logout]} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
  },
  button: {
    width: "100%",
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#007AFF",
    marginVertical: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
  logout: {
    backgroundColor: "red",
    marginTop: 40,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
