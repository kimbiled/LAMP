import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { extractPhotoFromDocx } from "@/lib/resume/photo";

// Фото из резюме в Word: DOCX — это zip, картинки лежат в word/media.
// Собираем маленький документ прямо в тесте: логотип 60×60 и портрет
// 300×400. Брать надо портрет, а логотип пропускать.

async function docx(images: Record<string, Buffer>): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", "<w:document/>");
  for (const [name, data] of Object.entries(images)) {
    zip.file(`word/media/${name}`, data);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

function picture(width: number, height: number, type: "image/png" | "image/jpeg") {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#c33";
  context.fillRect(0, 0, width, height);
  return type === "image/png" ? canvas.toBuffer("image/png") : canvas.toBuffer("image/jpeg");
}

describe("Фото из DOCX", () => {
  it("берёт портрет и пропускает логотип", async () => {
    const file = await docx({
      "image1.png": picture(60, 60, "image/png"),
      "image2.jpeg": picture(300, 400, "image/jpeg"),
    });

    const photo = await extractPhotoFromDocx(file);
    expect(photo).not.toBeNull();
    const image = await loadImage(photo!.data);
    expect(image.width).toBe(300);
    expect(image.height).toBe(400);
  });

  it("уменьшает крупное фото до 400 по большей стороне", async () => {
    const file = await docx({ "image1.png": picture(900, 1200, "image/png") });
    const photo = await extractPhotoFromDocx(file);
    const image = await loadImage(photo!.data);
    expect(Math.max(image.width, image.height)).toBe(400);
  });

  it("без картинок возвращает null", async () => {
    expect(await extractPhotoFromDocx(await docx({}))).toBeNull();
  });

  it("на битом файле не падает", async () => {
    expect(await extractPhotoFromDocx(Buffer.from("not a zip"))).toBeNull();
  });
});
