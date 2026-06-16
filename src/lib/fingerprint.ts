/**
 * Client-Side Device Fingerprinting Utility
 * Generates a unique, stable device signature using browser features and HTML5 Canvas hashes.
 */

export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server_render';

  const components = [
    navigator.userAgent || '',
    navigator.language || '',
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString(),
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || '',
  ];

  // Simple Canvas Fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('BikerApp,clnt_fngrprnt!2026', 2, 2);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('BikerApp,clnt_fngrprnt!2026', 4, 17);
      
      const dataUrl = canvas.toDataURL();
      components.push(dataUrl);
    }
  } catch (e) {
    // Ignore canvas execution errors
  }

  // Create a 32-bit hash from fingerprint components string
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'bkr_fp_' + Math.abs(hash).toString(16);
}
