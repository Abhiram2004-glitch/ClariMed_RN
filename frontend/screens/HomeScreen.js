import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  Linking,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const AppAssets = {
  logo: 'https://placehold.co/120x120/00acc1/ffffff?text=C+',
  heroImage: 'https://placehold.co/600x400/e0f2fe/0ea5e9?text=Understanding+Your+Health',
  carouselImages: [
    'https://placehold.co/400x300/bbdefb/0d47a1?text=Medical+Reports',
    'https://placehold.co/400x300/e8f5e9/2e7d32?text=Health+Insights',
    'https://placehold.co/400x300/ffecb3/ff6f00?text=Easy+Understanding',
    'https://placehold.co/400x300/e0f2f1/00695c?text=AI+Powered',
  ]
};

const CONTACT_PHONE = '9446114441';
const CONTACT_EMAIL = 'support@clarimed.app';

const TypewriterText = ({
  texts,
  delay = 50,
  onComplete,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  // Cursor blinking effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    const currentText = texts[currentTextIndex];
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing forward
        if (currentIndex < currentText.length) {
          setDisplayedText(currentText.substring(0, currentIndex + 1));
          setCurrentIndex(prev => prev + 1);
        } else {
          // Pause before deleting
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        // Deleting backward
        if (currentIndex > 0) {
          setDisplayedText(currentText.substring(0, currentIndex - 1));
          setCurrentIndex(prev => prev - 1);
        } else {
          // Move to next text
          setIsDeleting(false);
          setCurrentTextIndex(prev => (prev + 1) % texts.length);
          if (onComplete && currentTextIndex === 0) {
            onComplete();
          }
        }
      }
    }, isDeleting ? delay / 3 : delay);

    return () => clearTimeout(timeout);
  }, [currentIndex, currentTextIndex, isDeleting, texts, delay, onComplete]);

  return (
    <Text style={styles.typewriterText}>
      {displayedText}
      <Text style={{ 
        opacity: showCursor ? 1 : 0, 
        color: '#00acc1',
        fontSize: 20,
        fontWeight: 'bold'
      }}>|</Text>
    </Text>
  );
};

