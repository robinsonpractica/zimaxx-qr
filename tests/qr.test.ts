import { expect, it } from "vitest";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { qrPng, qrSvg } from "../src/lib/qr";

it("exports a branded, decodable Zimaxx QR with a protected logo area", async () => {
  const value = "https://qr.zimmax.test/r/printed-van";
  const style = { foreground: "#8E6500", background: "#FFFFFF", errorCorrection: "L" as const };
  const png = PNG.sync.read(Buffer.from(await qrPng(value, style, 768)));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toBe(value);
  const { svg, level } = await qrSvg(value, style, 768);
  expect(level).toBe("H");
  expect(svg).toContain("linearGradient");
  expect(svg).toContain("<circle");
  expect(svg.match(/<polygon/g)).toHaveLength(3);
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
