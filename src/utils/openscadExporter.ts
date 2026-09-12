import * as THREE from 'three';
import { GeneratedPumpkinModel } from './pumpkinGeometry';
import { GeneratedSupportResult } from './supportGenerator';
import { PumpkinParams, SupportSettings, OrganizerStationParams } from '../types';
import { OrganizerStationModel } from './stationGeometry';

export interface OpenSCADExportOptions {
  pumpkinModel: GeneratedPumpkinModel;
  supportResult?: GeneratedSupportResult;
  pumpkinParams: PumpkinParams;
  supportSettings?: SupportSettings;
  includeSupports?: boolean;
  filename?: string;
  stationModel?: OrganizerStationModel;
  organizerParams?: OrganizerStationParams;
  isStationMode?: boolean;
}

/**
 * Formats a THREE.BufferGeometry into an OpenSCAD polyhedron module.
 * 
 * Coordinates:
 * Converts Three.js coordinates (X, Y=up, Z) into standard 3D printing & OpenSCAD coordinates:
 * - X -> X
 * - Y -> Z (Up)
 * - Z -> -Y
 * 
 * Normals & Winding Order:
 * In Three.js, front faces are Counter-Clockwise (CCW).
 * In OpenSCAD, polyhedron faces MUST be listed in Clockwise (CW) order when viewed from the outside
 * (Left-hand thumb rule pointing outwards).
 * Therefore, we reverse the triangle indices from [iA, iB, iC] to [iA, iC, iB] to guarantee 
 * perfect manifold solid geometry in OpenSCAD and CGAL render (F6).
 */
function geometryToOpenSCADPolyhedron(
  geometry: THREE.BufferGeometry,
  moduleName: string,
  title: string
): string {
  const posAttr = geometry.getAttribute('position');
  const indexAttr = geometry.index;

  if (!posAttr) {
    return `// Error: La geometría para ${moduleName} no contiene datos de posición.\nmodule ${moduleName}() {}\n\n`;
  }

  const vertexCount = posAttr.count;
  const triangleCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

  const parts: string[] = [];
  parts.push(`// ==============================================================================\n`);
  parts.push(`// ${title}\n`);
  parts.push(`// Vértices: ${vertexCount} | Triángulos: ${triangleCount}\n`);
  parts.push(`// ==============================================================================\n`);
  parts.push(`module ${moduleName}() {\n`);
  parts.push(`    points = [\n`);

  // Stream vertices with 3-decimal precision (Math.round for clean output without trailing noise)
  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    // Three.js (x, y=up, z) -> OpenSCAD (x, y=-z, z=y)
    const px = Math.round(x * 1000) / 1000;
    const py = Math.round((-z) * 1000) / 1000;
    const pz = Math.round(y * 1000) / 1000;

    parts.push(`        [${px}, ${py}, ${pz}]${i < vertexCount - 1 ? ',' : ''}\n`);
  }

  parts.push(`    ];\n\n`);
  parts.push(`    faces = [\n`);

  // Face winding order: reverse [iA, iB, iC] -> [iA, iC, iB] for OpenSCAD's CW outward rule
  if (indexAttr) {
    for (let i = 0; i < triangleCount; i++) {
      const iA = indexAttr.getX(i * 3);
      const iB = indexAttr.getX(i * 3 + 1);
      const iC = indexAttr.getX(i * 3 + 2);
      parts.push(`        [${iA}, ${iC}, ${iB}]${i < triangleCount - 1 ? ',' : ''}\n`);
    }
  } else {
    for (let i = 0; i < triangleCount; i++) {
      const iA = i * 3;
      const iB = i * 3 + 1;
      const iC = i * 3 + 2;
      parts.push(`        [${iA}, ${iC}, ${iB}]${i < triangleCount - 1 ? ',' : ''}\n`);
    }
  }

  parts.push(`    ];\n\n`);
  parts.push(`    polyhedron(points = points, faces = faces, convexity = 10);\n`);
  parts.push(`}\n\n`);

  return parts.join('');
}

/**
 * Generates clean, well-documented OpenSCAD (.scad) source code
 * representing the organic pumpkin model with modular body, stem, and optional supports.
 */
