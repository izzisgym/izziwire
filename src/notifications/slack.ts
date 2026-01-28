import { getConfig } from '../config.js';

export async function sendSlackNotification(text: string): Promise<void> {
  const cfg = getConfig();
  const url = cfg.SLACK_WEBHOOK_URL;
  if (!url || url === '') return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}
