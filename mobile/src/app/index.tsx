import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function RootIndex() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return token ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/login" />;
}
