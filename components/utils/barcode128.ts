/**
 * Utility to generate and download a beautifully styled Member Card (Kartu Tanda Anggota)
 * featuring a client-side vector-perfect Code 128 barcode.
 * No external dependencies required.
 */

import { AbsensiMember } from '../../types';

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "312212", "321122", "321211", "312211", "322111", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211312", // 30-39
  "231112", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232"                                         // 100-105
];

const STOP_PATTERN = "2331112";

/**
 * Returns a boolean array of widths (true for Bar, false for Space) representing Code 128 B string
 */
export function getCode128Binary(text: string): boolean[] {
  const code: boolean[] = [];
  
  // Start Code B (index 104)
  const startPattern = CODE128_PATTERNS[104];
  appendPattern(code, startPattern);
  
  let checksum = 104;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const charIndex = charCode - 32;
    if (charIndex >= 0 && charIndex <= 102) {
      appendPattern(code, CODE128_PATTERNS[charIndex]);
      checksum += charIndex * (i + 1);
    }
  }
  
  const checkIndex = checksum % 103;
  appendPattern(code, CODE128_PATTERNS[checkIndex]);
  appendPattern(code, STOP_PATTERN);
  
  return code;
}

function appendPattern(code: boolean[], pattern: string) {
  let isBar = true;
  for (let i = 0; i < pattern.length; i++) {
    const width = parseInt(pattern[i], 10);
    for (let w = 0; w < width; w++) {
      code.push(isBar);
    }
    isBar = !isBar;
  }
}

/**
 * Creates and downloads a high-quality Member Card (Kartu Tanda Anggota) with barcode
 */
export function downloadMemberCard(member: AbsensiMember) {
  const canvas = document.createElement('canvas');
  // Dimensions for standard rounded card ratio
  canvas.width = 650;
  canvas.height = 390;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Draw elegant, clean card background
  // Slate background with a touch of gradient depth
  const isLaki = member.jenis_kelamin?.toLowerCase() === 'laki-laki';
  const startColor = isLaki ? '#1e3a8a' : '#9f1239'; // Blue-900 / Rose-900
  const endColor = isLaki ? '#1e1b4b' : '#4c0519'; // Indigo-950 / Rose-950
  
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Decorative vector circles for aesthetic texture
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.beginPath();
  ctx.arc(canvas.width - 50, 50, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(50, canvas.height - 50, 120, 0, Math.PI * 2);
  ctx.fill();

  // Draw Card Border Frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

  // 2. Draw Header
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 13px "Inter", "Segoe UI", sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('KARTU TANDA ANGGOTA', 40, 50);

  ctx.fillStyle = isLaki ? '#60a5fa' : '#f43f5e'; // Accent color line
  ctx.font = '700 9px "Inter", "Segoe UI", sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('SISTEM UTAMA PRESENSI MANDIRI', 40, 68);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(40, 80, canvas.width - 80, 1.5);

  // 3. Draw Member Details (Left Column)
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 24px "Inter", "Segoe UI", sans-serif';
  ctx.letterSpacing = '0.5px';
  ctx.fillText((member.nama_lengkap || '').toUpperCase(), 40, 122);

  // Meta grid helper
  const drawMetaRow = (label: string, value: string, y: number) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '900 8px "Inter", "Segoe UI", sans-serif';
    ctx.letterSpacing = '1.5px';
    ctx.fillText(label.toUpperCase(), 40, y);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 12px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(value.toUpperCase(), 40, y + 18);
  };

  drawMetaRow('Unit Desa', member.desa_name || '-', 155);
  drawMetaRow('Kelompok', member.kelompok_name || '-', 215);

  // Right Column Meta
  const drawMetaRowRight = (label: string, value: string, y: number) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '900 8px "Inter", "Segoe UI", sans-serif';
    ctx.letterSpacing = '1.5px';
    ctx.fillText(label.toUpperCase(), 360, y);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 12px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(value.toUpperCase(), 360, y + 18);
  };

  drawMetaRowRight('Kategori Usia', member.age_category_name || 'UMUM', 155);
  drawMetaRowRight('Gender', member.jenis_kelamin || '-', 215);

  // 4. Draw Barcode Section (Bottom Aligned, Center Aligned or Right-Aligned)
  // Let's reserve a clean white/light bounding box for perfect scanning readability
  const barcodeBoxWidth = 340;
  const barcodeBoxHeight = 85;
  const barcodeBoxX = (canvas.width - barcodeBoxWidth) / 2;
  const barcodeBoxY = canvas.height - 110;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect?.(barcodeBoxX, barcodeBoxY, barcodeBoxWidth, barcodeBoxHeight, 10);
  ctx.fill();

  // Draw Code 128 Barcode inside the box
  const memberId = String(member.id || '').toUpperCase();
  const binaryBars = getCode128Binary(memberId);
  const totalBarcodeModules = binaryBars.length;

  // Let's determine module size to fit exactly inside the padding
  const barcodePaddingX = 20;
  const drawWidth = barcodeBoxWidth - (barcodePaddingX * 2);
  const moduleWidth = drawWidth / totalBarcodeModules;

  const actualBarcodeX = barcodeBoxX + barcodePaddingX;
  const barcodeY = barcodeBoxY + 12;
  const barcodeHeight = 42;

  ctx.fillStyle = '#1e293b'; // dark barcode lines
  for (let i = 0; i < binaryBars.length; i++) {
    if (binaryBars[i]) {
      ctx.fillRect(actualBarcodeX + (i * moduleWidth), barcodeY, moduleWidth + 0.1, barcodeHeight);
    }
  }

  // Draw Human Readable Text below barcode lines
  ctx.fillStyle = '#334155';
  ctx.font = '900 11px "JetBrains Mono", "Courier New", monospace';
  ctx.letterSpacing = '2px';
  ctx.textAlign = 'center';
  ctx.fillText(memberId, barcodeBoxX + (barcodeBoxWidth / 2), barcodeBoxY + 70);

  // Reset text align for subsequent operations
  ctx.textAlign = 'left';

  // 5. Trigger download (as PNG)
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `KTA_${memberId}_${member.nama_lengkap.replace(/\s+/g, '_')}.png`;
    link.click();
  } catch (err) {
    console.error("Gagal mendownload kartu anggota:", err);
  }
}
