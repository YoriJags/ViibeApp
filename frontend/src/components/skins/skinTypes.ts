import { SharedValue } from 'react-native-reanimated';

export type SkinId =
  | 'reactor'
  | 'wave'
  | 'bars'
  | 'pulse'
  | 'aura'
  | 'terrain'
  | 'radar'
  | 'matrix';

export interface SkinMeta {
  id:            SkinId;
  name:          string;
  icon:          string;
  desc:          string;
  isPremium:     boolean;
  usagePercent:  number;   // social proof — % of scouts using this skin
  accentColor:   string;   // preview accent
}

export const SKINS: SkinMeta[] = [
  { id: 'reactor', name: 'REACTOR',  icon: '⚡', desc: 'Tap to charge. The OG.',       isPremium: false, usagePercent: 61, accentColor: '#FF3366' },
  { id: 'wave',    name: 'WAVE',     icon: '〰',  desc: 'Frequency of the crowd.',      isPremium: false, usagePercent: 18, accentColor: '#3399FF' },
  { id: 'bars',    name: 'BARS',     icon: '▮',  desc: 'Scene equalizer.',             isPremium: false, usagePercent: 9,  accentColor: '#9933FF' },
  { id: 'pulse',   name: 'PULSE',    icon: '◉',  desc: 'Venue heartbeat.',             isPremium: true,  usagePercent: 5,  accentColor: '#FF9933' },
  { id: 'aura',    name: 'AURA',     icon: '✦',  desc: 'Organic energy field.',        isPremium: true,  usagePercent: 3,  accentColor: '#CC44FF' },
  { id: 'terrain', name: 'TERRAIN',  icon: '⛰',  desc: 'Scene landscape over time.',   isPremium: true,  usagePercent: 2,  accentColor: '#00E676' },
  { id: 'radar',   name: 'RADAR',    icon: '📡', desc: 'Scout activity sweep.',        isPremium: true,  usagePercent: 1,  accentColor: '#00FFAA' },
  { id: 'matrix',  name: 'MATRIX',   icon: '⠿',  desc: 'Crowd data stream.',           isPremium: true,  usagePercent: 1,  accentColor: '#00FF41' },
];

export interface SkinProps {
  bpmShared:  SharedValue<number>;
  vibeScore:  SharedValue<number>;
  surgeValue: SharedValue<number>;
  color:      string;
}
