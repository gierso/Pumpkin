export interface PumpkinParams {
  // Body settings
  radius: number; // in mm, e.g. 50mm (100mm diameter)
  heightScale: number; // 0.6 = squashed Cinderella, 1.2 = tall
  ribCount: number; // number of ribs/lobes (e.g. 8 to 14)
  ribDepth: number; // 0 to 0.5 (depth of grooves between ribs)
  ribSharpness: number; // shape exponent of the ribs
  asymmetry: number; // 0 to 0.4 (organic natural variation)
  skinRoughness: number; // 0 to 0.2 (warty / micro-bump texture)
  skinFrequency: number; // noise scale
  
  // Base settings (Placa de impresión)
  flatBaseDiameter: number; // mm diameter of flat bottom contact (e.g. 40mm)
  flatBaseChamfer: number; // transition smooth bevel to prevent elephant foot and sharp stresses
  addBrim: boolean; // include adhesion brim ring in preview/export
  brimWidth: number; // mm width of adhesion brim (e.g. 5mm)

  // Hollow / Interior
  isHollow: boolean; // hollow for LED tea light / lighter print
  wallThickness: number; // mm (e.g. 2.4mm)
  bottomHoleDiameter: number; // mm hole in bottom if hollow (e.g. 25mm for LED)

  // Detailed Stem settings
  stemLength: number; // mm
  stemBaseRadius: number; // mm
  stemTipRadius: number; // mm
  stemCurvature: number; // angle of natural bend
  stemTwist: number; // spiral twist rotations
  stemRibs: number; // number of flute ridges along stem (5-8)
  stemRoughness: number; // bark/fibrous roughness
  stemTiltAngle: number; // degrees tilt direction

  // Resolution
  segmentsRadial: number;
  segmentsHeight: number;
}

export interface SupportSettings {
  enabled: boolean;
  type: 'tree' | 'pillar' | 'conical';
  overhangThresholdAngle: number; // degrees (default 45° or 50°)
  contactPointDiameter: number; // mm tip contact size (0.6mm breakaway)
  branchDiameter: number; // mm pillar base (2.5mm - 4.0mm)
  supportDensity: number; // spacing between support pillars
  showOverhangMap: boolean; // highlight critical overhangs in red
  exportWithSupports: boolean; // bake into STL export
}

export interface PrintSettings {
  layerHeight: number; // mm (0.16, 0.20, 0.28)
  infillPercent: number; // % (10%, 15%, 20%)
  wallPerimeters: number; // (2, 3, 4)
  printSpeed: number; // mm/s (50, 80, 150)
  filamentType: 'PLA' | 'PETG' | 'ABS' | 'RESIN';
  bedSizeX: number; // 220 mm
  bedSizeY: number; // 220 mm
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  iconName: string;
  params: Partial<PumpkinParams>;
  supports: Partial<SupportSettings>;
}

export type AppMode = 'station' | 'classic';
export type StationViewMode = 'assembled' | 'cutaway' | 'lid-off' | 'exploded' | 'solo-part';
export type StationPartId = 
  | 'all' 
  | 'container' 
  | 'lid' 
  | 'shaker-stem' 
  | 'shaker-cap' 
  | 'coasters' 
  | 'spoons' 
  | 'tpu-base';

export interface OrganizerStationParams {
  wallThickness: number; // mm (2.8 - 3.5mm for self-supporting hollow container)
  lidSplitHeightPercent: number; // 65 - 75% height where pumpkin splits into container & lid
  lidTolerance: number; // 0.3 - 0.5 mm slip fit for 3D printing
  lidLipHeight: number; // 3.5 - 6.0 mm interlocking stepped rim
  
  // Coasters cylinder
  coasterDiameter: number; // mm (80 - 92mm standard coasters)
  coasterCount: number; // 4 to 6 coasters
  coasterThickness: number; // mm (3.2mm each)
  coasterFingerCutoutWidth: number; // mm (30 - 38mm finger notch)
  
  // Dividers for Tea, Sugar, Creamers
  dividerThickness: number; // mm (2.0 - 2.5mm)
  dividerHeightPercent: number; // 75 - 90% of cavity height
  
  // Lid & Leaf Handle
  leafCount: number; // 2 or 3 curling pumpkin leaves
  leafSpan: number; // mm width of leaf handle
  leafArchHeight: number; // mm clearance under leaves to grab as handle
  
  // Dual-Function Spice Shaker Stem
  shakerStemEnabled: boolean;
  shakerChamberRadius: number; // mm internal spice chamber
  shakerHoleCount: number; // 1, 3, 5, or 7 spice dispensing holes
  shakerHoleDiameter: number; // mm
  shakerThreadPitch: number; // mm
  shakerThreadDiameter: number; // mm
  
  // 2 Thematic Spoons
  spoonLength: number; // mm
  spoonSlotAngle: number; // angle on lid rim
  
  // TPU Base non-slip mat
  tpuThickness: number; // mm
  tpuLipBevel: number; // mm
  tpuPatternRings: number; // concentric anti-slip tread rings
}
