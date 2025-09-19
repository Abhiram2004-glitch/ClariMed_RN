// screens/HomeScreen.js
import React, { useState } from 'react';
import {
  View,
  Button,
  Text,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
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

  const renderExplanation = (explanation, index) => (
    <View key={index} style={styles.explanationCard}>
      <Text style={styles.keywordTitle}>
        Keyword {explanation.keyword_number}: {explanation.keyword}
      </Text>
      
      {explanation.value && (
        <Text style={styles.valueText}>
          Value: {explanation.value} {explanation.unit}
        </Text>
      )}
      
      {explanation.descriptor && (
        <Text style={styles.descriptorText}>
          {explanation.descriptor}
        </Text>
      )}
      
      <Text style={styles.explanationText}>
        {explanation.explanation}
      </Text>
      
      <Text style={styles.typeLabel}>
        Type: {explanation.type === 'lab_value' ? 'Laboratory Test' : 'Radiology Finding'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Medical Report Analyzer</Text>
        
        <View style={styles.buttonContainer}>
          <Button title="Pick PDF" onPress={pickDocument} />
          <View style={styles.buttonSpacing} />
          <Button title="Pick Image" onPress={pickImage} />
          <View style={styles.buttonSpacing} />
          <Button 
            title={loading ? "Analyzing..." : "Upload & Analyze Report"} 
            onPress={uploadFile}
            disabled={loading}
          />
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066cc" />
            <Text style={styles.loadingText}>
              Processing medical report with AI...
            </Text>
          </View>
        )}

        {selectedFile && (
          <View style={styles.fileInfo}>
            <Text style={styles.sectionTitle}>Selected File:</Text>
            <Text>{selectedFile.name}</Text>
            <Text>Type: {selectedFile.type}</Text>
          </View>
        )}

        {analysisResult && (
          <View style={styles.resultsContainer}>
            <Text style={styles.sectionTitle}>Medical Analysis Results</Text>
            
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>
                Report Type: {analysisResult.report_type.toUpperCase()}
              </Text>
              <Text style={styles.summaryText}>
                Total Findings: {analysisResult.total_findings}
              </Text>
            </View>

            {analysisResult.explanations && analysisResult.explanations.length > 0 ? (
              analysisResult.explanations.map((explanation, index) => 
                renderExplanation(explanation, index)
              )
            ) : (
              <View style={styles.noFindingsCard}>
                <Text style={styles.noFindingsText}>
                  No specific medical findings detected in this report.
                </Text>
              </View>
            )}

            {/* Debug section - can be removed in production */}
            {analysisResult.raw_text && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Raw Extracted Text (Debug):</Text>
                <ScrollView style={styles.debugTextContainer} nestedScrollEnabled>
                  <Text style={styles.debugText}>
                    {analysisResult.raw_text.substring(0, 500)}...
                  </Text>
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonSpacing: {
    height: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    marginVertical: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#1976d2',
  },
  fileInfo: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    width: '100%',
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 10,
    color: '#333',
  },
  resultsContainer: {
    marginTop: 20,
    width: '100%',
  },
  summaryCard: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 5,
  },
  explanationCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  keywordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 8,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d32f2f',
    marginBottom: 5,
  },
  descriptorText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
    marginBottom: 10,
  },
  typeLabel: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  noFindingsCard: {
    backgroundColor: '#fff3e0',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  noFindingsText: {
    fontSize: 16,
    color: '#ef6c00',
    textAlign: 'center',
  },
  debugContainer: {
    marginTop: 20,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
  },
  debugTextContainer: {
    maxHeight: 150,
    backgroundColor: '#eeeeee',
    padding: 10,
    borderRadius: 5,
  },
  debugText: {
    fontSize: 12,
    color: '#555',
  },
});