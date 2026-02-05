const OPENINGS = [
  'BREAKING:',
  'Just announced:',
  'Did you see this?',
  'Hot news:',
  'Update:',
  'Exciting news:',
];

export function pickOpening(): string {
  return OPENINGS[Math.floor(Math.random() * OPENINGS.length)] ?? 'News:';
}

export function pickCharLimit(platform: string): number {
  if (platform === 'wordpress') return 2000;
  return platform === 'facebook' ? 300 : 150;
}
