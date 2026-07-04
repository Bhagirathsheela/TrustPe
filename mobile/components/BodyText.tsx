import type { ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';
import { colors, typography } from '../constants/theme';

type Props = {
  children: ReactNode;
  variant?: 'body' | 'bodyMuted' | 'caption';
  align?: TextStyle['textAlign'];
  color?: string;
  style?: TextStyle;
};

export function BodyText({
  children,
  variant = 'body',
  align = 'left',
  color,
  style,
}: Props) {
  const palette = color ?? (variant === 'bodyMuted' ? colors.inkMuted : colors.ink);
  return (
    <Text style={[typography[variant], { textAlign: align, color: palette }, style]}>
      {children}
    </Text>
  );
}
