/**
 * Photo Frame Processing Engine (HTML5 Canvas & WebCodecs)
 * Matches ImageMagick batch processing pipeline from PowerShell script
 */

export interface FrameSettings {
  style: number; // 1 to 6
  matColor: string; // Hex color e.g. '#FFFFFF'
  marginPct: number; // 2 to 25 (%)
  caption: string;
  fontFamily: string; // 'serif', 'sans-serif', 'monospace', 'cursive'
  aspectChoice: number; // 0=Original, 1=1:1, 2=4:5, 3=16:9, 4=9:16
  doSharpen: boolean;
  resLimit: number; // 0=4K (3840x2160), 1=2K (2560x1440), 2=FHD (1920x1080), 3=Native
  exportFormat: 'image/jpeg' | 'image/png' | 'image/webp';
  exportQuality: number; // 0.85 to 1.0
}

export interface ProcessedPhotoResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  fileName: string;
}

// Preset Mat Shades
export const MAT_PRESETS = [
  { name: 'Museum White', hex: '#FFFFFF' },
  { name: 'Archival Warm White', hex: '#FBF9F5' },
  { name: 'Antique Cream', hex: '#F3EFE6' },
  { name: 'Gallery Charcoal', hex: '#262626' },
  { name: 'Obsidian Black', hex: '#111111' },
];

export const FRAME_STYLES = [
  { id: 1, name: '1. Classic Wide Border', desc: 'Clean 10% white/colored margin', defaultMargin: 10 },
  { id: 2, name: '2. High Contrast Line Art', desc: 'Dark inner rule + wide outer mat', defaultMargin: 10 },
  { id: 3, name: '3. Gallery Mat', desc: 'True asymmetric bottom-heavy museum mat', defaultMargin: 6 },
  { id: 4, name: '4. Bold Double Mat', desc: 'Inner reveal, dark gap line, outer mat', defaultMargin: 8 },
  { id: 5, name: '5. Deep Shadow Box', desc: 'Floating drop shadow depth effect', defaultMargin: 6 },
  { id: 6, name: '6. Equal Thin Classic', desc: 'Uniform minimalist 5% border', defaultMargin: 5 },
];

export const ASPECT_RATIOS = [
  { id: 0, label: 'Original Image Ratio (Fitted)' },
  { id: 1, label: '1:1 Square (Instagram Feed)' },
  { id: 2, label: '4:5 Vertical (IG Portrait)' },
  { id: 3, label: '16:9 Wide (Display / 4K)' },
  { id: 4, label: '9:16 Vertical (Stories / TikTok)' },
];

export const RESOLUTION_PRESETS = [
  { id: 0, label: '3840 x 2160 (4K UHD Websharp)', maxW: 3840, maxH: 2160 },
  { id: 1, label: '2560 x 1440 (2K QHD)', maxW: 2560, maxH: 1440 },
  { id: 2, label: '1920 x 1080 (Full HD)', maxW: 1920, maxH: 1080 },
  { id: 3, label: 'Original (Full Native Res)', maxW: 0, maxH: 0 },
];

/**
 * Checks if color is light or dark to auto-contrast text and border lines
 */
export function isLightColor(hex: string): boolean {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const r = parseInt(c.substring(0, 2), 16) || 255;
  const g = parseInt(c.substring(2, 4), 16) || 255;
  const b = parseInt(c.substring(4, 6), 16) || 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

/**
 * Unsharp Mask / Micro-contrast filter (matching ImageMagick -unsharp 0x0.75+0.75+0.008)
 */
function applyUnsharpMask(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number = 0.6) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const copy = new Uint8ClampedArray(data);

    // 3x3 Sharpening Convolution
    // Center: 1 + 4*a, neighbors: -a
    const a = amount * 0.25;
    const center = 1 + 4 * a;

    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = (rowOffset + x) * 4;

        for (let c = 0; c < 3; c++) {
          const val =
            copy[idx + c] * center -
            (copy[idx - 4 + c] +
              copy[idx + 4 + c] +
              copy[idx - width * 4 + c] +
              copy[idx + width * 4 + c]) *
              a;
          data[idx + c] = Math.max(0, Math.min(255, val));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn('Canvas pixel manipulation error:', err);
  }
}

/**
 * Loads an image from URL or Blob
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = src;
  });
}

/**
 * Main Frame Processing Engine
 */
