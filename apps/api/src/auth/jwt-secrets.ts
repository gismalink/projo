export function parseJwtSecretMap(rawValue: string | undefined, fallbackSecret: string) {
  const parsed = new Map<string, string>();

  String(rawValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item, index) => {
      const [kidRaw, ...secretRawParts] = item.split(':');
      const kid = String(kidRaw || '').trim();
      const secret = secretRawParts.join(':').trim();

      if (kid && secret) {
        parsed.set(kid, secret);
        return;
      }

      if (!kid && secret) {
        parsed.set(`legacy-${index + 1}`, secret);
      }
    });

  if (parsed.size === 0 && fallbackSecret) {
    parsed.set('legacy-v1', fallbackSecret);
  }

  return parsed;
}
