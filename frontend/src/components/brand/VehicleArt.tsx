import { useId } from 'react';
import { Platform } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

/** Shared vector artwork stays crisp on native screens and the web. */
export function VehicleArt({
  width = 120,
  premium = false,
}: {
  width?: number;
  premium?: boolean;
}) {
  const gradientId = 'vehicle' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg
      width={width}
      height={width * 0.56}
      viewBox="0 0 200 112"
      {...(Platform.OS === 'web'
        ? { 'aria-hidden': true }
        : { accessible: false })}
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={premium ? '#646970' : '#FFFFFF'} />
          <Stop offset="1" stopColor={premium ? '#191C20' : '#B8BEC4'} />
        </LinearGradient>
      </Defs>
      <Rect
        x="12"
        y="88"
        width="180"
        height="8"
        rx="8"
        fill="#000"
        opacity={0.08}
      />
      <Path
        d="M17 65L36 57L60 30Q65 25 77 25H128Q140 25 151 40L165 57L181 62Q190 65 190 76V84H13V74Q13 68 17 65Z"
        fill={`url(#${gradientId})`}
        stroke="#90969B"
        strokeWidth="1.5"
      />
      <Path
        d="M47 55L65 33H91V55ZM97 33H126Q134 33 142 44L150 55H97Z"
        fill="#27353E"
      />
      <Path d="M67 34H86L57 53H50Z" fill="#91A7B3" opacity={0.6} />
      <Path
        d="M95 59V80M153 59L159 80M19 70H184"
        stroke="#92989D"
        strokeWidth="1"
        fill="none"
      />
      <Rect x="104" y="61" width="12" height="3" rx="1.5" fill="#737A81" />
      <Path d="M15 65H31L27 72H14M172 64L187 68V73H174Z" fill="#F9F5D9" />
      <Circle cx="49" cy="83" r="16" fill="#202124" />
      <Circle cx="49" cy="83" r="9" fill="#9CA3AA" />
      <Circle cx="49" cy="83" r="4" fill="#E5E7E9" />
      <Circle cx="155" cy="83" r="16" fill="#202124" />
      <Circle cx="155" cy="83" r="9" fill="#9CA3AA" />
      <Circle cx="155" cy="83" r="4" fill="#E5E7E9" />
    </Svg>
  );
}
