import type { ViewStyle } from 'react-native';

export const colors = {
  primary: '#0D1B3E',
  primaryLight: '#1B2D5C',
  primarySoft: '#E8EBF3',
  accent: '#FFB300',
  accentDark: '#E09600',
  accentSoft: '#FFF3D6',
  bg: '#F4F6FB',
  card: '#FFFFFF',
  text: '#13182B',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  border: '#E8EBF1',
  borderStrong: '#D5DAE3',
  white: '#FFFFFF',
  overlay: 'rgba(13,27,62,0.55)',
  risk: {
    low: '#1FA060',
    medium: '#E8A317',
    high: '#F2741B',
    critical: '#E03131',
  },
  status: {
    pending: '#8A6D1F',
    active: '#1D4ED8',
    completed: '#15803D',
    expired: '#B91C1C',
  },
} as const;

// gradient pairs [start, end]
export const gradients = {
  navy: ['#142552', '#0B1631'] as const,
  amber: ['#FFC53D', '#FF9F1C'] as const,
  header: ['#15275A', '#0C1A3D'] as const,
};

export const riskGradient: Record<string, readonly [string, string]> = {
  low: ['#26B26B', '#149957'],
  medium: ['#F2B441', '#E59817'],
  high: ['#FB8C3C', '#EF6817'],
  critical: ['#F2545B', '#D62828'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  full: 9999,
} as const;

export const type = {
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  micro: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.6 },
} as const;

export const shadow: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: {
    boxShadow: '0 1px 4px rgba(16,24,48,0.06)',
    elevation: 2,
  },
  md: {
    boxShadow: '0 4px 14px rgba(16,24,48,0.10)',
    elevation: 5,
  },
  lg: {
    boxShadow: '0 10px 28px rgba(16,24,48,0.16)',
    elevation: 10,
  },
};

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AssignmentStatus = 'pending' | 'active' | 'completed' | 'expired';

export function riskColor(level: RiskLevel | string): string {
  return (colors.risk as Record<string, string>)[level] ?? colors.risk.low;
}

export function statusColor(status: AssignmentStatus | string): string {
  return (colors.status as Record<string, string>)[status] ?? colors.textMuted;
}

// Ionicons name per risk / status
export const riskIcon: Record<string, string> = {
  low: 'shield-checkmark',
  medium: 'alert-circle',
  high: 'warning',
  critical: 'flame',
};

export const statusIcon: Record<string, string> = {
  pending: 'time',
  active: 'navigate-circle',
  completed: 'checkmark-done-circle',
  expired: 'close-circle',
};
