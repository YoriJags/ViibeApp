/**
 * arrivalSample — a ten-second sound level, taken once, when a scout opens
 * the arrival prompt.
 *
 * Why only then: listening in the background would need a permanent "using
 * your microphone" notification on Android, the orange dot on iOS, and would
 * deserve the headlines it got. Ten seconds at the moment someone has chosen to
 * tell us about the room gets the same data with none of that.
 *
 * What it keeps: one number, the median sound level in dB. The recorder has to
 * write a temporary file to measure anything, so that file is deleted straight
 * after, which is what makes "no audio is ever stored" true rather than nearly
 * true. Tempo (BPM) is deliberately not taken: ten seconds is too short to
 * estimate it honestly.
 *
 * Only runs if the scout opted into ambient sound in their settings.
 */
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'https://vibeapp-production-1835.up.railway.app';

const SAMPLE_MS = 10_000;
const TICK_MS = 500;

function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x) && x > -160).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Take the sample and send it. Resolves to the dB level sent, or null when it
 * could not or should not run. Never throws: a failed sample must never get in
 * the way of the reading itself.
 */
export async function sampleArrivalSound(
  venueId: string,
  sessionToken: string | null,
  optedIn: boolean,
): Promise<number | null> {
  if (!optedIn || !sessionToken || !venueId) return null;

  let recording: Audio.Recording | null = null;
  try {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') return null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true });

    const created = await Audio.Recording.createAsync({
      ...Audio.RecordingOptionsPresets.LOW_QUALITY,
      isMeteringEnabled: true,
    });
    recording = created.recording;

    const levels: number[] = [];
    const end = Date.now() + SAMPLE_MS;
    while (Date.now() < end) {
      const s = await recording.getStatusAsync();
      if (s.isRecording && typeof s.metering === 'number') levels.push(s.metering);
      await wait(TICK_MS);
    }

    const level = median(levels);
    if (level == null) return null;

    await fetch(`${API_URL}/api/ambient/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ venue_id: venueId, db_level: Math.round(level * 10) / 10 }),
    });
    return level;
  } catch {
    return null;
  } finally {
    if (recording) {
      const uri = recording.getURI();
      try { await recording.stopAndUnloadAsync(); } catch { /* already stopped */ }
      // Delete the temporary audio file. Only the number above ever leaves the phone.
      if (uri) {
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch { /* gone already */ }
      }
    }
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch { /* ignore */ }
  }
}
