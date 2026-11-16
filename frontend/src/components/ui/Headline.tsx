import { Text as NativeText, type TextStyle } from 'react-native';
import { colors, fonts, type } from '../../theme/tokens';

/**
 * Large headline in the Figma style: medium weight with chosen words in
 * bold italic ("Request *Your* Ride in *Seconds*"). Mark emphasis with
 * asterisks in `text`. Screen readers get the plain sentence.
 */
export function Headline({
  text,
  size = 'display',
  style,
}: {
  text: string;
  size?: 'display' | 'title';
  style?: TextStyle;
}) {
  const parts = text.split('*');
  const base = size === 'display' ? type.display : type.title;
  return (
    <NativeText
      accessibilityRole="header"
      accessibilityLabel={parts.join('')}
      style={[base, { color: colors.text, flexShrink: 1 }, style]}
    >
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <NativeText key={index} style={{ fontFamily: fonts.boldItalic }}>
            {part}
          </NativeText>
        ) : (
          part
        ),
      )}
    </NativeText>
  );
}
