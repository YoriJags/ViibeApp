/**
 * hapticVibe — energy-level-aware haptic signatures.
 * Peak venues hit different. So should the feedback.
 */
import * as Haptics from 'expo-haptics';

export async function hapticVibe(energyLevel: string): Promise<void> {
  try {
    switch (energyLevel) {
      case 'peak':
        // Heavy + success notification — the full hit
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'lit':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'charged':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'warming':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'chill':
        await Haptics.selectionAsync();
        break;
      case 'quiet':
      default:
        // No haptic — quiet venues don't demand attention
        break;
    }
  } catch {
    // Haptics not available on this device — fail silently
  }
}
