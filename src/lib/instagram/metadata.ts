/**
 * Metadata cleaner for upload payloads.
 *
 * Instagram strips most metadata server-side anyway, but sending the minimum
 * is the right hygiene: smaller bodies, no location/author leakage, and a
 * deterministic byte payload for caching. Handles the two formats this
 * pipeline produces: JPEG (EXIF/APP segments) and PNG (ancillary chunks).
 */

export interface CleanImage {
  /** Sanitised bytes. */
  data: Buffer;
  mime: "image/jpeg" | "image/png";
  bytesRemoved: number;
}

/** True when the buffer looks like a JPEG (SOI marker). */
function isJpeg(data: Buffer): boolean {
  return data.length > 3 && data[0] === 0xff && data[1] === 0xd8;
}

/** True when the buffer looks like a PNG signature. */
function isPng(data: Buffer): boolean {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return data.length > 8 && data.subarray(0, 8).equals(signature);
}

/**
 * Walks JPEG segments and drops every APPn/COM segment except APP0 (JFIF
 * baseline) and APP1-Exif is removed deliberately. Restarts-of-scan (DHP etc.)
 * and the SOS → EOI tail are copied verbatim.
 */
function cleanJpeg(data: Buffer): CleanImage {
  const chunks: Buffer[] = [data.subarray(0, 2)]; // SOI
  let cursor = 2;
  const originalLength = data.length;

  while (cursor + 4 <= data.length) {
    if (data[cursor] !== 0xff) break; // Not a marker — bail, copy the rest.

    const marker = data[cursor + 1];
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(data.subarray(cursor, cursor + 2));
      cursor += 2;
      continue;
    }
    // SOS: everything after this is entropy-coded image data.
    if (marker === 0xda) {
      chunks.push(data.subarray(cursor));
      cursor = data.length;
      break;
    }

    const length = data.readUInt16BE(cursor + 2);
    const segmentEnd = cursor + 2 + length;

    // Drop application segments and comments; keep everything else (DQT, SOF,
    // DHT, …) untouched.
    const isAppSegment = marker >= 0xe0 && marker <= 0xef;
    const isComment = marker === 0xfe;

    if (isAppSegment || isComment) {
      // APP0 (JFIF) is kept — it is the de-facto baseline marker.
      if (marker === 0xe0) {
        chunks.push(data.subarray(cursor, segmentEnd));
      }
      cursor = segmentEnd;
      continue;
    }

    chunks.push(data.subarray(cursor, segmentEnd));
    cursor = segmentEnd;
  }

  const cleaned = Buffer.concat(chunks);
  return {
    data: cleaned,
    mime: "image/jpeg",
    bytesRemoved: originalLength - cleaned.length,
  };
}

/**
 * Keeps only chunks a decoder needs: IHDR, PLTE, tRNS, IDAT, IEND plus the
 * gAMA/sRGB/iCCP colour hints. Drops tEXt/iTXt/zTXt/eXIf/tIME and every other
 * ancillary chunk.
 */
function cleanPng(data: Buffer): CleanImage {
  const keep = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "gAMA", "sRGB", "iCCP"]);
  const chunks: Buffer[] = [data.subarray(0, 8)];
  let cursor = 8;
  const originalLength = data.length;

  while (cursor + 8 <= data.length) {
    const length = data.readUInt32BE(cursor);
    const type = data.toString("ascii", cursor + 4, cursor + 8);
    const chunkEnd = cursor + 12 + length; // length + type + data + CRC

    if (type === "IEND") {
      chunks.push(data.subarray(cursor, chunkEnd));
      break;
    }

    if (keep.has(type)) {
      chunks.push(data.subarray(cursor, chunkEnd));
    }
    cursor = chunkEnd;
  }

  const cleaned = Buffer.concat(chunks);
  return {
    data: cleaned,
    mime: "image/png",
    bytesRemoved: originalLength - cleaned.length,
  };
}

export function cleanImageMetadata(data: Buffer): CleanImage {
  if (isJpeg(data)) return cleanJpeg(data);
  if (isPng(data)) return cleanPng(data);
  // Unknown format: pass through — the pipeline only ever produces PNGs, so
  // this branch is defensive.
  return { data, mime: "image/png", bytesRemoved: 0 };
}

export interface CleanUploadPayload {
  /** One cleaned image per slide, in deck order. */
  images: CleanImage[];
  caption: string;
  /** Total bytes stripped across the payload. */
  bytesRemoved: number;
}

/** Builds the complete clean payload for a carousel/single publish. */
export function buildCleanPayload(
  images: Buffer[],
  caption: string,
): CleanUploadPayload {
  const cleaned = images.map((image) => cleanImageMetadata(image));
  return {
    images: cleaned,
    caption,
    bytesRemoved: cleaned.reduce((sum, image) => sum + image.bytesRemoved, 0),
  };
}
