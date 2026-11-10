/**
 * Old rating route. Readings are now taken from the venue screen's reading
 * sheet, so a shared /rate/<id> link or an old notification opens the venue
 * with the sheet ready. This replaces a separate 600-line rating screen that
 * showed a red error to signed-out people and "Venue not found" in demo.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function RateRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/venue/[id]', params: { id: id ?? '', openRateModal: 'true' } } as any} />;
}
