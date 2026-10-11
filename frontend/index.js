import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widgets/widget-task-handler';

// Widget rendering runs headless (no UI tree), so register before the router.
registerWidgetTaskHandler(widgetTaskHandler);

// Auto presence: a geofence event can wake the app with no UI either, so its
// background task has to be defined here too, before the router loads.
import './src/services/autoPresence';

import 'expo-router/entry';
