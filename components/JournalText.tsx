import { StyleSheet, type TextProps } from 'react-native';
import { Typography } from 'heroui-native';
import { useReadingScale } from '@/lib/readingPreferences';
const sizes: Record<string, number> = {
  'text-xs': 12,
  'text-sm': 14,
  'text-base': 16,
  'text-lg': 18,
  'text-xl': 20,
  'text-2xl': 24,
  'text-3xl': 30,
  'text-4xl': 36,
};
export function Text({ className, style, ...props }: TextProps & { className?: string }) {
  const scale = useReadingScale();
  const flat = StyleSheet.flatten(style);
  const sizeClass = className?.split(/\s+/).find((name) => name in sizes);
  const fontSize = Math.max(11, (flat?.fontSize ?? (sizeClass ? sizes[sizeClass] : 14)) * scale);
  return (
    <Typography
      {...props}
      className={`${className ?? ''} web:wrap-anywhere`}
      style={[style, { fontSize, lineHeight: fontSize * 1.45, flexShrink: 1 }]}
    />
  );
}
