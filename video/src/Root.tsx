import React from 'react';
import { Composition } from 'remotion';
import { VibezDemoVideo } from './Video';

// Total: 120 seconds at 30fps = 3600 frames
const DURATION = 3600;
const FPS = 30;
const W = 1920;
const H = 1080;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VibezDemo"
        component={VibezDemoVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{}}
      />
    </>
  );
};
