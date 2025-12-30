'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Função para converter hex para RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Função para gerar variações de cor
function generateColorVariations(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  return {
    primary: hex,
    primaryRgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    primaryLight: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
    primaryMedium: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
    primaryDark: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`,
  };
}

// Função para extrair cor dominante de uma imagem
async function extractColorFromImage(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        // Reduzir tamanho para performance
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size).data;
        
        // Contar cores (ignorando branco, preto e tons muito claros/escuros)
        const colorCounts: { [key: string]: number } = {};
        
        for (let i = 0; i < imageData.length; i += 4) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          const a = imageData[i + 3];
          
          // Ignorar pixels transparentes
          if (a < 128) continue;
          
          // Ignorar cores muito claras (branco) ou muito escuras (preto)
          const brightness = (r + g + b) / 3;
          if (brightness > 240 || brightness < 15) continue;
          
          // Ignorar tons de cinza
          const saturation = Math.max(r, g, b) - Math.min(r, g, b);
          if (saturation < 30) continue;
          
          // Quantizar para reduzir variações
          const qr = Math.round(r / 32) * 32;
          const qg = Math.round(g / 32) * 32;
          const qb = Math.round(b / 32) * 32;
          
          const key = `${qr},${qg},${qb}`;
          colorCounts[key] = (colorCounts[key] || 0) + 1;
        }
        
        // Encontrar cor mais frequente
        let maxCount = 0;
        let dominantColor = null;
        
        for (const [color, count] of Object.entries(colorCounts)) {
          if (count > maxCount) {
            maxCount = count;
            dominantColor = color;
          }
        }
        
        if (dominantColor) {
          const [r, g, b] = dominantColor.split(',').map(Number);
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          resolve(hex);
        } else {
          resolve(null);
        }
      } catch (error) {
        console.error('Erro ao extrair cor:', error);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      resolve(null);
    };
    
    img.src = imageUrl;
  });
}

export function useThemeColor() {
  const [primaryColor, setPrimaryColor] = useState('#4f46e5'); // Indigo padrão
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadThemeColor() {
      try {
        const { data } = await supabase
          .from('app_config')
          .select('primary_color, logo_url')
          .single();

        if (data) {
          // Se tem cor definida manualmente, usar ela
          if (data.primary_color && data.primary_color !== '#4f46e5') {
            setPrimaryColor(data.primary_color);
            applyThemeColor(data.primary_color);
          } 
          // Senão, tentar extrair da logo
          else if (data.logo_url) {
            const extractedColor = await extractColorFromImage(data.logo_url);
            if (extractedColor) {
              setPrimaryColor(extractedColor);
              applyThemeColor(extractedColor);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar cor do tema:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadThemeColor();
  }, []);

  return { primaryColor, isLoading };
}

// Aplicar cor no CSS
export function applyThemeColor(color: string) {
  const variations = generateColorVariations(color);
  if (!variations) return;

  const root = document.documentElement;
  root.style.setProperty('--primary-color', variations.primary);
  root.style.setProperty('--primary-rgb', variations.primaryRgb);
  root.style.setProperty('--primary-light', variations.primaryLight);
  root.style.setProperty('--primary-medium', variations.primaryMedium);
  root.style.setProperty('--primary-dark', variations.primaryDark);
}

export { extractColorFromImage, generateColorVariations };
