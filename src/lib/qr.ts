import QRCode from "qrcode";
import { encode } from "fast-png";
import { effectiveErrorCorrection, normalizeHex, scannability, type ErrorCorrection } from "./domain";

export interface QrStyle {
  foreground: string;
  background: string;
  errorCorrection: ErrorCorrection;
}

type Rgb = [number, number, number];

/** A restrained second gold keeps the branded gradient readable in print. */
export function zimaxxGradientEnd(foreground: string) {
  const [r, g, b] = hexToRgb(normalizeHex(foreground));
  const target: Rgb = [184, 134, 11];
  const amount = 0.25;
  return rgbToHex([
    Math.round(r + (target[0] - r) * amount),
    Math.round(g + (target[1] - g) * amount),
    Math.round(b + (target[2] - b) * amount),
  ]);
}

export async function qrSvg(value: string, style: QrStyle, size = 1024) {
  const startColor = normalizeHex(style.foreground);
  const endColor = zimaxxGradientEnd(startColor);
  const background = normalizeHex(style.background);
  const level = effectiveErrorCorrection(style.errorCorrection, true);
  const model = QRCode.create(value, { errorCorrectionLevel: level });
  const modules = model.modules.size;
  const margin = 4;
  const unit = size / (modules + margin * 2);
  const gap = unit * 0.16;
  const parts: string[] = [];

  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (!model.modules.get(row, col) || isFinder(row, col, modules)) continue;
      parts.push(`<rect x="${fmt((col + margin) * unit + gap / 2)}" y="${fmt((row + margin) * unit + gap / 2)}" width="${fmt(unit - gap)}" height="${fmt(unit - gap)}" rx="${fmt(unit * 0.12)}" fill="url(#zimaxx-gold)"/>`);
    }
  }

  const eyes = [[0, 0], [modules - 7, 0], [0, modules - 7]]
    .map(([col, row]) => svgFinderEye(col, row, margin, unit, background))
    .join("");
  const logo = svgZimaxxLogo(size, background);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Zimaxx dynamic QR code"><defs><linearGradient id="zimaxx-gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${startColor}"/><stop offset="1" stop-color="${endColor}"/></linearGradient></defs><rect width="${size}" height="${size}" fill="${background}"/>${parts.join("")}${eyes}${logo}</svg>`;

  return { svg, check: scannability(endColor, background, true), level };
}

export async function qrPng(value: string, style: QrStyle, size = 2048): Promise<Uint8Array> {
  const startColor = hexToRgb(normalizeHex(style.foreground));
  const endColor = hexToRgb(zimaxxGradientEnd(style.foreground));
  const background = hexToRgb(normalizeHex(style.background));
  const model = QRCode.create(value, { errorCorrectionLevel: effectiveErrorCorrection(style.errorCorrection, true) });
  const modules = model.modules.size;
  const scale = Math.max(1, Math.floor(size / (modules + 8)));
  const qrSize = (modules + 8) * scale;
  const origin = Math.floor((size - qrSize) / 2) + 4 * scale;
  const pixels = new Uint8Array(size * size * 4);
  fillCanvas(pixels, size, background);

  const inset = Math.max(1, Math.round(scale * 0.08));
  const radius = Math.max(1, Math.round(scale * 0.12));
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (!model.modules.get(row, col) || isFinder(row, col, modules)) continue;
      fillRoundedRect(pixels, size, origin + col * scale + inset, origin + row * scale + inset, scale - inset * 2, scale - inset * 2, radius, startColor, endColor);
    }
  }

  drawFinderEye(pixels, size, origin, origin, scale, background, startColor, endColor);
  drawFinderEye(pixels, size, origin + (modules - 7) * scale, origin, scale, background, startColor, endColor);
  drawFinderEye(pixels, size, origin, origin + (modules - 7) * scale, scale, background, startColor, endColor);

  drawZimaxxLogo(pixels, size, background);
  return encode({ width: size, height: size, data: pixels, channels: 4, depth: 8 });
}

function isFinder(row: number, col: number, modules: number) {
  return (row < 7 && col < 7) || (row < 7 && col >= modules - 7) || (row >= modules - 7 && col < 7);
}

function svgFinderEye(col: number, row: number, margin: number, unit: number, background: string) {
  const x = (col + margin) * unit;
  const y = (row + margin) * unit;
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(unit * 7)}" height="${fmt(unit * 7)}" rx="${fmt(unit * 1.05)}" fill="url(#zimaxx-gold)"/><rect x="${fmt(x + unit)}" y="${fmt(y + unit)}" width="${fmt(unit * 5)}" height="${fmt(unit * 5)}" rx="${fmt(unit * 0.72)}" fill="${background}"/><circle cx="${fmt(x + unit * 3.5)}" cy="${fmt(y + unit * 3.5)}" r="${fmt(unit * 1.5)}" fill="url(#zimaxx-gold)"/>`;
}

