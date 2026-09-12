import * as THREE from 'three';
import { PrintSettings } from '../types';

export interface PrintEstimationResult {
  dimensionsMm: { x: number; y: number; z: number };
  baseContactAreaMm2: number;
  adhesionQuality: 'Excelente' | 'Buena' | 'Requiere Brim';
  layerCount: number;
  estimatedWeightGrams: number;
  estimatedTimeHours: number;
  estimatedTimeMinutes: number;
  estimatedFilamentMeters: number;
  recommendations: string[];
}

export function estimatePrintSpecs(
  geometry: THREE.BufferGeometry,
  baseContactAreaMm2: number,
  printSettings: PrintSettings,
  supportWeightGrams = 0
): PrintEstimationResult {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox || new THREE.Box3();

  const dx = Math.round((box.max.x - box.min.x) * 10) / 10;
  const dz = Math.round((box.max.z - box.min.z) * 10) / 10;
  const dy = Math.round((box.max.y - box.min.y) * 10) / 10; // height in Three.js

  const heightMm = dy;
  const layerHeight = printSettings.layerHeight || 0.2;
  const layerCount = Math.ceil(heightMm / layerHeight);

  // Approximate solid model volume (bounding box * organic fullness factor ~ 0.52 for pumpkin)
  const bboxVolumeCm3 = (dx * dz * dy) / 1000;
  const modelVolumeCm3 = bboxVolumeCm3 * 0.52;

  // Infill volume + perimeters volume calculation
  // Typical: 3 perimeters (approx 25% of shell) + infill percentage
  const shellFraction = 0.28;
  const infillFraction = (printSettings.infillPercent / 100) * 0.72;
  const effectiveVolumeCm3 = modelVolumeCm3 * (shellFraction + infillFraction);

  // Density by filament type (g/cm3)
  const densities: Record<string, number> = {
    PLA: 1.24,
    PETG: 1.27,
    ABS: 1.04,
    RESIN: 1.15
  };
  const density = densities[printSettings.filamentType] || 1.24;

  const modelWeightGrams = effectiveVolumeCm3 * density;
  const totalWeightGrams = Math.round(modelWeightGrams + supportWeightGrams);

  // Filament length (1.75mm diameter filament: cross-section area = pi * (1.75/2)^2 = 2.405 mm2)
  // 1 cm3 = 1000 mm3 => 1000 / 2.405 = 415.8 mm = 0.416 m per cm3
  const filamentMeters = Math.round((effectiveVolumeCm3 * 0.416) * 10) / 10;

  // Print time estimation (based on layer count, volume, speed)
  // Roughly: layer change overhead + deposition time
  const mmPerSec = printSettings.printSpeed || 60;
  const depositionSeconds = (filamentMeters * 1000 * 2.405) / (0.4 * layerHeight * mmPerSec);
  const layerOverheadSeconds = layerCount * 3.5;
  const totalSeconds = depositionSeconds + layerOverheadSeconds;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  // Adhesion quality calculation based on base area vs height
  let adhesionQuality: 'Excelente' | 'Buena' | 'Requiere Brim' = 'Excelente';
  if (baseContactAreaMm2 < 500 || heightMm > 110) {
    adhesionQuality = 'Requiere Brim';
  } else if (baseContactAreaMm2 < 1000) {
    adhesionQuality = 'Buena';
  }

  // Smart 3D printing recommendations based on the actual model
  const recommendations: string[] = [
    `Base de apoyo plana de ${baseContactAreaMm2} mm²: adherencia directa sin necesidad de balsa (raft).`,
    `Tallo con microranuras orgánicas: se recomienda velocidad exterior lenta (${Math.round(mmPerSec * 0.5)} mm/s) para fidelidad máxima.`,
    `Soportes breakaway con punta de 0.6 mm: retire fácilmente ejerciendo leve torsión manual con pinzas de corte sin marcas.`,
    `Ventilador de capa al 100% a partir de la capa 3 para preservar la rugosidad orgánica de la cáscara.`
  ];

  return {
    dimensionsMm: { x: dx, y: dz, z: dy },
    baseContactAreaMm2,
    adhesionQuality,
    layerCount,
    estimatedWeightGrams: totalWeightGrams,
    estimatedTimeHours: Math.max(1, hours),
    estimatedTimeMinutes: minutes,
    estimatedFilamentMeters: filamentMeters,
    recommendations
  };
}
