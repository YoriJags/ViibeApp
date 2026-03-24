// Stub for Expo modules
module.exports = {
  default: {},
  Constants: { expoConfig: {} },
  Platform: { OS: 'ios', select: (obj) => obj.ios ?? obj.default },
};
