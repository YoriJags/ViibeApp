// Minimal React Native stub for unit tests
module.exports = {
  Platform: { OS: 'ios', select: (obj) => obj.ios ?? obj.default },
  StyleSheet: { create: (s) => s, flatten: (s) => s },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  PixelRatio: { get: () => 3, roundToNearestPixel: (n) => n },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Image: 'Image',
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: jest.fn() },
  Animated: {
    Value: jest.fn(() => ({ setValue: jest.fn(), interpolate: jest.fn(() => 0) })),
    timing: jest.fn(() => ({ start: jest.fn() })),
    spring: jest.fn(() => ({ start: jest.fn() })),
    View: 'Animated.View',
  },
  NativeModules: {},
  NativeEventEmitter: jest.fn(() => ({ addListener: jest.fn(), removeAllListeners: jest.fn() })),
  AppState: { currentState: 'active', addEventListener: jest.fn() },
};
