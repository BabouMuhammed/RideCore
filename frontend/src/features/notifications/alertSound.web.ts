// A short two-note chime made with Web Audio (no sound file to load), plus
// vibration where the phone supports it (Android; iPhone browsers don't).
// Browsers only allow sound after the person has tapped the page once,
// which is always true by the time a ride is underway.
let context: AudioContext | undefined;
function chime(notes: number[]) {
  try {
    const Audio =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Audio) return;
    context ??= new Audio();
    if (context.state === 'suspended') void context.resume();
    notes.forEach((frequency, index) => {
      const start = context!.currentTime + index * 0.18;
      const tone = context!.createOscillator();
      const volume = context!.createGain();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      tone.connect(volume).connect(context!.destination);
      tone.start(start);
      tone.stop(start + 0.4);
    });
  } catch {
    // Sound is a nicety; never break the screen over it.
  }
}
export function alertRider(kind: 'soft' | 'strong' = 'soft') {
  chime(kind === 'strong' ? [880, 1175, 1568] : [784, 1047]);
  try {
    navigator.vibrate?.(kind === 'strong' ? [250, 120, 250, 120, 250] : 200);
  } catch {
    /* unsupported */
  }
}
