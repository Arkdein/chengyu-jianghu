// Stroke-order strictness: Hanzi Writer leniency and the matching score multiplier.
export const STRICTNESS = {
  loose: { label: '宽松', en: 'Relaxed', leniency: 1.7, mult: 0.9 },
  std: { label: '标准', en: 'Standard', leniency: 1.35, mult: 1 },
  strict: { label: '严格', en: 'Strict', leniency: 1.0, mult: 1.15 },
};
