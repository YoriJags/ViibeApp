import { Redirect } from 'expo-router';

export default function Index() {
  // Default entry point - Public floor (The Social Experience)
  return <Redirect href="/(public)" />;
}
