const reanimatedResolver = require('react-native-reanimated/jest/resolver');

// Jest executes Lucide's real CJS exports; Metro uses its native ESM exports.
module.exports = (request, options) =>
  reanimatedResolver(
    request,
    request.startsWith('lucide-react-native')
      ? { ...options, conditions: ['require', 'default'] }
      : options,
  );
