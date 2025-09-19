// screens/ProfileScreen.js
import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Animated,
} from "react-native";
import { getAuth, signOut } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";

// function to generate a consistent pastel color for the same email
function getColorFromEmail(email) {
  const colors = ["#A8DADC", "#FFB4A2", "#B5EAD7", "#C7CEEA", "#F9C74F", "#90BEDE"];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function ProfileScreen({ navigation }) {
  const auth = getAuth();
  const user = auth.currentUser;

  const email = user?.email || "user@email.com";
  const firstLetter = email[0]?.toUpperCase();
  const profileColor = getColorFromEmail(email);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        speed: 2,
        bounciness: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        Alert.alert("Success", "You have been logged out.");
      })
      .catch((error) => {
        Alert.alert("Error", error.message);
      });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.logoText}>ClariMed</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <Ionicons name="person-circle-outline" size={40} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Profile Header with animation */}
      <Animated.View
        style={[
          styles.profileHeader,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: profileColor }]}>
          <Text style={styles.avatarLetter}>{firstLetter}</Text>
        </View>
        <Text style={styles.userEmail}>{email}</Text>
      </Animated.View>

      {/* Feature Cards */}
      <View style={styles.featuresContainer}>
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}
        >
          <FeatureCard
            icon="document-text-outline"
            label="Privacy Policy"
            onPress={() =>
              Alert.alert(
                "Privacy Policy",
                "ClariMed respects your privacy. Your uploaded medical reports are only processed to simplify medical terms. We never share your data with third parties without consent. Reports are encrypted during processing and deleted after use."
              )
            }
          />
        </Animated.View>

        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}
        >
          <FeatureCard
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() =>
              Alert.alert(
                "Help & Support",
                "FAQs:\n\n1. How do I upload a report?\nTap 'Upload' on the home screen.\n\n2. Can I save reports?\nYes, go to 'Saved Reports' in settings.\n\n3. How do I contact support?\nEmail us at support@clarimed.com."
              )
            }
          />
        </Animated.View>
      </View>

      {/* Logout Button */}
      <Animated.View
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

/* Reusable Feature Card */
const FeatureCard = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress}>
    <Ionicons name={icon} size={22} color="#fff" />
    <Text style={styles.cardText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDF6F6", // light coralish-blue background
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    backgroundColor: "#4CB8C4", // teal shade
    elevation: 5,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "#7ED6DF", // lighter teal/blue
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    elevation: 5,
  },
  avatarLetter: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#fff",
  },
  userEmail: {
    fontSize: 19, // bigger
    fontWeight: "700",
    color: "#fff",
    marginTop: 5,
  },
  featuresContainer: {
    paddingHorizontal: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CB8C4", // teal shade for buttons
    padding: 16,
    borderRadius: 16,
    marginVertical: 10,
    elevation: 4,
  },
  cardText: {
    marginLeft: 15,
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  logout: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 50,
    marginHorizontal: 20,
    backgroundColor: "#FF6B6B",
    padding: 16,
    borderRadius: 25,
    elevation: 4,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginLeft: 8,
  },
});
