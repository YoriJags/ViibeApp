/**
 * AnimatedCounter - Number that animates from 0 to target value
 * Smooth counting with easing deceleration
 */
import React, { useEffect, useRef } from 'react';
import { Text, Animated, TextStyle } from 'react-native';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  style?: TextStyle;
  decimals?: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1200,
  prefix = '',
  suffix = '',
  style,
  decimals = 0,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const displayValue = useRef('0');
  const textRef = useRef<Text>(null);

  useEffect(() => {
    animatedValue.setValue(0);

    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();

    const listener = animatedValue.addListener(({ value: v }) => {
      const formatted = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
      displayValue.current = `${prefix}${formatted}${suffix}`;
      if (textRef.current) {
        textRef.current.setNativeProps({ text: displayValue.current });
      }
    });

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [value, duration, prefix, suffix, decimals]);

  return (
    <AnimatedText
      ref={textRef}
      style={style}
      value={animatedValue}
      prefix={prefix}
      suffix={suffix}
      decimals={decimals}
    />
  );
};

// Inner component that reads the animated value
const AnimatedText = React.forwardRef<Text, {
  style?: TextStyle;
  value: Animated.Value;
  prefix: string;
  suffix: string;
  decimals: number;
}>(({ style, value, prefix, suffix, decimals }, ref) => {
  const [display, setDisplay] = React.useState(`${prefix}0${suffix}`);

  useEffect(() => {
    const listener = value.addListener(({ value: v }) => {
      const formatted = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
      setDisplay(`${prefix}${formatted}${suffix}`);
    });
    return () => value.removeListener(listener);
  }, [value, prefix, suffix, decimals]);

  return <Text ref={ref} style={style}>{display}</Text>;
});

AnimatedText.displayName = 'AnimatedText';

export default AnimatedCounter;
