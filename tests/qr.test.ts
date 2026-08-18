import { expect, it } from "vitest";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { qrPng, qrSvg } from "../src/lib/qr";

it("exports a branded, decodable Zimaxx QR with a protected logo area", async () => {
  const logo = new PNG({ width: 48, height: 48 });
  for (let y = 0; y < logo.height; y++) for (let x = 0; x < logo.width; x++) {
    const i = (y * logo.width + x) * 4;
    const mark = x > 15 && x < 32;
    logo.data[i] = 184; logo.data[i + 1] = 134; logo.data[i + 2] = 11; logo.data[i + 3] = mark ? 255 : 0;
  }
  const value = "https://qr.zimmax.test/r/printed-van";
  const style = { foreground: "#8E6500", background: "#FFFFFF", errorCorrection: "L" as const, logo: new Uint8Array(PNG.sync.write(logo)), logoMime: "image/png" };
  const png = PNG.sync.read(Buffer.from(await qrPng(value, style, 768)));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toBe(value);
  const { svg, level } = await qrSvg(value, style, 768);
  expect(level).toBe("H");
  expect(svg).toContain("linearGradient");
  expect(svg).toContain("<circle");
  expect(svg).toContain("<image");
});

it("includes the official Zimaxx symbol automatically", async () => {
  const value = "https://qr.zimmax.test/r/van-default-logo";
  const style = { foreground: "#8E6500", background: "#FFFFFF", errorCorrection: "M" as const };
  const png = PNG.sync.read(Buffer.from(await qrPng(value, style, 768)));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toBe(value);
  const { svg, level } = await qrSvg(value, style, 768);
  expect(level).toBe("H");
  expect(svg.match(/<polygon/g)).toHaveLength(3);
  expect(svg).toContain("#B18700");
});
