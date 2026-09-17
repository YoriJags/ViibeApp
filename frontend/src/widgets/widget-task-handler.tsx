import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { CityEnergyWidget, CityEnergyData } from './CityEnergyWidget';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://vibeapp-production-1835.up.railway.app';

async function fetchCityEnergy(): Promise<CityEnergyData | null> {
  try {
    const r = await fetch(`${API_URL}/api/city-energy/lagos`);
    if (!r.ok) return null;
    const p = await r.json();
    return {
      score: p.energy_score ?? 0,
      label: p.energy_label ?? 'QUIET',
      trending: p.trending_venue ? `▲ ${p.trending_venue.name}` : '',
      updated: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return null;
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await fetchCityEnergy();
      props.renderWidget(<CityEnergyWidget data={data} />);
      break;
    }
    default:
      break;
  }
}
