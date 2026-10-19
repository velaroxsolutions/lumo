// F12.9 — hand the user a JSON file of everything lumo holds about them.
// Web downloads it; phones open the share sheet (save to Files, AirDrop, mail…).

import { Platform } from 'react-native';

export async function saveJson(filename, data) {
  const text = JSON.stringify(data, null, 2);
  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export lumo data' });
}
