import { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing, Dimensions, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { useAuth } from '@/context/auth-context';

// Prevent auto-hide of splash screen
SplashScreen.preventAutoHideAsync();

const { width, height } = Dimensions.get('window');

// Splash background image from Figma
const splashBackground = require('@/assets/images/7c85cc1afde3d03560e9b1577e20b236570c41cb.png');

export default function SplashScreenComponent() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      // Hide native splash screen
      SplashScreen.hideAsync();
      
      // Navigate based on auth state
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/login');
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.imageContainer, { opacity: fadeAnim }]}>
        <ImageBackground
          source={splashBackground}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
