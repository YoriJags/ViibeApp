import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { C } from './theme';
import { PreRoll } from './scenes/PreRoll';
import { Scene1Hook } from './scenes/Scene1Hook';
import { Scene2Oracle } from './scenes/Scene2Oracle';
import { Scene3Scout } from './scenes/Scene3Scout';
import { Scene4AskVibe } from './scenes/Scene4AskVibe';
import { Scene5DNA } from './scenes/Scene5DNA';
import { Scene6Merchant } from './scenes/Scene6Merchant';
import { Scene7Closing } from './scenes/Scene7Closing';

// Scene timing at 30fps
// PreRoll:   0   → 150   (0-5s)
// Scene1:    150 → 600   (5-20s)   = 450 frames
// Scene2:    600 → 1140  (20-38s)  = 540 frames
// Scene3:    1140→ 1560  (38-52s)  = 420 frames
// Scene4:    1560→ 2250  (52-75s)  = 690 frames
// Scene5:    2250→ 2700  (75-90s)  = 450 frames
// Scene6:    2700→ 3150  (90-105s) = 450 frames
// Scene7:    3150→ 3600  (105-120s)= 450 frames

export const VibezDemoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sequence from={0} durationInFrames={150}>
        <PreRoll />
      </Sequence>

      <Sequence from={150} durationInFrames={450}>
        <Scene1Hook />
      </Sequence>

      <Sequence from={600} durationInFrames={540}>
        <Scene2Oracle />
      </Sequence>

      <Sequence from={1140} durationInFrames={420}>
        <Scene3Scout />
      </Sequence>

      <Sequence from={1560} durationInFrames={690}>
        <Scene4AskVibe />
      </Sequence>

      <Sequence from={2250} durationInFrames={450}>
        <Scene5DNA />
      </Sequence>

      <Sequence from={2700} durationInFrames={450}>
        <Scene6Merchant />
      </Sequence>

      <Sequence from={3150} durationInFrames={450}>
        <Scene7Closing />
      </Sequence>
    </AbsoluteFill>
  );
};
