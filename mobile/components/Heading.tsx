import type { ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';
import { colors, typography } from '../constants/theme';

type Props = {
  children: ReactNode;
  level?: 'display' | 'h1' | 'h2' | 'h3';
  align?: TextStyle['textAlign'];
  color?: string;
};

export function Heading({ children, level = 'h1', align = 'left', color = colors.ink }: Props) {
  return (
    <Text style={[typography[level], { textAlign: align, color }]} accessibilityRole="header">
      {children}
    </Text>
  );
}