const ImageCarousel = ({ images }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % images.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [images.length]);
  
  useEffect(() => {
    Animated.timing(scrollX, {
      toValue: currentIndex * width,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [currentIndex, scrollX]);
  
  return (
    <View style={styles.carouselContainer}>
      <Animated.View 
        style={[
          styles.carousel,
          {
            transform: [{ translateX: Animated.multiply(scrollX, -1) }],
          }
        ]}
      >
        {images.map((image, index) => (
          <Image
            key={index}
            source={{ uri: image }}
            style={styles.carouselImage}
          />
        ))}
      </Animated.View>
      <View style={styles.carouselIndicators}>
        {images.map((_, i) => (
          <View
            key={i}
            style={[
              styles.carouselIndicator,
              i === currentIndex && styles.carouselIndicatorActive
            ]}
          />
        ))}
      </View>
    </View>
  );
};

export default function App() {
  // Add the navigation hook here
  const navigation = useNavigation();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const logoRotateAnim = useRef(new Animated.Value(0)).current;
  const buttonBounceAnim = useRef(new Animated.Value(1)).current;
  const buttonBounceAnim2 = useRef(new Animated.Value(1)).current;
  
  const [showTypewriter, setShowTypewriter] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Initial animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 800,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowTypewriter(true);
    });

    // Logo rotation animation
    Animated.loop(
      Animated.timing(logoRotateAnim, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
      })
    ).start();

    // Button bounce animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(buttonBounceAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(buttonBounceAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Second button bounce animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(buttonBounceAnim2, {
          toValue: 1.05,
          duration: 1000,
          delay: 500,
          useNativeDriver: true,
        }),
        Animated.timing(buttonBounceAnim2, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, scaleAnim, slideUpAnim, logoRotateAnim, buttonBounceAnim, buttonBounceAnim2]);

  const handleAskPress = () => {
    console.log('Navigating to the Ask screen...');
  };

  const handleMedicinesNearMe = () => {
    console.log('Finding medicines near me...');
    // This would typically open a map or list of pharmacies
  };

  const spin = logoRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaProvider>
      <LinearGradient 
        colors={['#e0f7fa', '#b2ebf2', '#80deea', '#4dd0e1']} 
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [
                  { scale: scaleAnim },
                  { translateY: slideUpAnim }
                ],
                alignItems: 'center',
              }}
            >
              {/* Enhanced Header Section */}
              <View style={styles.header}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <LinearGradient
                    colors={['#00acc1', '#0097a7', '#00838f']}
                    style={styles.logoGradient}
                  >
                    <Text style={styles.logoText}>C+</Text>
                  </LinearGradient>
                </Animated.View>
                <Text style={styles.headerText}>ClariMed</Text>
              </View>

              {/* Typewriter Text Section */}
              <View style={styles.typewriterContainer}>
                {showTypewriter && (
                  <TypewriterText
                    texts={[
                      "Transform complex medical reports into clear insights",
                      "AI-powered medical report simplification",
                      "Understand your health with confidence",
                      "Medical jargon made simple and clear",
                      "Empowering patients with knowledge",
                      "Your health, simplified and explained",
                      "Making medical reports human-readable"
                    ]}
                    delay={40}
                    onComplete={() => setShowContent(true)}
                  />
                )}
              </View>

              {/* Enhanced About Us Section with Carousel Background */}
              {showContent && (
                <View style={styles.welcomeSection}>
                  <View style={styles.carouselBackground}>
                    <ImageCarousel images={AppAssets.carouselImages} />
                  </View>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                    style={styles.welcomeContent}
                  >
                    <View style={{ alignItems: 'center', marginBottom: 15 }}>
                      <LinearGradient
                        colors={['#00acc1', '#0097a7']}
                        style={styles.welcomeTitle}
                      >
                        <Text style={styles.welcomeTitleText}>Welcome to ClariMed</Text>
                      </LinearGradient>
                    </View>
                    <Text style={styles.welcomeDescription}>
                      Navigating medical reports can be overwhelming. ClariMed uses the power of AI to translate
                      complex medical jargon into simple, clear language that you can actually understand.
                      Empower yourself with knowledge about your health.
                    </Text>
                  </LinearGradient>
                </View>
              )}

              {/* Enhanced CTA Buttons */}
              {showContent && (
                <View style={styles.buttonsContainer}>
                  <Animated.View style={{ 
                    transform: [{ scale: buttonBounceAnim }],
                    width: '100%',
                    marginBottom: 15,
                  }}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Ask')}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#00acc1', '#0097a7', '#00838f']}
                        style={styles.primaryButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text style={styles.primaryButtonText}>
                          🚀 Simplify My Report Now
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              )}

              {/* Enhanced Quote Section */}
              {showContent && (
                <LinearGradient
                  colors={['rgba(178, 235, 242, 0.8)', 'rgba(178, 235, 242, 0.6)']}
                  style={styles.quoteSection}
                >
                  <Text style={styles.quoteText}>
                    "The greatest wealth is health."
                  </Text>
                  <Text style={styles.quoteAuthor}>- Virgil</Text>
                </LinearGradient>
              )}

              {/* Enhanced Contact Section */}
              {showContent && (
                <LinearGradient
                  colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.6)']}
                  style={styles.contactSection}
                >
                  <LinearGradient
                    colors={['#00acc1', '#0097a7']}
                    style={styles.contactTitle}
                  >
                    <Text style={styles.contactTitleText}>💬 Contact Us</Text>
                  </LinearGradient>
                  <Text style={styles.contactDescription}>
                    Have questions? We're here to help.
                  </Text>
                  <View style={styles.contactButtons}>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${CONTACT_PHONE}`)}
                      style={styles.contactButton}
                    >
                      <Text style={styles.contactButtonText}>📞 {CONTACT_PHONE}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
                      style={styles.contactButton}
                    >
                      <Text style={styles.contactButtonText}>✉️ {CONTACT_EMAIL}</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              )}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  logoGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#00acc1',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  logoText: {
    fontSize: 24, 
    fontWeight: 'bold', 
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerText: {
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#006064',
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  typewriterContainer: {
    marginBottom: 20, 
    minHeight: 60,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 15,
    padding: 15,
    width: '100%',
  },
  typewriterText: {
    fontSize: 18, 
    color: '#004d40', 
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
    marginHorizontal: 10,
    minHeight: 48,
  },
  welcomeSection: {
    width: '100%', 
    marginBottom: 20,
    position: 'relative',
    height: 280,
  },
  carouselBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    opacity: 0.7,
  },
  welcomeContent: {
    borderRadius: 20,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 2,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  welcomeTitle: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  welcomeTitleText: {
    fontSize: 18, 
    fontWeight: '700', 
    color: 'white',
    textAlign: 'center',
  },
  welcomeDescription: {
    color: '#37474f', 
    lineHeight: 22,
    textAlign: 'center',
    fontSize: 15,
  },
  buttonsContainer: {
    width: '100%', 
    alignItems: 'center', 
    marginBottom: 20,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 50,
    shadowColor: '#00acc1',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  primaryButtonText: {
    color: 'white', 
    fontSize: 18, 
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  secondaryButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 2,
    borderColor: '#00acc1',
  },
  secondaryButtonText: {
    color: '#00acc1', 
    fontSize: 18, 
    fontWeight: 'bold',
    textAlign: 'center',
  },
  quoteSection: {
    borderLeftWidth: 5,
    borderLeftColor: '#00acc1',
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  quoteText: {
    color: '#006064', 
    fontStyle: 'italic', 
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  quoteAuthor: {
    color: '#00838f', 
    fontSize: 14, 
    textAlign: 'right',
    fontWeight: '600',
  },
  contactSection: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  contactTitle: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 15,
    marginBottom: 10,
  },
  contactTitleText: {
    fontSize: 16, 
    fontWeight: '700', 
    color: 'white',
  },
  contactDescription: {
    color: '#546e7a', 
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 15,
  },
  contactButtons: {
    flexDirection: 'column', 
    alignItems: 'center',
    gap: 10,
  },
  contactButton: {
    backgroundColor: 'rgba(0, 172, 193, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00acc1',
  },
  contactButtonText: {
    color: '#00acc1', 
    fontWeight: '600',
    fontSize: 16,
  },
  carouselContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 15,
  },
  carousel: {
    flexDirection: 'row',
    width: width * 4, // 4 images
  },
  carouselImage: {
    width: width - 40,
    height: '100%',
    resizeMode: 'cover',
  },
  carouselIndicators: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignSelf: 'center',
  },
  carouselIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    margin: 4,
  },
  carouselIndicatorActive: {
    backgroundColor: '#00acc1',
    width: 12,
  },
});