function svgZimaxxLogo(size: number, background: string) {
  const box = Math.round(size * 0.18);
  const x = (size - box) / 2;
  const pad = Math.round(size * 0.018);
  const scale = box / 1206;
  const point = (sourceX: number, sourceY: number) => `${fmt(x + (sourceX - 397) * scale)},${fmt(x + (sourceY - 397) * scale)}`;
  const center = [point(1000,397),point(1117,510),point(1117,1490),point(1000,1603),point(888,1490),point(888,510)].join(" ");
  const left = [point(637,760),point(397,1000),point(637,1240)].join(" ");
  const right = [point(1368,760),point(1603,1000),point(1368,1240)].join(" ");
  return `<rect x="${x-pad}" y="${x-pad}" width="${box+pad*2}" height="${box+pad*2}" rx="${pad}" fill="${background}"/><g fill="#B18700"><polygon points="${center}"/><polygon points="${left}"/><polygon points="${right}"/></g>`;
}

function drawFinderEye(pixels: Uint8Array, size: number, x: number, y: number, scale: number, background: Rgb, start: Rgb, end: Rgb) {
  fillRoundedRect(pixels, size, x, y, scale * 7, scale * 7, Math.round(scale * 1.05), start, end);
  fillRoundedRect(pixels, size, x + scale, y + scale, scale * 5, scale * 5, Math.round(scale * 0.72), background, background);
  fillCircle(pixels, size, x + scale * 3.5, y + scale * 3.5, scale * 1.5, start, end);
}

function drawZimaxxLogo(pixels: Uint8Array, size: number, background: Rgb) {
  const box = Math.round(size * 0.18);
  const start = Math.floor((size - box) / 2);
  const pad = Math.round(size * 0.022);
  const scale = box / 1206;
  const point = (sourceX: number, sourceY: number): [number, number] => [start + (sourceX - 397) * scale, start + (sourceY - 397) * scale];
  fillRoundedRect(pixels, size, start - pad, start - pad, box + pad * 2, box + pad * 2, pad, background, background);
  const gold: Rgb = [177, 135, 0];
  fillPolygon(pixels, size, [point(1000,397),point(1117,510),point(1117,1490),point(1000,1603),point(888,1490),point(888,510)], gold);
  fillPolygon(pixels, size, [point(637,760),point(397,1000),point(637,1240)], gold);
  fillPolygon(pixels, size, [point(1368,760),point(1603,1000),point(1368,1240)], gold);
}

function fillPolygon(pixels: Uint8Array, size: number, points: Array<[number, number]>, color: Rgb) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]))));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(...points.map((point) => point[1]))));
  for (let y = minY; y <= maxY; y++) {
    const intersections: number[] = [];
    for (let i = 0, previous = points.length - 1; i < points.length; previous = i++) {
      const [x1, y1] = points[previous], [x2, y2] = points[i];
      if ((y1 > y) !== (y2 > y)) intersections.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) for (let x = Math.max(0, Math.ceil(intersections[i])); x <= Math.min(size - 1, Math.floor(intersections[i + 1])); x++) setSolidPixel(pixels, size, x, y, color);
  }
}

function setSolidPixel(pixels: Uint8Array, size: number, x: number, y: number, color: Rgb) {
  const offset = (y * size + x) * 4;
  pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 255;
}

function fillCanvas(pixels: Uint8Array, size: number, color: Rgb) {
  for (let index = 0; index < size * size; index++) {
    const offset = index * 4;
    pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 255;
  }
}

function fillRoundedRect(pixels: Uint8Array, size: number, x: number, y: number, width: number, height: number, radius: number, start: Rgb, end: Rgb) {
  const left = Math.max(0, Math.floor(x)), top = Math.max(0, Math.floor(y));
  const right = Math.min(size, Math.ceil(x + width)), bottom = Math.min(size, Math.ceil(y + height));
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  for (let py = top; py < bottom; py++) for (let px = left; px < right; px++) {
    const dx = Math.max(x + r - (px + 0.5), 0, (px + 0.5) - (x + width - r));
    const dy = Math.max(y + r - (py + 0.5), 0, (py + 0.5) - (y + height - r));
    if (dx * dx + dy * dy <= r * r) setGradientPixel(pixels, size, px, py, start, end);
  }
}

function fillCircle(pixels: Uint8Array, size: number, cx: number, cy: number, radius: number, start: Rgb, end: Rgb) {
  const left = Math.max(0, Math.floor(cx - radius)), right = Math.min(size, Math.ceil(cx + radius));
  const top = Math.max(0, Math.floor(cy - radius)), bottom = Math.min(size, Math.ceil(cy + radius));
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius ** 2) setGradientPixel(pixels, size, x, y, start, end);
}

function setGradientPixel(pixels: Uint8Array, size: number, x: number, y: number, start: Rgb, end: Rgb) {
  const t = x / Math.max(1, size - 1);
  const offset = (y * size + x) * 4;
  pixels[offset] = Math.round(start[0] + (end[0] - start[0]) * t);
  pixels[offset + 1] = Math.round(start[1] + (end[1] - start[1]) * t);
  pixels[offset + 2] = Math.round(start[2] + (end[2] - start[2]) * t);
  pixels[offset + 3] = 255;
}

function hexToRgb(hex: string): Rgb { return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)]; }
function rgbToHex([r, g, b]: Rgb) { return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`; }
function fmt(value: number) { return Number(value.toFixed(3)); }
