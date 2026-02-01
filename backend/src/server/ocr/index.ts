import { exec } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface OCRResult {
  text: string;
  confidence?: number;
}

export interface PreprocessOptions {
  grayscale?: boolean;
  threshold?: number;
  denoise?: boolean;
  resize?: number;
}

/**
 * Preprocess image for better OCR results using Sharp
 */
export async function preprocessImage(
  inputPath: string,
  options: PreprocessOptions = {}
): Promise<string> {
  const {
    grayscale = true,
    threshold = 128,
    denoise = true,
    resize = 3000  // Increased from 2000 for better quality
  } = options;
  
  const outputPath = inputPath.replace(/\.(jpg|jpeg|png)$/i, '_processed.png');
  
  let pipeline = sharp(inputPath);
  
  // Resize if image is too large (larger size = better quality)
  pipeline = pipeline.resize(resize, resize, {
    fit: 'inside',
    withoutEnlargement: true
  });
  
  // Convert to grayscale
  if (grayscale) {
    pipeline = pipeline.grayscale();
  }
  
  // Apply threshold for better contrast
  pipeline = pipeline.threshold(threshold);
  
  // Denoise (stronger denoising)
  if (denoise) {
    pipeline = pipeline.median(5);  // Increased from 3
  }
  
  // Sharpen (more aggressive)
  pipeline = pipeline.sharpen({
    sigma: 1.5,
    m1: 1.0,
    m2: 0.7
  });
  
  await pipeline.toFile(outputPath);
  
  return outputPath;
}

/**
 * Run Tesseract OCR on an image file
 */
export async function runTesseract(
  imagePath: string,
  lang: string = 'eng',
  psm: number = 3
): Promise<OCRResult> {
  const tesseractPath = process.env.TESSERACT_PATH || 'tesseract';
  
  try {
    // Create temp output file
    const outputBase = path.join(path.dirname(imagePath), 'temp_ocr');
    
    // Run tesseract with PSM mode and better quality settings
    // PSM modes: 3 = auto (default), 6 = uniform block of text, 11 = sparse text
    const command = `${tesseractPath} "${imagePath}" "${outputBase}" -l ${lang} --psm ${psm} --oem 1`;
    await execAsync(command);
    
    // Read output
    const outputFile = `${outputBase}.txt`;
    const text = await fs.readFile(outputFile, 'utf8');
    
    // Cleanup temp file
    await fs.unlink(outputFile).catch(() => {});
    
    return {
      text: text.trim(),
      confidence: undefined
    };
  } catch (error: any) {
    throw new Error(`Tesseract OCR failed: ${error.message}`);
  }
}

/**
 * Extract text from image with preprocessing
 */
export async function extractTextFromImage(
  imagePath: string,
  options: PreprocessOptions = {}
): Promise<string> {
  try {
    // Preprocess image
    const processedPath = await preprocessImage(imagePath, options);
    
    // Run OCR
    const result = await runTesseract(processedPath);
    
    // Cleanup processed image
    await fs.unlink(processedPath).catch(() => {});
    
    return result.text;
  } catch (error: any) {
    throw new Error(`OCR extraction failed: ${error.message}`);
  }
}

/**
 * Parse beer names from OCR text
 * Simple heuristic: look for lines that might contain beer names
 */
export function parseBeerNames(text: string): string[] {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  
  const beerNames: string[] = [];
  
  for (const line of lines) {
    // Skip lines that are too short or too long
    if (line.length < 3 || line.length > 100) continue;
    
    // Skip lines that look like headers, prices, or descriptions
    if (/^[\d\s.$€£]+$/.test(line)) continue;
    if (/^(beer|ale|ipa|stout|lager|pilsner)s?$/i.test(line)) continue;
    
    // Look for patterns that suggest beer names
    // - Contains brand/brewery-like capitalized words
    // - Might contain ABV percentage
    // - Might have beer style keywords
    const hasCapital = /[A-Z]/.test(line);
    const hasAbv = /\d+\.?\d*\s*%/.test(line);
    const hasBeerStyle = /(ipa|stout|ale|lager|pilsner|wheat|porter|saison)/i.test(line);
    
    if (hasCapital && (hasAbv || hasBeerStyle || line.split(' ').length <= 5)) {
      // Clean up the line
      let cleanName = line
        .replace(/\d+\.?\d*\s*%/, '') // Remove ABV
        .replace(/\$\d+/, '') // Remove prices
        .replace(/[\d.]+\s*(oz|ml)/i, '') // Remove volume
        .trim();
      
      if (cleanName.length >= 3) {
        beerNames.push(cleanName);
      }
    }
  }
  
  return beerNames;
}
