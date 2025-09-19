// screens/ChatScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

export default function ChatScreen({ route, navigation }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const flatListRef = useRef(null);

  // Check if user came from AnalyticsScreen with a file
  useEffect(() => {
    if (route?.params?.hasAnalyzedFile) {
      setHasUploadedFile(true);
      setCurrentFile(route.params.fileInfo || null);
      // Add welcome message for analyzed file
      const welcomeMessage = {
        id: Date.now().toString(),
        text: "Great! I can see you've already analyzed a medical report. You can now ask me questions about it. What would you like to know?",
        isBot: true,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    } else {
      // User came directly to chat - show upload prompt
      const uploadPromptMessage = {
        id: Date.now().toString(),
        text: "Hello! To start chatting about a medical report, please upload a PDF or image first using the buttons below.",
        isBot: true,
        timestamp: new Date(),
      };
      setMessages([uploadPromptMessage]);
    }
  }, [route]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const fileInfo = {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/pdf',
        };
        setCurrentFile(fileInfo);
        await uploadFileToServer(fileInfo);
      }
    } catch (err) {
      console.log('Error picking document:', err);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
      });

      if (!result.canceled) {
        const fileInfo = {
          uri: result.assets[0].uri,
          name: 'image.jpg',
          type: 'image/jpeg',
        };
        setCurrentFile(fileInfo);
        await uploadFileToServer(fileInfo);
      }
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadFileToServer = async (fileInfo) => {
    setLoading(true);
    
    // Add uploading message
    const uploadingMessage = {
      id: Date.now().toString(),
      text: `Uploading and processing ${fileInfo.name}...`,
      isBot: true,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, uploadingMessage]);

    const formData = new FormData();
    formData.append('file', {
      uri: fileInfo.uri,
      name: fileInfo.name,
      type: fileInfo.type,
    });

    try {
      const res = await axios.post('http://10.149.8.202:5001/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      console.log('Upload response:', res.data); // Debug log

      if (res.data.success) {
        setHasUploadedFile(true);
        
        // Remove uploading message and add success message
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.id !== uploadingMessage.id);
          return [...filtered, {
            id: Date.now().toString(),
            text: `✅ Successfully processed ${fileInfo.name}! Created ${res.data.chunks_count} text chunks. You can now ask me questions about this document.`,
            isBot: true,
            timestamp: new Date(),
          }];
        });
      } else {
        throw new Error(res.data.error || 'Upload failed');
      }
    } catch (err) {
      console.log('Upload error:', err);
      console.log('Upload error response:', err.response?.data); // Debug log
      
      // Remove uploading message and add error message
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== uploadingMessage.id);
        return [...filtered, {
          id: Date.now().toString(),
          text: `❌ Failed to process ${fileInfo.name}. Please try again or choose a different file.`,
          isBot: true,
          timestamp: new Date(),
        }];
      });
      
      Alert.alert('Upload Failed', 'Please try again with a different file.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    if (!hasUploadedFile) {
      Alert.alert('No File Uploaded', 'Please upload a medical report first to start chatting.');
      return;
    }

    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isBot: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const questionText = inputText.trim();
    setInputText('');
    setLoading(true);

    try {
      console.log('Sending question to backend:', questionText);
      
      // Send query to query endpoint
      const response = await axios.post('http://10.149.8.202:5001/query', {
        question: questionText,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000, // Increased timeout for Ollama processing
      });

      console.log('Backend response:', response.data);
      console.log('Response status:', response.status);

      // ✅ FIXED: Check for success in the response data
      if (response.status === 200 && response.data) {
        // Handle both success: true and success: false cases
        if (response.data.success === false) {
          // Backend returned success: false with error message
          throw new Error(response.data.error || 'Backend returned unsuccessful response');
        }
        
        // Success case - check for answer
        if (response.data.answer && response.data.answer.trim()) {
          const botMessage = {
            id: (Date.now() + 1).toString(),
            text: response.data.answer,
            isBot: true,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, botMessage]);
        } else {
          // No answer in response
          throw new Error('No answer received from the AI model');
        }
      } else {
        throw new Error('Invalid response from server');
      }

    } catch (err) {
      console.log('Chat error details:', err);
      console.log('Error response:', err.response?.data);
      console.log('Error status:', err.response?.status);
      console.log('Error message:', err.message);
      
      let errorText = 'Sorry, I encountered an error while processing your question. Please try again.';
      
      // More specific error handling
      if (err.response?.data?.error) {
        errorText = `Error: ${err.response.data.error}`;
      } else if (err.response?.data && typeof err.response.data === 'string') {
        errorText = `Server error: ${err.response.data}`;
      } else if (err.message && err.message !== 'Request failed with status code 500') {
        errorText = `Error: ${err.message}`;
      } else if (err.response?.status === 400) {
        errorText = 'Bad request - please check if you have uploaded a document first.';
      } else if (err.response?.status >= 500) {
        errorText = 'Server error - the AI service might be busy. Please try again in a moment.';
      } else if (err.code === 'ECONNREFUSED') {
        errorText = 'Cannot connect to server - please check if the backend is running.';
      } else if (err.code === 'ECONNABORTED') {
        errorText = 'Request timed out - the AI is taking too long to respond. Please try a shorter question.';
      }
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        isBot: true,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.isBot ? styles.botMessage : styles.userMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.isBot ? styles.botMessageText : styles.userMessageText
      ]}>
        {item.text}
      </Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (messages.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [messages]);

  return (
    <SafeAreaProvider>
      <LinearGradient 
        colors={['#e0f7fa', '#19bbd0ff', '#80deea', '#724de1ff']} 
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView 
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Medical Report Chat</Text>
              {currentFile && (
                <Text style={styles.headerSubtitle}>
                  📄 {currentFile.name}
                </Text>
              )}
            </View>

            {/* Upload buttons - only show if no file uploaded */}
            {!hasUploadedFile && (
              <View style={styles.uploadContainer}>
                <Text style={styles.uploadPrompt}>Upload a medical report to start:</Text>
                <View style={styles.uploadButtons}>
                  <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
                    <Text style={styles.uploadButtonText}>📄 Pick PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                    <Text style={styles.uploadButtonText}>📷 Pick Image</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            />

            {/* Loading indicator */}
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#0066cc" />
                <Text style={styles.loadingText}>Thinking...</Text>
              </View>
            )}

            {/* Input area */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder={hasUploadedFile ? "Ask a question about your medical report..." : "Upload a file first to start chatting..."}
                placeholderTextColor="#999"
                multiline
                maxLength={500}
                editable={hasUploadedFile && !loading}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!hasUploadedFile || !inputText.trim() || loading) && styles.sendButtonDisabled
                ]}
                onPress={sendMessage}
                disabled={!hasUploadedFile || !inputText.trim() || loading}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>

            {/* File change option */}
            {hasUploadedFile && (
              <View style={styles.fileChangeContainer}>
                <TouchableOpacity
                  style={styles.changeFileButton}
                  onPress={() => {
                    setHasUploadedFile(false);
                    setCurrentFile(null);
                    setMessages([{
                      id: Date.now().toString(),
                      text: "Please upload a new medical report to continue chatting.",
                      isBot: true,
                      timestamp: new Date(),
                    }]);
                  }}
                >
                  <Text style={styles.changeFileText}>📁 Change File</Text>
                </TouchableOpacity>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8cdedfff',
  },
  header: {
    backgroundColor: '#8cdedfff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  uploadContainer: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e3f2fd',
    borderStyle: 'dashed',
  },
  uploadPrompt: {
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  messagesContent: {
    paddingVertical: 10,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    padding: 12,
    borderRadius: 18,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0066cc',
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  botMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  sendButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  fileChangeContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  changeFileButton: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  changeFileText: {
    color: '#0066cc',
    fontSize: 14,
  },
});