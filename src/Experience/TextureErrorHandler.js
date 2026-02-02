/**
 * TextureErrorHandler.js
 * Comprehensive error handling for KTX2 texture loading in Three.js
 */

import * as THREE from 'three';

export default class TextureErrorHandler {
  constructor(resources) {
    this.resources = resources;
    this.errors = [];
    this.warnings = [];
    this.fallbackTextures = new Map();
    
    // Setup error listeners
    this.setupErrorListeners();
  }

  setupErrorListeners() {
    // Capture WebGL errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (args[0]?.includes('WebGL') || args[0]?.includes('THREE')) {
        this.logError('WebGL/THREE Error', args.join(' '));
      }
      originalConsoleError.apply(console, args);
    };

    // Capture warnings
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
      if (args[0]?.includes('THREE') || args[0]?.includes('KTX2')) {
        this.logWarning('THREE/KTX2 Warning', args.join(' '));
      }
      originalConsoleWarn.apply(console, args);
    };
  }

  /**
   * Validate and fix KTX2 texture dimensions
   * KTX2 requires dimensions to be multiples of 4
   */
  validateTextureDimensions(texture, name) {
    if (!texture.image) {
      this.logWarning(`No image data for texture: ${name}`);
      return false;
    }

    const { width, height } = texture.image;
    
    if (width % 4 !== 0 || height % 4 !== 0) {
      this.logError(
        `Invalid dimensions for ${name}`,
        `Size ${width}x${height} is not multiple of 4. KTX2 requires multiple-of-four dimensions.`
      );
      return false;
    }

    return true;
  }

  /**
   * Fix sRGB texture format issues
   * sRGB textures require RGBAFormat and UnsignedByteType
   */
  fixTextureFormat(texture, colorSpace = THREE.SRGBColorSpace) {
    try {
      // For sRGB textures
      if (colorSpace === THREE.SRGBColorSpace || colorSpace === 'srgb') {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.format = THREE.RGBAFormat;
        texture.type = THREE.UnsignedByteType;
      } 
      // For Linear textures
      else if (colorSpace === THREE.LinearSRGBColorSpace) {
        texture.colorSpace = THREE.LinearSRGBColorSpace;
        texture.format = THREE.RGBAFormat;
        texture.type = THREE.UnsignedByteType;
      }

      texture.needsUpdate = true;
      return true;
    } catch (error) {
      this.logError('Format Fix Failed', error.message);
      return false;
    }
  }

  /**
   * Create fallback texture when loading fails
   */
  createFallbackTexture(name, color = 0x808080) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; // Multiple of 4
    canvas.height = 512;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 512, 512);
    
    // Add text indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Fallback: ${name}`, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    
    this.fallbackTextures.set(name, texture);
    this.logWarning(`Created fallback texture for: ${name}`);
    
    return texture;
  }

  /**
   * Safe texture loader with error handling
   */
  async loadTextureSafe(name, source, type, loader) {
    try {
      const texture = await new Promise((resolve, reject) => {
        loader.load(
          source,
          (loadedTexture) => resolve(loadedTexture),
          undefined,
          (error) => reject(error)
        );
      });

      // Validate and fix texture
      if (type === 'texture') {
        this.fixTextureFormat(texture);
        
        // Check dimensions after load
        texture.image?.addEventListener?.('load', () => {
          this.validateTextureDimensions(texture, name);
        });
      }

      return texture;
      
    } catch (error) {
      this.logError(`Failed to load ${name}`, error.message);
      return this.createFallbackTexture(name);
    }
  }

  /**
   * Fix existing texture issues
   */
  fixExistingTexture(texture, name, expectedColorSpace = THREE.SRGBColorSpace) {
    if (!texture) {
      this.logError(`Texture ${name} is null or undefined`);
      return this.createFallbackTexture(name);
    }

    try {
      // Fix color space and format
      this.fixTextureFormat(texture, expectedColorSpace);

      // Ensure proper settings
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      return texture;
      
    } catch (error) {
      this.logError(`Failed to fix texture ${name}`, error.message);
      return this.createFallbackTexture(name);
    }
  }

  /**
   * Batch fix all textures in resources
   */
  fixAllTextures(resourceItems) {
    const fixed = [];
    const failed = [];

    for (const [name, item] of Object.entries(resourceItems)) {
      if (item instanceof THREE.Texture) {
        try {
          // Determine expected color space based on naming
          const isLinear = name.toLowerCase().includes('normal') || 
                          name.toLowerCase().includes('roughness') ||
                          name.toLowerCase().includes('metalness');
          
          const colorSpace = isLinear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
          
          this.fixExistingTexture(item, name, colorSpace);
          fixed.push(name);
          
        } catch (error) {
          failed.push({ name, error: error.message });
        }
      }
    }

    console.log(`✅ Fixed ${fixed.length} textures`);
    if (failed.length > 0) {
      console.warn(`⚠️ Failed to fix ${failed.length} textures:`, failed);
    }

    return { fixed, failed };
  }

  /**
   * Log error with details
   */
  logError(type, message) {
    const error = {
      type,
      message,
      timestamp: new Date().toISOString()
    };
    this.errors.push(error);
    console.error(`[TextureError] ${type}: ${message}`);
  }

  /**
   * Log warning
   */
  logWarning(type, message) {
    const warning = {
      type,
      message,
      timestamp: new Date().toISOString()
    };
    this.warnings.push(warning);
    console.warn(`[TextureWarning] ${type}: ${message}`);
  }

  /**
   * Get error report
   */
  getErrorReport() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      fallbacksCreated: Array.from(this.fallbackTextures.keys()),
      totalIssues: this.errors.length + this.warnings.length
    };
  }

  /**
   * Display error report in console
   */
  printReport() {
    console.group('🔍 Texture Error Report');
    console.log(`Total Errors: ${this.errors.length}`);
    console.log(`Total Warnings: ${this.warnings.length}`);
    console.log(`Fallbacks Created: ${this.fallbackTextures.size}`);
    
    if (this.errors.length > 0) {
      console.group('❌ Errors:');
      this.errors.forEach(e => console.error(`${e.type}: ${e.message}`));
      console.groupEnd();
    }
    
    if (this.warnings.length > 0) {
      console.group('⚠️ Warnings:');
      this.warnings.forEach(w => console.warn(`${w.type}: ${w.message}`));
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  /**
   * Clear all errors and warnings
   */
  clearReport() {
    this.errors = [];
    this.warnings = [];
  }
}
