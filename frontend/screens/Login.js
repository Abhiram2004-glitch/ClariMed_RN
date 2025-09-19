// screens/Login.js
import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../FirebaseConfig'; // Adjust path based on your structure

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      let errorMessage = 'An error occurred';
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later';
          break;
        default:
          errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToSignup = () => {
    navigation.navigate('Signup');
  };

  return (
    <View style={styles.container}>
      {/* Background Video */}
      <Video
        style={styles.backgroundVideo}
        source={require('../assets/video.mp4')}
        shouldPlay
        isLooping
        isMuted
        resizeMode={ResizeMode.COVER}
        onError={(error) => console.log('Video Error:', error)}
      />
      
      {/* Overlay for better text readability */}
      <View style={styles.overlay} />

      <KeyboardAvoidingView 
        style={styles.contentContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            <Text style={styles.title}>Welcome Back</Text>
            
            <Text style={styles.subtitle}>Sign in to your account</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#9E9E9E"
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholderTextColor="#9E9E9E"
              />
            </View>

            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity 
              style={styles.switchButton} 
              onPress={navigateToSignup}
            >
              <Text style={styles.switchText}>
                Don't have an account? Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Dark overlay for better text readability
  },
  contentContainer: {
    flex: 1,
    zIndex: 1, // Ensure content appears above video
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF', // Changed to white for better contrast
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    color: '#E0E0E0', // Light gray for subtitle
    marginBottom: 40,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Semi-transparent white
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(232, 234, 246, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  button: {
    width: '100%',
    backgroundColor: 'rgba(92, 107, 192, 0.9)', // Semi-transparent button
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5C6BC0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  separator: {
    marginVertical: 30,
    height: 2,
    width: '80%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  switchButton: {
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  switchText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});