export async function renderFramedPhoto(
  sourceImage: HTMLImageElement | string,
  settings: FrameSettings,
  isPreview: boolean = false
): Promise<HTMLCanvasElement> {
  const img = typeof sourceImage === 'string' ? await loadImage(sourceImage) : sourceImage;

  // Calculate scaled dimensions
  let srcW = img.naturalWidth || img.width;
  let srcH = img.naturalHeight || img.height;

  if (isPreview) {
    // Restrict preview resolution for real-time 60fps responsiveness
    const maxPreview = 1000;
    if (srcW > maxPreview || srcH > maxPreview) {
      const scale = Math.min(maxPreview / srcW, maxPreview / srcH);
      srcW = Math.round(srcW * scale);
      srcH = Math.round(srcH * scale);
    }
  } else {
    // Apply Max Resolution limits
    const resConfig = RESOLUTION_PRESETS[settings.resLimit] || RESOLUTION_PRESETS[0];
    if (resConfig.maxW > 0 && (srcW > resConfig.maxW || srcH > resConfig.maxH)) {
      const scale = Math.min(resConfig.maxW / srcW, resConfig.maxH / srcH);
      srcW = Math.round(srcW * scale);
      srcH = Math.round(srcH * scale);
    }
  }

  // Determine margin sizes based on percentage of photo's longest dimension
  const baseDim = Math.max(srcW, srcH);
  const marginPctVal = Math.max(0.02, Math.min(0.25, settings.marginPct / 100));
  let marginPx = Math.round(baseDim * marginPctVal);

  // Separate margins: Top, Right, Bottom, Left
  let topMargin = marginPx;
  let bottomMargin = marginPx;
  let leftMargin = marginPx;
  let rightMargin = marginPx;

  // Frame Styles Specific Logic
  const style = settings.style;
  const isLight = isLightColor(settings.matColor);
  const ruleLineColor = isLight ? '#18181B' : '#FFFFFF';
  const ruleLineWidth = Math.max(2, Math.round(baseDim * 0.003)); // ~4px at 1200px
  const shadowOffset = Math.max(4, Math.round(baseDim * 0.012));
  const shadowBlur = Math.max(8, Math.round(baseDim * 0.02));

  // Style 3: Gallery Mat - Asymmetric bottom heavy (+5% extra bottom space)
  if (style === 3) {
    const extraBottom = Math.round(baseDim * 0.06);
    bottomMargin += extraBottom;
  }

  // Style 6: Equal Thin Classic (forced 5% border)
  if (style === 6) {
    const thinPx = Math.round(baseDim * 0.05);
    topMargin = thinPx;
    bottomMargin = thinPx;
    leftMargin = thinPx;
    rightMargin = thinPx;
  }

  // Pass 1: Render photo + frame border
  const stage1W = srcW + leftMargin + rightMargin;
  const stage1H = srcH + topMargin + bottomMargin;

  const stage1Canvas = document.createElement('canvas');
  stage1Canvas.width = stage1W;
  stage1Canvas.height = stage1H;
  const ctx1 = stage1Canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx1) throw new Error('Could not get canvas context');

  // Fill outer mat background
  ctx1.fillStyle = settings.matColor;
  ctx1.fillRect(0, 0, stage1W, stage1H);

  // Photo placement coordinate
  const photoX = leftMargin;
  const photoY = topMargin;

  // Draw Specific Frame Effect
  if (style === 5) {
    // Style 5: Deep Shadow Box
    // Draw drop shadow behind photo
    ctx1.save();
    ctx1.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx1.shadowBlur = shadowBlur;
    ctx1.shadowOffsetX = shadowOffset;
    ctx1.shadowOffsetY = shadowOffset;
    ctx1.fillStyle = '#1A1A1A';
    ctx1.fillRect(photoX, photoY, srcW, srcH);
    ctx1.restore();

    // Draw photo on top
    ctx1.drawImage(img, photoX, photoY, srcW, srcH);

    // Dark edge rule
    ctx1.strokeStyle = '#1A1A1A';
    ctx1.lineWidth = Math.max(1, Math.round(ruleLineWidth / 2));
    ctx1.strokeRect(photoX, photoY, srcW, srcH);

  } else if (style === 2) {
    // Style 2: High Contrast Line Art (Dark inner rule line + outer mat)
    ctx1.drawImage(img, photoX, photoY, srcW, srcH);

    ctx1.strokeStyle = ruleLineColor;
    ctx1.lineWidth = ruleLineWidth;
    ctx1.strokeRect(
      photoX - ruleLineWidth / 2,
      photoY - ruleLineWidth / 2,
      srcW + ruleLineWidth,
      srcH + ruleLineWidth
    );

  } else if (style === 4) {
    // Style 4: Bold Double Mat (Inner mat reveal + dark gap reveal)
    const revealGap = Math.max(2, Math.round(baseDim * 0.004));
    const innerMatReveal = Math.max(6, Math.round(baseDim * 0.025));

    // Outer Mat is already filled
    // Draw photo
    ctx1.drawImage(img, photoX, photoY, srcW, srcH);

    // Inner mat groove accent line
    const gapColor = isLight ? '#27272A' : '#E4E4E7';
    ctx1.strokeStyle = gapColor;
    ctx1.lineWidth = revealGap;
    ctx1.strokeRect(
      photoX - innerMatReveal,
      photoY - innerMatReveal,
      srcW + innerMatReveal * 2,
      srcH + innerMatReveal * 2
    );

  } else {
    // Style 1, 3, 6: Draw clean image
    ctx1.drawImage(img, photoX, photoY, srcW, srcH);
  }

  // Apply Web-Sharp Filter if requested
  if (settings.doSharpen) {
    // We only sharpen the photo area to preserve smooth clean mat borders!
    const photoCanvas = document.createElement('canvas');
    photoCanvas.width = srcW;
    photoCanvas.height = srcH;
    const pCtx = photoCanvas.getContext('2d', { willReadFrequently: true });
    if (pCtx) {
      pCtx.drawImage(img, 0, 0, srcW, srcH);
      applyUnsharpMask(pCtx, srcW, srcH, isPreview ? 0.5 : 0.7);
      ctx1.drawImage(photoCanvas, photoX, photoY, srcW, srcH);
    }
  }

  // Draw Bottom Mat Caption / Signature if specified
  const captionText = settings.caption?.trim();
  if (captionText) {
    const textColor = isLight ? '#52525B' : '#D4D4D8';
    const fontSize = Math.max(12, Math.round(baseDim * 0.016));
    
    ctx1.save();
    ctx1.fillStyle = textColor;
    ctx1.font = `500 ${fontSize}px ${settings.fontFamily || 'sans-serif'}`;
    ctx1.textAlign = 'center';
    ctx1.textBaseline = 'middle';

    // Position in lower bottom margin
    const textY = stage1H - bottomMargin / 2;
    ctx1.fillText(captionText, stage1W / 2, textY);
    ctx1.restore();
  }

  // Pass 2: Canvas Aspect Ratio Extent (Center image inside target aspect ratio)
  if (settings.aspectChoice === 0) {
    return stage1Canvas;
  }

  // Calculate target aspect ratio
  let targetRatio = 1.0;
  if (settings.aspectChoice === 1) targetRatio = 1.0; // 1:1
  else if (settings.aspectChoice === 2) targetRatio = 4.0 / 5.0; // 4:5
  else if (settings.aspectChoice === 3) targetRatio = 16.0 / 9.0; // 16:9
  else if (settings.aspectChoice === 4) targetRatio = 9.0 / 16.0; // 9:16

  const currentRatio = stage1W / stage1H;
  let finalW = stage1W;
  let finalH = stage1H;

  if (currentRatio > targetRatio) {
    // Wider than target ratio: expand height
    finalW = stage1W;
    finalH = Math.round(stage1W / targetRatio);
  } else {
    // Taller than target ratio: expand width
    finalW = Math.round(stage1H * targetRatio);
    finalH = stage1H;
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalW;
  finalCanvas.height = finalH;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) return stage1Canvas;

  // Fill with mat color
  finalCtx.fillStyle = settings.matColor;
  finalCtx.fillRect(0, 0, finalW, finalH);

  // Center stage 1 inside final canvas
  const offsetX = Math.round((finalW - stage1W) / 2);
  const offsetY = Math.round((finalH - stage1H) / 2);
  finalCtx.drawImage(stage1Canvas, offsetX, offsetY);

  return finalCanvas;
}

/**
 * Exports canvas to Blob
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string = 'image/jpeg',
  quality: number = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas blob generation failed'));
      },
      format,
      quality
    );
  });
}
