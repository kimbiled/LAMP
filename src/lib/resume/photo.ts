import { getDocumentProxy, extractImages } from "unpdf";

// Фотография кандидата из резюме.
//
// В выгрузке с hh на первой странице лежат две картинки: логотип hh
// 72×72 с прозрачностью и само фото — заметно крупнее и без альфы.
// Поэтому берём самую большую картинку, которая похожа на портрет,
// а мелочь отсеиваем по размеру.
//
// Нейросети здесь не участвуют: это разбор структуры файла и простые
// правила по размеру и пропорциям.
//
// Модуль не помечен server-only: его запускают и служебные команды.

// Меньше этого — значок, подпись или иконка, но не фотография.
const MIN_SIDE = 120;

// Пропорции портрета. Снизу — вытянутые вертикальные кадры (встречаются
// в дизайнерских резюме), сверху — почти квадратные аватарки.
const MIN_RATIO = 0.4;
const MAX_RATIO = 1.8;

// Больше этого не храним: в карточке фото показывается маленьким,
// а в базе и хранилище лишние мегабайты ни к чему.
const MAX_SIDE = 400;

export type ExtractedPhoto = {
  data: Buffer;
  mimeType: "image/jpeg";
  extension: "jpg";
};

type RawImage = {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array | Uint8ClampedArray;
};

// Подходит ли картинка на роль фотографии.
function looksLikePortrait(image: RawImage): boolean {
  if (image.width < MIN_SIDE || image.height < MIN_SIDE) return false;

  const ratio = image.width / image.height;
  return ratio >= MIN_RATIO && ratio <= MAX_RATIO;
}

// Из нескольких подходящих берём самую крупную: фото всегда больше
// декоративных элементов.
function pickBest(images: RawImage[]): RawImage | null {
  const fit = images.filter(looksLikePortrait);
  if (fit.length === 0) return null;

  return fit.reduce((best, image) =>
    image.width * image.height > best.width * best.height ? image : best,
  );
}

// Сырые пиксели из PDF — в JPEG. Канвас принимает только RGBA,
// поэтому трёхканальную картинку расширяем, дописывая прозрачность.
async function toJpeg(image: RawImage): Promise<Buffer> {
  const { createCanvas, ImageData } = await import("@napi-rs/canvas");

  const rgba = new Uint8ClampedArray(image.width * image.height * 4);

  if (image.channels === 4) {
    rgba.set(image.data);
  } else if (image.channels === 3) {
    for (let i = 0, j = 0; i < image.data.length; i += 3, j += 4) {
      rgba[j] = image.data[i];
      rgba[j + 1] = image.data[i + 1];
      rgba[j + 2] = image.data[i + 2];
      rgba[j + 3] = 255;
    }
  } else if (image.channels === 1) {
    // Чёрно-белое: одно значение на три канала.
    for (let i = 0, j = 0; i < image.data.length; i += 1, j += 4) {
      rgba[j] = image.data[i];
      rgba[j + 1] = image.data[i];
      rgba[j + 2] = image.data[i];
      rgba[j + 3] = 255;
    }
  } else {
    throw new Error(`Неизвестное число каналов: ${image.channels}`);
  }

  const source = createCanvas(image.width, image.height);
  source
    .getContext("2d")
    .putImageData(new ImageData(rgba, image.width, image.height), 0, 0);

  // Уменьшаем, если фото крупнее нужного.
  const scale = Math.min(MAX_SIDE / image.width, MAX_SIDE / image.height, 1);
  if (scale === 1) return source.toBuffer("image/jpeg", 88);

  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const target = createCanvas(width, height);
  target.getContext("2d").drawImage(source, 0, 0, width, height);

  return target.toBuffer("image/jpeg", 88);
}

// Фото из PDF. Смотрим только первую страницу: на остальных бывают
// логотипы компаний из мест работы, и они не имеют отношения к человеку.
export async function extractPhotoFromPdf(
  data: Buffer,
): Promise<ExtractedPhoto | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const images = (await extractImages(pdf, 1)) as RawImage[];

    const best = pickBest(images);
    if (!best) return null;

    return {
      data: await toJpeg(best),
      mimeType: "image/jpeg",
      extension: "jpg",
    };
  } catch {
    // Фото — приятное дополнение, а не причина ронять загрузку резюме.
    return null;
  }
}

// Фото из Word (DOCX). Документ — это zip-архив, картинки в нём лежат
// отдельными файлами в папке word/media. Правило выбора то же, что
// и для PDF: самая крупная картинка с пропорциями портрета.
export async function extractPhotoFromDocx(
  data: Buffer,
): Promise<ExtractedPhoto | null> {
  try {
    const { default: JSZip } = await import("jszip");
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const zip = await JSZip.loadAsync(data);

    const media = Object.values(zip.files).filter(
      (file) =>
        !file.dir && /^word\/media\/.+\.(png|jpe?g|webp)$/i.test(file.name),
    );

    let best: { image: Awaited<ReturnType<typeof loadImage>>; area: number } | null =
      null;

    for (const file of media) {
      try {
        const image = await loadImage(await file.async("nodebuffer"));
        const fake = { width: image.width, height: image.height } as RawImage;
        if (!looksLikePortrait(fake)) continue;
        const area = image.width * image.height;
        if (!best || area > best.area) best = { image, area };
      } catch {
        // Битая или неподдерживаемая картинка — просто пропускаем.
      }
    }

    if (!best) return null;

    const { image } = best;
    const scale = Math.min(MAX_SIDE / image.width, MAX_SIDE / image.height, 1);
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    // Белый фон: у PNG с прозрачностью в JPEG иначе вышел бы чёрный.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return {
      data: canvas.toBuffer("image/jpeg", 88),
      mimeType: "image/jpeg",
      extension: "jpg",
    };
  } catch {
    return null;
  }
}
