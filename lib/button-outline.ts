import type { Theme } from './theme';

export function buttonOutlineColor(fill: unknown, tint: unknown, existing: unknown, theme: Theme, dark: boolean): string {
  const value = typeof fill === 'string' ? fill.toLowerCase() : '';
  const semantic: [string, string][] = [
    [theme.accentSurface, theme.accent], [theme.infoSurface, theme.info],
    [theme.successSurface, theme.success], [theme.warningSurface, theme.warning],
    [theme.dangerSurface, theme.danger],
  ];
  const match = semantic.find(([background]) => background.toLowerCase() === value);
  if (match) return match[1];
  const neutral = !value || value === 'transparent' || [theme.background, theme.surface, theme.raised, theme.input].some(color => color.toLowerCase() === value);
  if (neutral) {
    if (typeof existing === 'string' && existing !== 'transparent' && existing !== theme.border) return existing;
    return typeof tint === 'string' && tint !== theme.onPrimary && tint !== theme.text ? tint : theme.border;
  }
  const hex = /^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.exec(value)?.[1];
  if (!hex) return theme.border;
  const rgb = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex.slice(0, 6);
  const channels = [0, 2, 4].map(offset => parseInt(rgb.slice(offset, offset + 2), 16));
  const target = dark ? 255 : 0;
  return '#' + channels.map(channel => Math.round(channel * 0.72 + target * 0.28).toString(16).padStart(2, '0')).join('');
}
