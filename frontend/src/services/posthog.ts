/**
 * PostHog client — initialised once at app start.
 * Dual-send strategy: events also go to our own backend (feeds DNA + intelligence).
 * PostHog gets everything for funnels, retention, cohorts, and feature flags.
 */
import PostHog from 'posthog-react-native';

const POSTHOG_KEY  = process.env.EXPO_PUBLIC_POSTHOG_KEY  ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export let posthog: PostHog | null = null;

export async function initPostHog(): Promise<void> {
  if (!POSTHOG_KEY || posthog) return;
  try {
    posthog = await PostHog.initAsync(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      captureApplicationLifecycleEvents: true, // app opens, installs, updates
      captureDeepLinks: false,
      defaultOptIn: true,
    });
  } catch (e) {
    // Non-fatal — analytics degrades gracefully
    console.warn('[PostHog] init failed:', e);
  }
}

export default posthog;
