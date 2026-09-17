import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export interface CityEnergyData {
  score: number;
  label: string;
  trending: string;
  updated: string;
}

/**
 * Home-screen City Energy widget — the VIIBE instrument on the phone's wall.
 * Thermal skin: coal background, ember->amber heat, mono data labels.
 */
export function CityEnergyWidget({ data }: { data: CityEnergyData | null }) {
  const score = data ? Math.round(data.score) : null;
  const heat = score == null ? '#A89B8C' : score >= 80 ? '#FFF3D6' : score >= 55 ? '#FFB300' : score >= 30 ? '#E85D00' : '#7A2E00';
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#0B0908',
        borderRadius: 18,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
      }}
    >
      <TextWidget
        text="VIIBE · LAGOS"
        style={{ fontSize: 10, color: '#A89B8C', letterSpacing: 0.3 }}
      />
      <TextWidget
        text={score == null ? '—' : String(score)}
        style={{ fontSize: 40, fontWeight: 'bold', color: heat, marginTop: 4 }}
      />
      <TextWidget
        text={data?.label ?? 'READING…'}
        style={{ fontSize: 12, color: heat, letterSpacing: 0.2, marginTop: 2 }}
      />
      {data?.trending ? (
        <TextWidget
          text={data.trending}
          style={{ fontSize: 10, color: '#F4EFE6', marginTop: 6 }}
        />
      ) : null}
      <TextWidget
        text={data?.updated ?? ''}
        style={{ fontSize: 8, color: '#55493C', marginTop: 4 }}
      />
    </FlexWidget>
  );
}
