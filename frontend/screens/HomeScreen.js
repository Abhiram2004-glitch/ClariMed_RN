import React, { useEffect, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const AppAssets = {
  logo: 'https://placehold.co/100x100/e0f2fe/0ea5e9?text=C+',
  heroImage: 'https://placehold.co/600x400/e0f2fe/0ea5e9?text=Understanding+Your+Health',
};
const CONTACT_PHONE = '+1 (555) 123-4567';
const CONTACT_EMAIL = 'support@clarimed.app';

export default function App() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAskPress = () => {
    console.log('Navigating to the Ask screen...');
  };

  return (
    <SafeAreaProvider>
      <LinearGradient colors={['#e0f7fa', '#b2ebf2', '#80deea']} style={{ flex: 1 }}>
        {/* SafeAreaView applies device-safe padding */}
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
                alignItems: 'center',
              }}
            >
              {/* --- Header Section --- */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <Image
                  source={{ uri: AppAssets.logo }}
                  style={{ width: 48, height: 48, borderRadius: 24, marginRight: 10 }}
                />
                <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#006064' }}>ClariMed</Text>
              </View>

              {/* --- Hero Image Section --- */}
              <Image
                source={{ uri: AppAssets.heroImage }}
                style={{
                  width: '100%',
                  height: 200,
                  borderRadius: 20,
                  marginBottom: 20,
                  resizeMode: 'cover',
                  shadowColor: '#000',
                  shadowOpacity: 0.2,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 5 },
                }}
              />

              {/* --- About Us Section Card --- */}
              <LinearGradient
                colors={['#ffffff', '#e0f2f1']}
                style={{
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 20,
                  width: '100%',
                  shadowColor: '#000',
                  shadowOpacity: 0.1,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 3 },
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: '600', color: '#004d40', marginBottom: 8 }}>
                  Welcome to ClariMed
                </Text>
                <Text style={{ color: '#37474f', lineHeight: 22 }}>
                  Navigating medical reports can be overwhelming. ClariMed uses the power of AI to translate
                  complex medical jargon into simple, clear language that you can actually understand.
                  Empower yourself with knowledge about your health.
                </Text>
              </LinearGradient>

              {/* --- Call to Action (CTA) Button --- */}
              <TouchableOpacity
                onPress={handleAskPress}
                style={{
                  backgroundColor: '#00acc1',
                  paddingVertical: 14,
                  paddingHorizontal: 30,
                  borderRadius: 40,
                  marginBottom: 20,
                  shadowColor: '#00acc1',
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 4 },
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                  Simplify My Report Now
                </Text>
              </TouchableOpacity>

              {/* --- Inspirational Quote Section --- */}
              <View
                style={{
                  backgroundColor: '#b2ebf2',
                  borderLeftWidth: 4,
                  borderLeftColor: '#00acc1',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 30,
                  width: '100%',
                }}
              >
                <Text style={{ color: '#006064', fontStyle: 'italic', fontSize: 16 }}>
                  "The greatest wealth is health."
                </Text>
                <Text style={{ color: '#00838f', fontSize: 14, marginTop: 4 }}>- Virgil</Text>
              </View>

              {/* --- Contact Us Section --- */}
              <View
                style={{
                  width: '100%',
                  paddingTop: 16,
                  borderTopWidth: 1,
                  borderTopColor: '#cfd8dc',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#004d40', marginBottom: 6 }}>
                  Contact Us
                </Text>
                <Text style={{ color: '#546e7a', marginBottom: 10 }}>
                  Have questions? We're here to help.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Text
                    style={{ color: '#00acc1', fontWeight: '600', marginHorizontal: 8 }}
                    onPress={() => Linking.openURL(`tel:${CONTACT_PHONE}`)}
                  >
                    {CONTACT_PHONE}
                  </Text>
                  <Text
                    style={{ color: '#00acc1', fontWeight: '600', marginHorizontal: 8 }}
                    onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
                  >
                    {CONTACT_EMAIL}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}
