// screens/AnalyticsScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

export default function HomeScreen() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      console.log('Document picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/pdf',
        });
        console.log('File selected:', file.name);
      } else {
        console.log('Document selection was canceled or failed');
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
        setSelectedFile({
          uri: result.assets[0].uri,
          name: 'image.jpg',
          type: 'image/jpeg',
        });
      }
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'No file selected. Please pick a file first.');
      return;
    }

    console.log('Uploading file:', selectedFile);
    setLoading(true);
    setAnalysisResult(null); // Clear previous results

    const formData = new FormData();
    formData.append('file', {
      uri: selectedFile.uri,
      name: selectedFile.name,
      type: selectedFile.type,
    });

    try {
      const res = await axios.post('http://10.149.8.202:5000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // Increased timeout for AI processing
      });

      console.log('Backend response:', res.data);

      if (res.data.success) {
        setAnalysisResult(res.data);
        Alert.alert('Success', `Analysis complete! Found ${res.data.total_findings} medical findings.`);
      } else {
        Alert.alert('Error', res.data.error || 'Analysis failed');
      }
    } catch (err) {
      console.log('Upload error:', err);
      if (err.response) {
        const errorMsg = err.response.data?.error || `Server error: ${err.response.status}`;
        Alert.alert('Upload failed', errorMsg);
      } else if (err.request) {
        Alert.alert('Upload failed', 'Network error - check your connection');
      } else {
        Alert.alert('Upload failed', 'An error occurred during upload');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderWaveAnimation = () => {
    const waves = Array.from({ length: 5 }, (_, i) => (
      <View
        key={i}
        style={[
          styles.wave,
          { animationDelay: `${i * 0.1}s` }
        ]}
      />
    ));
    return <View style={styles.waveContainer}>{waves}</View>;
  };

  const getKeywordBadgeColor = (type) => {
    return type === 'lab_value' ? '#e91e63' : '#2196f3';
  };

  const renderExplanation = (explanation, index) => (
    <View key={index} style={styles.explanationCard}>
      <View style={styles.cardHeader}>
        <View style={[styles.keywordBadge, { backgroundColor: getKeywordBadgeColor(explanation.type) }]}>
          <Text style={styles.keywordBadgeText}>#{explanation.keyword_number}</Text>
        </View>
        <Text style={styles.keywordTitle}>{explanation.keyword}</Text>
      </View>
      
      {explanation.value && (
        <View style={styles.valueContainer}>
          <Ionicons name="analytics-outline" size={20} color="#d32f2f" />
          <Text style={styles.valueText}>
            {explanation.value} {explanation.unit}
          </Text>
        </View>
      )}
      
      {explanation.descriptor && (
        <View style={styles.descriptorContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#666" />
          <Text style={styles.descriptorText}>{explanation.descriptor}</Text>
        </View>
      )}
      
      <View style={styles.explanationContainer}>
        <Ionicons name="bulb-outline" size={20} color="#ff9800" />
        <Text style={styles.explanationText}>{explanation.explanation}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#69b7d5ff" />
      
      {/* Header */}
      <LinearGradient
        colors={['#69b7d5ff', '#5d93caff']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.title}>Medical Report </Text>
          <Text style={styles.subtitle}>AI-powered medical document analysis</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Upload Section */}
        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Upload Medical Report</Text>
          <Text style={styles.sectionSubtitle}>
            Select a PDF document or image of your medical report for AI analysis
          </Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: '#e91e63' }]} onPress={pickDocument}>
              <Ionicons name="document-outline" size={20} color="white" />
              <Text style={styles.buttonText}>Pick PDF</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: '#2196f3' }]} onPress={pickImage}>
              <Ionicons name="image-outline" size={20} color="white" />
              <Text style={styles.buttonText}>Pick Image</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Selected File Info */}
        {selectedFile && (
          <View style={styles.selectedFileContainer}>
            <View style={styles.fileInfoCard}>
              <View style={styles.fileInfoHeader}>
                <Ionicons 
                  name={selectedFile.type.includes('image') ? 'image' : 'document-text'} 
                  size={24} 
                  color="#5d93caff" 
                />
                <Text style={styles.fileName}>{selectedFile.name}</Text>
              </View>
              <Text style={styles.fileType}>Type: {selectedFile.type}</Text>
              
              <LinearGradient
                colors={['#4caf50', '#45a049']}
                style={styles.analyzeButton}
              >
                <TouchableOpacity 
                  style={styles.analyzeButton}
                  onPress={uploadFile}
                  disabled={loading}
                >
                  <Ionicons name="analytics-outline" size={20} color="white" />
                  <Text style={styles.analyzeButtonText}>
                    {loading ? "Analyzing..." : "Analyze Report"}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* Loading Animation */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5d93caff" />
            <Text style={styles.loadingText}>Processing medical report with AI...</Text>
            <Text style={styles.loadingSubtext}>This may take a few moments</Text>
            {renderWaveAnimation()}
          </View>
        )}

        {/* Analysis Results */}
        {analysisResult && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Medical Analysis Results</Text>
            
            {/* Summary Card */}
            <LinearGradient
              colors={['#4caf50', '#45a049']}
              style={styles.summaryCard}
            >
              <View style={styles.summaryGradient}>
                <View style={styles.summaryContent}>
                  <Ionicons name="checkmark-circle-outline" size={40} color="white" style={styles.summaryIcon} />
                  <View style={styles.summaryTexts}>
                    <Text style={styles.summaryType}>
                      {analysisResult.report_type.toUpperCase()} REPORT
                    </Text>
                    <Text style={styles.summaryFindings}>
                      {analysisResult.total_findings} Medical Findings
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* Findings */}
            {analysisResult.explanations && analysisResult.explanations.length > 0 ? (
              <View style={styles.explanationsContainer}>
                <Text style={styles.findingsTitle}>Detailed Analysis</Text>
                {analysisResult.explanations.map((explanation, index) => 
                  renderExplanation(explanation, index)
                )}
              </View>
            ) : (
              <View style={styles.noFindingsCard}>
                <Ionicons name="happy-outline" size={40} color="#4caf50" />
                <Text style={styles.noFindingsText}>
                  No specific medical findings detected
                </Text>
                <Text style={styles.noFindingsSubtext}>
                  Your report appears to show normal results
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#69b7d5ff',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    height: 160,
  },
  headerContent: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    color: 'white',
    marginBottom: 5,
    textShadowColor: 'rgba(157, 121, 121, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    marginTop: 160,
    paddingBottom: 40,
  },
  scrollContent: {
    flexGrow: 1,
  },
  uploadSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    width: '48%',
    overflow: 'hidden',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  selectedFileContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  fileInfoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  fileInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  fileType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    overflow: 'hidden',
  },
  analyzeButtonText: {
    color: 'white',
    fontWeight: '700',
    marginLeft: 10,
    fontSize: 16,
  },
  loadingContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    margin: 20,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5d93caff',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  waveContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    height: 40,
  },
  wave: {
    width: 4,
    height: 20,
    backgroundColor: '#5d93caff',
    borderRadius: 2,
    marginHorizontal: 2,
  },
  resultsContainer: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  summaryCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  summaryGradient: {
    padding: 20,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    marginRight: 15,
  },
  summaryTexts: {
    flex: 1,
  },
  summaryType: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  summaryFindings: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  },
  findingsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  explanationsContainer: {
    marginBottom: 20,
  },
  explanationCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  keywordBadge: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 10,
  },
  keywordBadgeText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  keywordTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#436fa2ff',
    flex: 1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff5f5',
    padding: 10,
    borderRadius: 8,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d32f2f',
    marginLeft: 8,
  },
  descriptorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  descriptorText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginLeft: 8,
  },
  explanationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff9e6',
    padding: 15,
    borderRadius: 8,
  },
  explanationText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  noFindingsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  noFindingsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4caf50',
    marginTop: 15,
    textAlign: 'center',
  },
  noFindingsSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
});