import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { MapCanvasProps } from '../features/map/MapCanvas.types';
import { Text } from '../components/ui/Text';

/** Illustrative local map, deliberately independent of mapping services. */
export function DemoMap({ pins, route, onSelect }: MapCanvasProps) {
  const [layout, setLayout] = useState({ width: 400, height: 700 });
  const project = ([lng, lat]: [number, number]) => [
    ((lng + 16.76) / 0.22) * 400,
    ((13.49 - lat) / 0.19) * 650,
  ];
  const points = (route ?? []).map(project);
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setLayout(event.nativeEvent.layout)}
    >
      <Pressable
        style={{ flex: 1 }}
        disabled={!onSelect}
        accessibilityRole={onSelect ? 'button' : undefined}
        accessibilityLabel={
          onSelect ? 'Select a demo map location' : 'Illustrative demo map'
        }
        onPress={(event) =>
          onSelect?.([
            -16.76 + (event.nativeEvent.locationX / layout.width) * 0.22,
            13.49 - (event.nativeEvent.locationY / layout.height) * 0.19,
          ])
        }
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 400 650"
          preserveAspectRatio="none"
        >
          <Rect width="400" height="650" fill="#EAEDE8" />
          <Path
            d="M0 0H48L36 90L53 180L29 275L48 370L25 470L0 540Z"
            fill="#C8DFE7"
          />
          <Path
            d="M60 95H138V175H60ZM260 215H360V295H260ZM80 395H165V485H80Z"
            fill="#D5E2CD"
          />
          {[85, 150, 220, 295, 370, 450, 535, 610].map((y) => (
            <Path
              key={y}
              d={`M45 ${y}L400 ${y - 30}`}
              stroke="#FFF"
              strokeWidth="9"
            />
          ))}
          {[85, 155, 225, 300, 370].map((x) => (
            <Path
              key={x}
              d={`M${x} 0L${x - 30} 650`}
              stroke="#FFF"
              strokeWidth="8"
            />
          ))}
          <Path
            d="M50 210L180 170L265 200L400 120M180 170L195 400L260 650"
            fill="none"
            stroke="#D2D4D0"
            strokeWidth="17"
          />
          <Path
            d="M50 210L180 170L265 200L400 120M180 170L195 400L260 650"
            fill="none"
            stroke="#FFF"
            strokeWidth="12"
          />
          <SvgText x="70" y="62" fill="#6B756D" fontSize="14">
            KOLOLI
          </SvgText>
          <SvgText x="225" y="96" fill="#6B756D" fontSize="14">
            SERREKUNDA
          </SvgText>
          <SvgText x="78" y="310" fill="#879387" fontSize="12">
            THE GAMBIA
          </SvgText>
          {points.length > 1 && (
            <Path
              d={points
                .map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`)
                .join(' ')}
              fill="none"
              stroke="#111"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {pins.map((pin) => {
            const [x, y] = project(pin.point);
            return (
              <Circle
                key={pin.id}
                cx={x}
                cy={y}
                r={pin.id === 'driver' ? 10 : 7}
                fill={pin.id === 'driver' ? '#276752' : '#000'}
                stroke="#FFF"
                strokeWidth="3"
              />
            );
          })}
        </Svg>
      </Pressable>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 14,
          top: 24,
          padding: 8,
          borderRadius: 8,
          backgroundColor: '#FFFFFF',
        }}
      >
        <Text variant="caption">Illustrative demo map</Text>
      </View>
    </View>
  );
}
