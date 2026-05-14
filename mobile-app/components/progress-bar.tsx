/**
 * components/progress-bar.tsx
 * ------------------------------------------------------------------
 * Minimal horizontal progress bar.  Accepts a 0-100 percent and an
 * optional accent color so the goal screens (and any later progress
 * widget) can share one styled implementation.
 */

import { StyleSheet, View } from 'react-native';

interface Props {
  percent: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ percent, color = '#0a7ea4', height = 8 }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clamped}%`,
            backgroundColor: color,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: '#e8e8e8',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
