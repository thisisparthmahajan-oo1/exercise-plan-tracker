import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

function pickFontFamily(weight: TextStyle['fontWeight']): string {
  switch (String(weight ?? '500')) {
    case '100':
    case '200':
    case '300':
    case '400':
    case 'normal':
      return fonts.regular;
    case '500':
      return fonts.medium;
    case '600':
      return fonts.semibold;
    case '700':
    case 'bold':
      return fonts.bold;
    case '800':
    case '900':
      return fonts.extrabold;
    default:
      return fonts.medium;
  }
}

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  const typeStyle =
    type === 'title'
      ? styles.title
      : type === 'defaultSemiBold'
        ? styles.defaultSemiBold
        : type === 'subtitle'
          ? styles.subtitle
          : type === 'link'
            ? styles.link
            : styles.default;

  const merged = StyleSheet.flatten([typeStyle, style]) as TextStyle;
  const fontFamily =
    typeof (merged as TextStyle).fontFamily === 'string'
      ? (merged as TextStyle).fontFamily
      : pickFontFamily((merged as TextStyle).fontWeight);

  return (
    <Text
      {...rest}
      style={[
        { color, fontFamily },
        typeStyle,
        style,
        { fontWeight: undefined, fontFamily },
      ]}
    />
  );
}

// Important: do NOT set `lineHeight` on the `default` styles. When callers
// override fontSize via a custom style, RN keeps the default lineHeight unless
// the caller also sets one — which clips ascenders on every large heading.
// Let the font's intrinsic line-height take over for plain text, and require
// large text styles to set their own lineHeight explicitly.
const styles = StyleSheet.create({
  default: {
    fontSize: 16,
  },
  defaultSemiBold: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  link: {
    fontSize: 16,
    fontWeight: '500',
  },
});