export function generateOpenSCADScript(options: OpenSCADExportOptions): string {
  const {
    pumpkinModel,
    supportResult,
    pumpkinParams,
    supportSettings,
    includeSupports = false,
    stationModel,
    organizerParams,
    isStationMode = false
  } = options;

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // If Station Mode: Generate complete modular station script
  if (isStationMode && stationModel) {
    const header: string[] = [
      `/*`,
      ` ==============================================================================`,
      `  ESTACIÓN CAFETERA & ORGANIZADOR DE TÉ EN FORMA DE CALABAZA ORGÁNICA`,
      `  Archivo Paramétrico Modular para OpenSCAD (.scad)`,
      `  Generado: ${timestamp} UTC`,
      `  `,
      `  Módulos Incluidos:`,
      `  1. calabaza_contenedor_base()  : Contenedor hueco con torre cilíndrica para coasters`,
      `                                   (con escotadura para dedos) y 3 separadores radiales`,
      `                                   para bolsitas de té, sobres de azúcar y creamers.`,
      `  2. tapa_calabaza()             : Tapa retirable con labio concéntrico escalonado de 0.35mm`,
      `                                   de tolerancia y ranuras para 2 cucharitas.`,
      `  3. hojas_manija()              : Hojas de calabaza esculpidas como manija de agarre.`,
      `  4. tallo_salero_especiero()    : Tallo estriado hueco desmontable con orificios dosificadores`,
      `                                   en la punta para canela/especias/sal.`,
      `  5. tapita_salero()             : Tapita roscada moleteada para recarga de especias.`,
      `  6. posavasos_set()             : Set de posavasos con relieve orgánico de calabaza (Ø ${organizerParams?.coasterDiameter || 85}mm).`,
      `  7. cucharitas_par()            : 2 cucharitas temáticas con mango de zarcillo/enredadera.`,
      `  8. base_antideslizante_tpu()   : Almohadilla flexible para imprimir en TPU (Ø ${pumpkinParams.flatBaseDiameter}mm).`,
      `  `,
      `  Atajos de OpenSCAD:`,
      `  - [F5]: Vista Previa Rápida con colores`,
      `  - [F6]: Renderizado Sólido CGAL (permite exportar cualquier pieza individualmente o en conjunto)`,
      ` ==============================================================================`,
      `*/\n`,
      `// --- CONTROLES DE VISIBILIDAD DE PIEZAS (true / false) ---`,
      `mostrar_contenedor     = true;   // Cuerpo hueco con separadores y cilindro`,
      `mostrar_tapa           = true;   // Tapa superior retirable`,
      `mostrar_hojas_manija   = true;   // Hojas manija ergonómicas`,
      `mostrar_tallo_salero   = true;   // Tallo salero / especiero`,
      `mostrar_tapita_salero  = true;   // Tapa roscada del salero`,
      `mostrar_posavasos      = true;   // Set de posavasos (coasters)`,
      `mostrar_cucharitas     = true;   // 2 cucharitas de mezcla`,
      `mostrar_base_tpu       = true;   // Almohadilla antideslizante en TPU`,
      `vista_explosionada     = false;  // Separar piezas verticalmente en Z`,
      `render_colores         = $preview; // Colores en F5, sólidos en F6\n`,
      `// Paleta de colores para vista previa`,
      `color_cuerpo   = [0.94, 0.44, 0.08, 1.0];   // Naranja calabaza`,
      `color_tapa     = [0.98, 0.52, 0.12, 1.0];   // Naranja cálido`,
      `color_hojas    = [0.24, 0.58, 0.28, 1.0];   // Verde hoja botánico`,
      `color_tallo    = [0.38, 0.48, 0.22, 1.0];   // Verde tallo leñoso`,
      `color_tapita   = [0.32, 0.40, 0.20, 1.0];   // Tapa salero`,
      `color_coasters = [0.85, 0.72, 0.52, 1.0];   // Madera / corcho tostado`,
      `color_cucharas = [0.45, 0.70, 0.35, 1.0];   // Verde zarcillo`,
      `color_tpu      = [0.12, 0.12, 0.14, 0.9];   // Goma TPU negro carbón`,
      `\n`
    ];

    const mContainer = geometryToOpenSCADPolyhedron(stationModel.containerGeometry, 'calabaza_contenedor_base', 'Módulo: Contenedor Base Hueco con Separadores & Cilindro de Coasters');
    const mLid = geometryToOpenSCADPolyhedron(stationModel.lidGeometry, 'tapa_calabaza', 'Módulo: Tapa de Calabaza con Labio Escalonado');
    const mLeaves = geometryToOpenSCADPolyhedron(stationModel.leafHandleGeometry, 'hojas_manija', 'Módulo: Hojas de Calabaza (Manija Ergonómica)');
    const mShaker = geometryToOpenSCADPolyhedron(stationModel.shakerStemGeometry, 'tallo_salero_especiero', 'Módulo: Tallo Salero Especiero con Orificios Dosificadores');
    const mCap = geometryToOpenSCADPolyhedron(stationModel.shakerCapGeometry, 'tapita_salero', 'Módulo: Tapita Roscada del Salero');
    const mCoasters = geometryToOpenSCADPolyhedron(stationModel.coastersGeometry, 'posavasos_set', 'Módulo: Set de Posavasos Circulares');
    const mSpoons = geometryToOpenSCADPolyhedron(stationModel.spoonsGeometry, 'cucharitas_par', 'Módulo: 2 Cucharitas para Café y Té');
    const mTpu = geometryToOpenSCADPolyhedron(stationModel.tpuBaseGeometry, 'base_antideslizante_tpu', 'Módulo: Almohadilla de Base en TPU');

    const assembly: string[] = [
      `// ==============================================================================`,
      `// ENSAMBLAJE DE LA ESTACIÓN CAFETERA & TÉ`,
      `// ==============================================================================`,
      `module estacion_cafetera() {`,
      `    offset_tpu       = vista_explosionada ? -20 : 0;`,
      `    offset_tapa      = vista_explosionada ? 45 : 0;`,
      `    offset_hojas     = vista_explosionada ? 65 : 0;`,
      `    offset_salero    = vista_explosionada ? 95 : 0;`,
      `    offset_cucharas  = vista_explosionada ? 75 : 0;`,
      `    offset_coasters  = vista_explosionada ? 35 : 0;`,
      `    `,
      `    if (render_colores) {`,
      `        // Vista previa coloreada (F5)`,
      `        if (mostrar_base_tpu) translate([0, 0, offset_tpu]) color(color_tpu) base_antideslizante_tpu();`,
      `        if (mostrar_contenedor) color(color_cuerpo) calabaza_contenedor_base();`,
      `        if (mostrar_posavasos) translate([0, 0, offset_coasters]) color(color_coasters) posavasos_set();`,
      `        if (mostrar_tapa) translate([0, 0, offset_tapa]) color(color_tapa) tapa_calabaza();`,
      `        if (mostrar_hojas_manija) translate([0, 0, offset_hojas]) color(color_hojas) hojas_manija();`,
      `        if (mostrar_tallo_salero) translate([0, 0, offset_salero]) color(color_tallo) tallo_salero_especiero();`,
      `        if (mostrar_tapita_salero) translate([0, 0, offset_salero]) color(color_tapita) tapita_salero();`,
      `        if (mostrar_cucharitas) translate([0, 0, offset_cucharas]) color(color_cucharas) cucharitas_par();`,
      `    } else {`,
      `        // Renderizado sólido (F6)`,
      `        union() {`,
      `            if (mostrar_base_tpu) translate([0, 0, offset_tpu]) base_antideslizante_tpu();`,
      `            if (mostrar_contenedor) calabaza_contenedor_base();`,
      `            if (mostrar_posavasos) translate([0, 0, offset_coasters]) posavasos_set();`,
      `            if (mostrar_tapa) translate([0, 0, offset_tapa]) tapa_calabaza();`,
      `            if (mostrar_hojas_manija) translate([0, 0, offset_hojas]) hojas_manija();`,
      `            if (mostrar_tallo_salero) translate([0, 0, offset_salero]) tallo_salero_especiero();`,
      `            if (mostrar_tapita_salero) translate([0, 0, offset_salero]) tapita_salero();`,
      `            if (mostrar_cucharitas) translate([0, 0, offset_cucharas]) cucharitas_par();`,
      `        }`,
      `    }`,
      `}\n`,
      `// Ejecutar ensamblaje`,
      `estacion_cafetera();\n`
    ];

    return header.join('\n') + mContainer + mLid + mLeaves + mShaker + mCap + mCoasters + mSpoons + mTpu + assembly.join('\n');
  }

  // Classic Pumpkin Mode
  const hasSupports =
    includeSupports &&
    Boolean(
      supportSettings?.enabled &&
      supportResult?.supportGeometry &&
      supportResult.supportGeometry.getAttribute('position') &&
      supportResult.supportGeometry.getAttribute('position').count > 0
    );

  const header: string[] = [
    `/*`,
    ` ==============================================================================`,
    `  CALABAZA 3D ORGÁNICA - MODELO PARA IMPRESIÓN 3D EN OPENSCAD`,
    `  Generado: ${timestamp} UTC`,
    `  `,
    `  Características y Especificaciones:`,
    `  - Diámetro del Cuerpo: ${pumpkinParams.radius * 2} mm`,
    `  - Altura Total: ${pumpkinModel.heightMm} mm`,
    `  - Base Plana para Adherencia en Cama: Ø ${pumpkinParams.flatBaseDiameter} mm (${pumpkinModel.baseContactAreaMm2} mm² de contacto)`,
    `  - Costillas / Gajos: ${pumpkinParams.ribCount} (profundidad: ${pumpkinParams.ribDepth})`,
    `  - Asimetría Orgánica: ${Math.round(pumpkinParams.asymmetry * 100)}%`,
    `  - Textura de Piel: ${Math.round(pumpkinParams.skinRoughness * 100)}% rugosidad realista`,
    `  - Tallo Superior: Estriado orgánico helicoidal con cáliz de transición`,
    `  - Orientación: Eje Z positivo vertical, base plana situada exactamente en Z=0`,
    `  - Incluye Soportes: ${hasSupports ? 'SÍ (pilares breakaway con contacto 0.6mm)' : 'NO (base plana autosoportada)'}`,
    `  `,
    `  Guía Rápida de OpenSCAD:`,
    `  - [F5]: Vista Previa Rápida (OpenCSG con colores independientes)`,
    `  - [F6]: Renderizado Sólido Completo CGAL (para exportación STL/3MF)`,
    `  - [F7]: Exportar directamente a STL desde OpenSCAD`,
    ` ==============================================================================`,
    `*/\n`,
    `// --- PARÁMETROS DE VISUALIZACIÓN Y MONTAJE ---`,
    `show_body     = true;   // Mostrar cuerpo de la calabaza`,
    `show_stem     = true;   // Mostrar tallo orgánico detallado`,
    hasSupports ? `show_supports = true;   // Mostrar pilares de soporte breakaway\n` : `show_supports = false;  // Sin soportes integrados\n`,
    `render_colors = $preview; // Colores en F5 (vista previa), sólido unificado en F6 (render)\n`,
    `// Paleta de colores para vista previa`,
    `color_body    = [0.94, 0.44, 0.08, 1.0];   // Naranja calabaza natural`,
    `color_stem    = [0.28, 0.48, 0.22, 1.0];   // Verde botánico orgánico`,
    hasSupports ? `color_support = [0.18, 0.72, 0.85, 0.75];  // Cian translúcido para soportes\n` : '',
    `\n`
  ];

  // 1. Pumpkin Body Polyhedron
  const bodyModule = geometryToOpenSCADPolyhedron(
    pumpkinModel.bodyGeometry,
    'calabaza_cuerpo',
    `Módulo: Cuerpo Orgánico con Base Plana (Ø ${pumpkinParams.flatBaseDiameter}mm)`
  );

  // 2. Pumpkin Stem Polyhedron
  const stemModule = geometryToOpenSCADPolyhedron(
    pumpkinModel.stemGeometry,
    'calabaza_tallo',
    'Módulo: Tallo Superior Estriado con Curvatura Orgánica'
  );

  // 3. Optional Support Polyhedron
  let supportModule = '';
  if (hasSupports && supportResult && supportResult.supportGeometry) {
    supportModule = geometryToOpenSCADPolyhedron(
      supportResult.supportGeometry,
      'calabaza_soportes',
      `Módulo: Pilares de Soporte Breakaway (Puntas de Contacto Micro de 0.6mm)`
    );
  }

  // 4. Assembly Module and Root Invocation
  const assembly: string[] = [
    `// ==============================================================================`,
    `// ENSAMBLAJE PRINCIPAL`,
    `// ==============================================================================`,
    `module organic_pumpkin() {`,
    `    if (render_colors) {`,
    `        if (show_body) color(color_body) calabaza_cuerpo();`,
    `        if (show_stem) color(color_stem) calabaza_tallo();`,
    hasSupports ? `        if (show_supports) color(color_support) calabaza_soportes();\n` : '',
    `    } else {`,
    `        union() {`,
    `            if (show_body) calabaza_cuerpo();`,
    `            if (show_stem) calabaza_tallo();`,
    hasSupports ? `            if (show_supports) calabaza_soportes();\n` : '',
    `        }`,
    `    }`,
    `}\n`,
    `organic_pumpkin();\n\n`
  ];

  return header.join('\n') + bodyModule + stemModule + supportModule + assembly.join('\n');
}

/**
 * Generates and triggers browser download of the OpenSCAD (.scad) file.
 */
export function exportToOpenSCAD(options: OpenSCADExportOptions): void {
  const { pumpkinParams, includeSupports, filename } = options;
  const scadSource = generateOpenSCADScript(options);

  const defaultFilename = includeSupports
    ? `calabaza_organica_con_soportes_${pumpkinParams.radius * 2}mm.scad`
    : `calabaza_organica_${pumpkinParams.radius * 2}mm.scad`;

  const finalName = filename || defaultFilename;

  const blob = new Blob([scadSource], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = finalName;
  link.click();
  URL.revokeObjectURL(link.href);
}
