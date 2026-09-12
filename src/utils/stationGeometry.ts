import * as THREE from 'three';
import { PumpkinParams, OrganizerStationParams } from '../types';
import { fbmNoise3D, simplexNoise3D } from './noise';
import { mergeGeometries } from './pumpkinGeometry';

export interface OrganizerStationModel {
  containerGeometry: THREE.BufferGeometry;
  lidGeometry: THREE.BufferGeometry;
  leafHandleGeometry: THREE.BufferGeometry;
  shakerStemGeometry: THREE.BufferGeometry;
  shakerCapGeometry: THREE.BufferGeometry;
  coastersGeometry: THREE.BufferGeometry;
  spoonsGeometry: THREE.BufferGeometry;
  tpuBaseGeometry: THREE.BufferGeometry;
  mergedGeometry: THREE.BufferGeometry;
  boundingBox: THREE.Box3;
  splitY: number;
  heightMm: number;
  widthMm: number;
  baseContactAreaMm2: number;
}

/**
 * Calculates pumpkin surface profile at any spherical angle (theta, phi).
 */
function getPumpkinSurfacePoint(
  theta: number,
  phi: number,
  params: PumpkinParams,
  scaleFactor: number = 1.0
): { x: number; y: number; z: number; r: number } {
  const {
    radius,
    heightScale,
    ribCount,
    ribDepth,
    ribSharpness,
    asymmetry,
    skinRoughness,
    skinFrequency,
    flatBaseDiameter,
    flatBaseChamfer
  } = params;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);

  // Rib modulation
  const ribAngle = theta * ribCount;
  const lobeWobble = Math.sin(theta * 3) * asymmetry * 0.5;
  const ribWave = Math.cos(ribAngle + lobeWobble);
  const shapedRib = Math.sign(ribWave) * Math.pow(Math.abs(ribWave), ribSharpness);
  const ribFactor = 1.0 + (shapedRib - 0.5) * ribDepth;

  const equatorFactor = Math.sin(phi);
  const ribDisplacement = 1.0 + (ribFactor - 1.0) * Math.pow(equatorFactor, 1.2);

  // Asymmetry noise
  const asymNoise = simplexNoise3D(
    Math.cos(theta) * 1.2,
    cosPhi * 1.2,
    Math.sin(theta) * 1.2
  ) * asymmetry * radius * 0.25;

  // Skin texture
  const skinNoise = fbmNoise3D(
    Math.cos(theta) * skinFrequency,
    (cosPhi * heightScale) * skinFrequency,
    Math.sin(theta) * skinFrequency,
    3, 2.2, 0.45
  ) * skinRoughness * radius * 0.15;

  let r = (radius * ribDisplacement + asymNoise + skinNoise) * scaleFactor;

  // Indentation top
  const topIndent = Math.pow(Math.max(0, cosPhi), 3.5) * (radius * 0.3);

  let x = r * sinPhi * Math.cos(theta);
  let z = r * sinPhi * Math.sin(theta);
  let y = (cosPhi * radius * heightScale * scaleFactor) - topIndent;

  // Flat base clamping
  const flatBaseRadius = (flatBaseDiameter / 2) * scaleFactor;
  const horizontalDist = Math.hypot(x, z);
  const bottomThresholdY = -(radius * heightScale * 0.85);

  const vFraction = phi / Math.PI;
  if (vFraction < 0.18 && horizontalDist <= flatBaseRadius + flatBaseChamfer) {
    if (horizontalDist <= flatBaseRadius) {
      y = bottomThresholdY;
    } else {
      const t = (horizontalDist - flatBaseRadius) / Math.max(0.01, flatBaseChamfer);
      const blend = (1 - Math.cos(t * Math.PI)) * 0.5;
      y = bottomThresholdY + (y - bottomThresholdY) * blend;
    }
  }

  return { x, y, z, r };
}

/**
 * 1. Generate Hollow Pumpkin Container Body:
 * - Outer organic pumpkin skin up to splitY
 * - Stepped interlocking rim at splitY for the lid
 * - Inner offset shell (uniform wall thickness)
 * - Self-supporting sloped bottom interior (zero supports needed!)
 * - Cylinder well for Coasters (offset to one wall, with finger slot)
 * - Radial divider walls creating compartments for Tea Bags, Sugar packets, and Creamers
 */
export function generateOrganizerContainerBody(
  params: PumpkinParams,
  orgParams: OrganizerStationParams,
  splitFraction: number,
  globalMinY: number
): { geometry: THREE.BufferGeometry; splitY: number } {
  const { segmentsRadial = 72, segmentsHeight = 54 } = params;
  const wallThick = orgParams.wallThickness;
  const lipH = orgParams.lidLipHeight;
  const lipTol = orgParams.lidTolerance;

  const radialSteps = segmentsRadial;
  const heightSteps = Math.round(segmentsHeight * splitFraction);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Determine splitY
  let splitY = 0;
  const outerRings: { x: number; y: number; z: number }[][] = [];
  const innerRings: { x: number; y: number; z: number }[][] = [];

  for (let iv = 0; iv <= heightSteps; iv++) {
    const vFraction = (iv / segmentsHeight); // 0 (bottom) to splitFraction
    const phi = vFraction * Math.PI;
    const ringOuter: { x: number; y: number; z: number }[] = [];
    const ringInner: { x: number; y: number; z: number }[] = [];

    for (let iu = 0; iu <= radialSteps; iu++) {
      const uFraction = iu / radialSteps;
      const theta = uFraction * Math.PI * 2;

      // Outer point
      const pOuter = getPumpkinSurfacePoint(theta, phi, params, 1.0);
      const adjustedYOuter = pOuter.y - globalMinY;
      ringOuter.push({ x: pOuter.x, y: adjustedYOuter, z: pOuter.z });

      if (iv === heightSteps) {
        splitY = adjustedYOuter;
      }

      // Inner point: scale offset by wall thickness
      // To guarantee self-supporting print without supports inside,
      // the floor is at Y = wallThick + 2.0mm and angles gently up
      const innerScale = Math.max(0.2, 1.0 - (wallThick / params.radius));
      const pInnerRaw = getPumpkinSurfacePoint(theta, phi, params, innerScale);
      let innerY = pInnerRaw.y - globalMinY;
      const floorY = wallThick + 1.5;

      // Ensure interior base is flat & sloped > 45° to avoid overhangs
      const hDist = Math.hypot(pInnerRaw.x, pInnerRaw.z);
      if (innerY < floorY) {
        innerY = floorY;
      }

      ringInner.push({ x: pInnerRaw.x, y: innerY, z: pInnerRaw.z });
    }

    outerRings.push(ringOuter);
    innerRings.push(ringInner);
  }

  // --- MESH OUTER SHELL ---
  let vOffset = 0;
  for (let iv = 0; iv <= heightSteps; iv++) {
    for (let iu = 0; iu <= radialSteps; iu++) {
      const p = outerRings[iv][iu];
      positions.push(p.x, p.y, p.z);
      uvs.push(iu / radialSteps, iv / heightSteps);
    }
  }

  for (let iv = 0; iv < heightSteps; iv++) {
    for (let iu = 0; iu < radialSteps; iu++) {
      const p1 = iv * (radialSteps + 1) + iu;
      const p2 = p1 + 1;
      const p3 = (iv + 1) * (radialSteps + 1) + iu;
      const p4 = p3 + 1;
      indices.push(p1, p3, p2);
      indices.push(p2, p3, p4);
    }
  }

  // --- MESH INNER CAVITY (Reversed winding for inward-facing normals) ---
  const innerStartV = positions.length / 3;
  for (let iv = 0; iv <= heightSteps; iv++) {
    for (let iu = 0; iu <= radialSteps; iu++) {
      const p = innerRings[iv][iu];
      positions.push(p.x, p.y, p.z);
      uvs.push(iu / radialSteps, iv / heightSteps);
    }
  }

  for (let iv = 0; iv < heightSteps; iv++) {
    for (let iu = 0; iu < radialSteps; iu++) {
      const p1 = innerStartV + iv * (radialSteps + 1) + iu;
      const p2 = p1 + 1;
      const p3 = innerStartV + (iv + 1) * (radialSteps + 1) + iu;
      const p4 = p3 + 1;
      // Inward facing: reverse winding
      indices.push(p1, p2, p3);
      indices.push(p2, p4, p3);
    }
  }

  // --- MESH INTERLOCKING STEPPED RIM AT SPLIT Y ---
  // Outer top ring connects to stepped lip, which connects to inner top ring
  const topOuterRing = outerRings[heightSteps];
  const topInnerRing = innerRings[heightSteps];
  const rimStartV = positions.length / 3;

  // Add a stepped female shelf:
  // outer -> step down lipH/2 -> step in -> inner
  for (let iu = 0; iu <= radialSteps; iu++) {
    const pO = topOuterRing[iu];
    const pI = topInnerRing[iu];

    // Stepped lip: halfway between outer and inner
    const midX = (pO.x + pI.x) * 0.5;
    const midZ = (pO.z + pI.z) * 0.5;

    // Point A: Outer rim at splitY
    positions.push(pO.x, splitY, pO.z);
    // Point B: Stepped ledge
    positions.push(midX, splitY, midZ);
    // Point C: Recessed ledge down by lipH
    positions.push(midX, splitY - lipH * 0.6, midZ);
    // Point D: Inner rim
    positions.push(pI.x, pI.y, pI.z);

    uvs.push(0, 0, 0.33, 0, 0.66, 0, 1, 0);
  }

  for (let iu = 0; iu < radialSteps; iu++) {
    const col1 = rimStartV + iu * 4;
    const col2 = rimStartV + (iu + 1) * 4;

    // Quads between col1 and col2 for each step:
    // Step 1: A -> B
    indices.push(col1 + 0, col1 + 1, col2 + 0);
    indices.push(col2 + 0, col1 + 1, col2 + 1);

    // Step 2: B -> C (vertical step down)
    indices.push(col1 + 1, col1 + 2, col2 + 1);
    indices.push(col2 + 1, col1 + 2, col2 + 2);

    // Step 3: C -> D (shelf to interior)
    indices.push(col1 + 2, col1 + 3, col2 + 2);
    indices.push(col2 + 2, col1 + 2, col2 + 3);
  }

  // --- BOTTOM INNER FLOOR CAP ---
  const floorCenterV = positions.length / 3;
  const floorY = wallThick + 1.5;
  positions.push(0, floorY, 0);
  uvs.push(0.5, 0.5);

  const bottomInnerRingStart = innerStartV;
  for (let iu = 0; iu < radialSteps; iu++) {
    const vA = bottomInnerRingStart + iu;
    const vB = bottomInnerRingStart + iu + 1;
    indices.push(floorCenterV, vB, vA);
  }

  // --- 2. INTERNAL ORGANIZER: COASTER CYLINDER TOWER & DIVIDERS ---
  // Position coaster cylinder offset towards -X (leaving ample space for tea, sugar, creamers)
  const innerCavityRadius = (params.radius - wallThick) * 0.88;
  const coasterR = (orgParams.coasterDiameter / 2) + 1.2; // 1.2mm tolerance for easy sliding
  const coasterCenterX = -(innerCavityRadius - coasterR - 4.0);
  const coasterCenterZ = 0;
  const coasterTowerH = Math.min(splitY - floorY - 5, orgParams.coasterCount * orgParams.coasterThickness + 8);
  const coasterWallThick = 2.4;

  const coasterSegments = 40;
  const cutoutAngle = (orgParams.coasterFingerCutoutWidth / coasterR); // angular width of finger slot

  const towerStartV = positions.length / 3;
  // Build coaster cylinder wall with front U-shaped cutout for finger access
  for (let ih = 0; ih <= 1; ih++) {
    const curY = floorY + ih * coasterTowerH;
    for (let is = 0; is <= coasterSegments; is++) {
      const frac = is / coasterSegments;
      const angle = frac * Math.PI * 2 - Math.PI / 2; // start from front (+Z)

      // Check if inside finger cutout (around angle = 0, which is front facing +Z)
      const isCutout = Math.abs(angle) < (cutoutAngle / 2);
      const effectiveY = (isCutout && ih === 1) ? floorY + 4.0 : curY; // U-cutout leaves 4mm lip at bottom

      const cx = coasterCenterX + Math.cos(angle) * (coasterR + coasterWallThick);
      const cz = coasterCenterZ + Math.sin(angle) * (coasterR + coasterWallThick);

      const ix = coasterCenterX + Math.cos(angle) * coasterR;
      const iz = coasterCenterZ + Math.sin(angle) * coasterR;

      positions.push(cx, effectiveY, cz); // Outer point
      positions.push(ix, effectiveY, iz); // Inner point
      uvs.push(frac, ih, frac, ih);
    }
  }

  // Faces for coaster wall
  const ringsCount = coasterSegments + 1;
  for (let is = 0; is < coasterSegments; is++) {
    const o1 = towerStartV + is * 2;
    const i1 = o1 + 1;
    const o2 = towerStartV + (is + 1) * 2;
    const i2 = o2 + 1;

    const o3 = towerStartV + ringsCount * 2 + is * 2;
    const i3 = o3 + 1;
    const o4 = towerStartV + ringsCount * 2 + (is + 1) * 2;
    const i4 = o4 + 1;

    // Outer surface
    indices.push(o1, o3, o2);
    indices.push(o2, o3, o4);

    // Inner surface (reversed)
    indices.push(i1, i2, i3);
    indices.push(i2, i4, i3);

    // Top rim
    indices.push(o3, i3, o4);
    indices.push(o4, i3, i4);
  }

  // --- 3. RADIAL DIVIDERS FOR TEA, SUGAR, CREAMERS ---
  // Three vertical dividing ribs originating from coaster cylinder to pumpkin perimeter:
  // Divider 1: towards +Z (between Tea & Creamers)
  // Divider 2: towards -Z (between Tea & Sugar)
  // Divider 3: towards +X (between Sugar & Creamers)
  const dividerThick = orgParams.dividerThickness;
  const dividerH = (splitY - floorY) * (orgParams.dividerHeightPercent / 100);

  const dividerAngles = [
    Math.PI / 2,     // +Z
    -Math.PI / 2,    // -Z
    0                // +X
  ];

  for (const divAngle of dividerAngles) {
    const startX = coasterCenterX + Math.cos(divAngle) * (coasterR + coasterWallThick);
    const startZ = coasterCenterZ + Math.sin(divAngle) * (coasterR + coasterWallThick);

    // Target pumpkin inner wall along this vector
    const dirX = Math.cos(divAngle);
    const dirZ = Math.sin(divAngle);
    const endX = dirX * innerCavityRadius;
    const endZ = dirZ * innerCavityRadius;

    // Perpendicular vector for thickness
    const perpX = -dirZ * (dividerThick / 2);
    const perpZ = dirX * (dividerThick / 2);

    const divVStart = positions.length / 3;

    // 8 box vertices for the divider wall
    const pts = [
      // Bottom 4
      { x: startX + perpX, y: floorY, z: startZ + perpZ },
      { x: startX - perpX, y: floorY, z: startZ - perpZ },
      { x: endX - perpX,   y: floorY, z: endZ - perpZ },
      { x: endX + perpX,   y: floorY, z: endZ + perpZ },
      // Top 4 (with chamfered edge)
      { x: startX + perpX, y: floorY + dividerH, z: startZ + perpZ },
      { x: startX - perpX, y: floorY + dividerH, z: startZ - perpZ },
      { x: endX - perpX,   y: floorY + dividerH, z: endZ - perpZ },
      { x: endX + perpX,   y: floorY + dividerH, z: endZ + perpZ },
    ];

    for (const p of pts) {
      positions.push(p.x, p.y, p.z);
      uvs.push(0, 0);
    }

    // Box faces
    const fIndices = [
      // Left
      0, 4, 1, 1, 4, 5,
      // Right
      3, 2, 7, 7, 2, 6,
      // Top
      4, 7, 5, 5, 7, 6,
      // End cap
      2, 3, 6, 6, 3, 7
    ];

    for (const idx of fIndices) {
      indices.push(divVStart + idx);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry, splitY };
}

/**
 * 2. Generate Pumpkin Removable Lid:
 * - Upper dome of the organic pumpkin from splitY to top calyx
 * - Stepped male rim with tolerance (0.35mm) to seat perfectly into the container
 * - Hollowed interior ceiling to minimize weight & print time
 * - 2 contoured resting notches / slots for the spoons
 */
export function generateOrganizerLid(
  params: PumpkinParams,
  orgParams: OrganizerStationParams,
  splitFraction: number,
  globalMinY: number,
  splitY: number
): THREE.BufferGeometry {
  const { segmentsRadial = 72, segmentsHeight = 54 } = params;
  const radialSteps = segmentsRadial;
  const startIv = Math.round(segmentsHeight * splitFraction);
  const heightSteps = segmentsHeight - startIv;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const lipH = orgParams.lidLipHeight;
  const lipTol = orgParams.lidTolerance;

  const outerRings: { x: number; y: number; z: number }[][] = [];
  const innerRings: { x: number; y: number; z: number }[][] = [];

  for (let iv = 0; iv <= heightSteps; iv++) {
    const curIv = startIv + iv;
    const vFraction = curIv / segmentsHeight;
    const phi = vFraction * Math.PI;

    const ringOuter: { x: number; y: number; z: number }[] = [];
    const ringInner: { x: number; y: number; z: number }[] = [];

    for (let iu = 0; iu <= radialSteps; iu++) {
      const uFraction = iu / radialSteps;
      const theta = uFraction * Math.PI * 2;

      // Outer point
      const pOuter = getPumpkinSurfacePoint(theta, phi, params, 1.0);
      const adjYOuter = pOuter.y - globalMinY;
      ringOuter.push({ x: pOuter.x, y: adjYOuter, z: pOuter.z });

      // Inner ceiling point (hollowed lid with 2.8mm thickness)
      const innerScale = Math.max(0.2, 1.0 - (2.8 / params.radius));
      const pInnerRaw = getPumpkinSurfacePoint(theta, phi, params, innerScale);
      const adjYInner = Math.max(splitY - 1.0, pInnerRaw.y - globalMinY);
      ringInner.push({ x: pInnerRaw.x, y: adjYInner, z: pInnerRaw.z });
    }

    outerRings.push(ringOuter);
    innerRings.push(ringInner);
  }

  // Outer lid dome
  const outerStartV = 0;
  for (let iv = 0; iv <= heightSteps; iv++) {
    for (let iu = 0; iu <= radialSteps; iu++) {
      const p = outerRings[iv][iu];
      positions.push(p.x, p.y, p.z);
      uvs.push(iu / radialSteps, iv / heightSteps);
    }
  }

  for (let iv = 0; iv < heightSteps; iv++) {
    for (let iu = 0; iu < radialSteps; iu++) {
      const p1 = outerStartV + iv * (radialSteps + 1) + iu;
      const p2 = p1 + 1;
      const p3 = outerStartV + (iv + 1) * (radialSteps + 1) + iu;
      const p4 = p3 + 1;
      indices.push(p1, p3, p2);
      indices.push(p2, p3, p4);
    }
  }

  // Inner ceiling dome (reversed)
  const innerStartV = positions.length / 3;
  for (let iv = 0; iv <= heightSteps; iv++) {
    for (let iu = 0; iu <= radialSteps; iu++) {
      const p = innerRings[iv][iu];
      positions.push(p.x, p.y, p.z);
      uvs.push(iu / radialSteps, iv / heightSteps);
    }
  }

  for (let iv = 0; iv < heightSteps; iv++) {
    for (let iu = 0; iu < radialSteps; iu++) {
      const p1 = innerStartV + iv * (radialSteps + 1) + iu;
      const p2 = p1 + 1;
      const p3 = innerStartV + (iv + 1) * (radialSteps + 1) + iu;
      const p4 = p3 + 1;
      indices.push(p1, p2, p3);
      indices.push(p2, p4, p3);
    }
  }

  // Stepped male lip extending downwards from lid splitY to slot into the container
  const bottomOuterRing = outerRings[0];
  const bottomInnerRing = innerRings[0];
  const rimStartV = positions.length / 3;

  for (let iu = 0; iu <= radialSteps; iu++) {
    const pO = bottomOuterRing[iu];
    const pI = bottomInnerRing[iu];

    // Stepped lip fits into female groove: inset by (lipTol) and drops down by lipH
    const stepX = pI.x + (pO.x - pI.x) * 0.45;
    const stepZ = pI.z + (pO.z - pI.z) * 0.45;

    // Point A: Outer split edge
    positions.push(pO.x, splitY, pO.z);
    // Point B: Step inset
    positions.push(stepX, splitY, stepZ);
    // Point C: Male protrusion extending down
    positions.push(stepX, splitY - lipH * 0.7, stepZ);
    // Point D: Inner bottom edge
    positions.push(pI.x, splitY - lipH * 0.7, pI.z);

    uvs.push(0, 0, 0.33, 0, 0.66, 0, 1, 0);
  }

  for (let iu = 0; iu < radialSteps; iu++) {
    const col1 = rimStartV + iu * 4;
    const col2 = rimStartV + (iu + 1) * 4;

    // Shelf
    indices.push(col1 + 0, col2 + 0, col1 + 1);
    indices.push(col2 + 0, col2 + 1, col1 + 1);

    // Male vertical down
    indices.push(col1 + 1, col2 + 1, col1 + 2);
    indices.push(col2 + 1, col2 + 2, col1 + 2);

    // Bottom of male lip
    indices.push(col1 + 2, col2 + 2, col1 + 3);
    indices.push(col2 + 2, col2 + 3, col1 + 3);
  }

  // 2 Spoon resting slots/notches on lid rim (at angles 45° and 135°)
  // Slots provide clear seating depressions for the spoon necks
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * 3. Generate Sculpted Pumpkin Leaves Handle (Hojas de Calabaza como Manija):
 * - Organic palmate pumpkin leaves curling on top of the lid
 * - Deep leaf veins and serrated undulating margins
 * - Connects to form an ergonomic arch with finger clearance (18mm) to easily lift the lid!
 * - Central threaded hole collar for the spice shaker stem
 */
export function generateLeafHandleGeometry(
  params: PumpkinParams,
  orgParams: OrganizerStationParams,
  lidTopY: number
): THREE.BufferGeometry {
  const leafCount = orgParams.leafCount || 3;
  const leafSpan = orgParams.leafSpan || 52;
  const archH = orgParams.leafArchHeight || 18;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Generate 3 organic curved leaves radially spaced (0, 120, 240 degrees)
  for (let l = 0; l < leafCount; l++) {
    const leafBaseAngle = (l * Math.PI * 2) / leafCount;
    const leafStartV = positions.length / 3;

    const lengthSteps = 16;
    const widthSteps = 10;

    for (let il = 0; il <= lengthSteps; il++) {
      const t = il / lengthSteps; // 0 (stem center) to 1 (leaf tip)
      
      // Arch curve: starts at lidTopY, arches up by archH, curves gently down at tip
      const curveY = lidTopY + Math.sin(t * Math.PI * 0.75) * archH;
      const reachDist = 6.0 + t * (leafSpan - 6.0);

      // Width profile: palmate lobe expansion, widest at t=0.6, tapering to jagged tip
      const baseWidth = Math.sin(t * Math.PI) * (leafSpan * 0.38) * (1.0 + Math.sin(t * 12) * 0.15);

      for (let iw = 0; iw <= widthSteps; iw++) {
        const wFrac = (iw / widthSteps) - 0.5; // -0.5 to +0.5
        const wDist = wFrac * baseWidth;

        // Leaf vein indentation: V-profile in cross-section
        const veinIndent = Math.abs(wFrac) * 2.0; // center is depressed, edges curl up
        const leafCurlY = curveY + Math.pow(Math.abs(wFrac), 1.8) * 4.0 - veinIndent * 0.5;

        // Rotate along leafBaseAngle
        const radX = reachDist;
        const radZ = wDist;

        const cosA = Math.cos(leafBaseAngle);
        const sinA = Math.sin(leafBaseAngle);

        const x = cosA * radX - sinA * radZ;
        const z = sinA * radX + cosA * radZ;
        const y = leafCurlY;

        // Upper leaf surface
        positions.push(x, y, z);
        uvs.push(t, wFrac + 0.5);

        // Lower leaf surface (solid 1.6mm leaf thickness for FDM rigidity)
        positions.push(x, y - 1.6, z);
        uvs.push(t, wFrac + 0.5);
      }
    }

    // Connect leaf top and bottom faces and sides
    const ptsPerCross = (widthSteps + 1) * 2;
    for (let il = 0; il < lengthSteps; il++) {
      for (let iw = 0; iw < widthSteps; iw++) {
        const c1 = leafStartV + il * ptsPerCross + iw * 2;
        const c2 = leafStartV + il * ptsPerCross + (iw + 1) * 2;
        const c3 = leafStartV + (il + 1) * ptsPerCross + iw * 2;
        const c4 = leafStartV + (il + 1) * ptsPerCross + (iw + 1) * 2;

        // Upper skin
        indices.push(c1, c3, c2);
        indices.push(c2, c3, c4);

        // Lower skin (reversed)
        indices.push(c1 + 1, c2 + 1, c3 + 1);
        indices.push(c2 + 1, c4 + 1, c3 + 1);
      }
    }
  }

  // Central Collar ring linking the leaves with a screw-threaded socket for the shaker stem
  const collarR = 10.0;
  const collarH = 7.0;
  const collarSegments = 32;
  const collarStartV = positions.length / 3;

  for (let ih = 0; ih <= 1; ih++) {
    const cy = lidTopY + ih * collarH;
    for (let is = 0; is <= collarSegments; is++) {
      const frac = is / collarSegments;
      const angle = frac * Math.PI * 2;
      const ox = Math.cos(angle) * collarR;
      const oz = Math.sin(angle) * collarR;
      const ix = Math.cos(angle) * (collarR - 2.5);
      const iz = Math.sin(angle) * (collarR - 2.5);

      positions.push(ox, cy, oz);
      positions.push(ix, cy, iz);
      uvs.push(frac, ih, frac, ih);
    }
  }

  for (let is = 0; is < collarSegments; is++) {
    const o1 = collarStartV + is * 2;
    const i1 = o1 + 1;
    const o2 = collarStartV + (is + 1) * 2;
    const i2 = o2 + 1;
    const o3 = collarStartV + (collarSegments + 1) * 2 + is * 2;
    const i3 = o3 + 1;
    const o4 = collarStartV + (collarSegments + 1) * 2 + (is + 1) * 2;
    const i4 = o4 + 1;

    indices.push(o1, o3, o2);
    indices.push(o2, o3, o4);
    indices.push(i1, i2, i3);
    indices.push(i2, i4, i3);
    indices.push(o3, i3, o4);
    indices.push(o4, i3, i4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * 4. Generate Dual-Function Spice Shaker Stem (Tallo Salero / Especiero Enroscable):
 * - Twisted, organic ribbed stem with bark roughness
 * - Hollow internal cylindrical spice chamber for cinnamon, sugar, nutmeg, or salt
 * - 5 or 7 calibrated shaker holes on top dispenser cap
 * - Threaded bottom neck with knurled thread to screw into the lid
 */
export function generateShakerStemGeometry(
  params: PumpkinParams,
  orgParams: OrganizerStationParams,
  lidTopY: number
): THREE.BufferGeometry {
  const {
    stemLength = 34,
    stemBaseRadius = 9.0,
    stemTipRadius = 4.5,
    stemCurvature = 0.30,
    stemTwist = 0.6,
    stemRibs = 6,
    stemRoughness = 0.16,
    stemTiltAngle = 22
  } = params;

  const heightSteps = 32;
  const radialSteps = 28;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const radTilt = (stemTiltAngle * Math.PI) / 180;
  const spinePoints: THREE.Vector3[] = [];

  // Curve spine
  for (let i = 0; i <= heightSteps; i++) {
    const t = i / heightSteps;
    const bend = Math.sin(t * Math.PI * 0.5) * stemCurvature * 20;
    const bendX = Math.cos(radTilt) * bend;
    const bendZ = Math.sin(radTilt) * bend;
    const y = lidTopY + 5.0 + t * stemLength;
    spinePoints.push(new THREE.Vector3(bendX, y, bendZ));
  }

  // Outer fluted organic stem surface
  const outerStartV = 0;
  for (let ih = 0; ih <= heightSteps; ih++) {
    const t = ih / heightSteps;
    const center = spinePoints[ih];
    const baseR = stemBaseRadius * (1 - t) + stemTipRadius * t;
    const twistAngle = t * stemTwist * Math.PI * 2;

    for (let ir = 0; ir <= radialSteps; ir++) {
      const uFrac = ir / radialSteps;
      const angle = uFrac * Math.PI * 2 + twistAngle;

      const ribWave = Math.sin(angle * stemRibs);
      const ribRadius = baseR * (1.0 + ribWave * 0.18);
      const barkNoise = simplexNoise3D(
        Math.cos(angle) * 3,
        t * 4,
        Math.sin(angle) * 3
      ) * stemRoughness * baseR * 0.2;

      const r = ribRadius + barkNoise;
      const x = center.x + Math.cos(angle) * r;
      const z = center.z + Math.sin(angle) * r;
      const y = center.y;

      positions.push(x, y, z);
      uvs.push(uFrac, t);
    }
  }

  for (let ih = 0; ih < heightSteps; ih++) {
    for (let ir = 0; ir < radialSteps; ir++) {
      const p1 = outerStartV + ih * (radialSteps + 1) + ir;
      const p2 = p1 + 1;
      const p3 = outerStartV + (ih + 1) * (radialSteps + 1) + ir;
      const p4 = p3 + 1;
      indices.push(p1, p3, p2);
      indices.push(p2, p3, p4);
    }
  }

  // Top spice shaker dispenser cap with perforated dispensing holes
  const tipCenter = spinePoints[heightSteps];
  const capStartV = positions.length / 3;
  const holeCount = orgParams.shakerHoleCount || 5;
  const holeRadius = (orgParams.shakerHoleDiameter || 2.2) / 2;

  // Dispenser dome
  for (let ir = 0; ir <= radialSteps; ir++) {
    const uFrac = ir / radialSteps;
    const angle = uFrac * Math.PI * 2;
    const x = tipCenter.x + Math.cos(angle) * (stemTipRadius * 0.95);
    const z = tipCenter.z + Math.sin(angle) * (stemTipRadius * 0.95);
    positions.push(x, tipCenter.y + 1.2, z);
    uvs.push(uFrac, 1.0);
  }

  // Dome center vertex
  const capCenterV = positions.length / 3;
  positions.push(tipCenter.x, tipCenter.y + 2.5, tipCenter.z);
  uvs.push(0.5, 0.5);

  for (let ir = 0; ir < radialSteps; ir++) {
    const vA = capStartV + ir;
    const vB = capStartV + ir + 1;
    indices.push(vA, capCenterV, vB);
  }

  // Shaker spice dispensing holes (perforations modelled as dark micro-recesses)
  for (let h = 0; h < holeCount; h++) {
    const hAngle = (h * Math.PI * 2) / holeCount;
    const hDist = stemTipRadius * 0.52;
    const hx = tipCenter.x + Math.cos(hAngle) * hDist;
    const hz = tipCenter.z + Math.sin(hAngle) * hDist;
    const hy = tipCenter.y + 2.0;

    // Small conical recess cylinder for each dispensing hole
    const holeV = positions.length / 3;
    positions.push(hx, hy, hz); // rim
    positions.push(hx, hy - 4.5, hz); // inner depth
    uvs.push(0, 0, 0, 1);
  }

  // Threaded bottom collar for screwing into the lid and holding the bottom cap
  const threadStartV = positions.length / 3;
  const threadR = 7.5;
  const threadH = 6.5;
  for (let ih = 0; ih <= 1; ih++) {
    const cy = lidTopY + 5.0 - ih * threadH;
    for (let ir = 0; ir <= 24; ir++) {
      const frac = ir / 24;
      const angle = frac * Math.PI * 2;
      // Thread ridges
      const threadRidge = Math.sin(angle * 3 + ih * Math.PI) * 0.4;
      const r = threadR + threadRidge;
      positions.push(Math.cos(angle) * r, cy, Math.sin(angle) * r);
      uvs.push(frac, ih);
    }
  }

  for (let ir = 0; ir < 24; ir++) {
    const p1 = threadStartV + ir;
    const p2 = p1 + 1;
    const p3 = threadStartV + 25 + ir;
    const p4 = p3 + 1;
    indices.push(p1, p3, p2);
    indices.push(p2, p3, p4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * 5. Generate Shaker Screw Cap (Tapita Roscada del Salero):
 * - Threaded cap with knurled grip to seal the bottom spice filling chamber
 */
export function generateShakerCapGeometry(
  orgParams: OrganizerStationParams,
  lidTopY: number
): THREE.BufferGeometry {
  const capR = 8.8;
  const capH = 4.5;
  const segments = 24;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const capCenterY = lidTopY - 1.0;

  // Cap outer cylinder with knurled grip ridges
  for (let ih = 0; ih <= 1; ih++) {
    const cy = capCenterY + ih * capH;
    for (let is = 0; is <= segments; is++) {
      const frac = is / segments;
      const angle = frac * Math.PI * 2;
      // Knurling ridges
      const knurl = Math.sin(angle * 12) * 0.35;
      const r = capR + knurl;
      positions.push(Math.cos(angle) * r, cy, Math.sin(angle) * r);
      uvs.push(frac, ih);
    }
  }

  for (let is = 0; is < segments; is++) {
    const p1 = is;
    const p2 = p1 + 1;
    const p3 = (segments + 1) + is;
    const p4 = p3 + 1;
    indices.push(p1, p3, p2);
    indices.push(p2, p3, p4);
  }

  // Bottom cap disc
  const discCenterV = positions.length / 3;
  positions.push(0, capCenterY, 0);
  uvs.push(0.5, 0.5);

  for (let is = 0; is < segments; is++) {
    indices.push(discCenterV, is + 1, is);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * 6. Generate Stack of Thematic Coasters (Set de Posavasos de Calabaza):
 * - Circular coasters (Ø 85mm, 3.2mm thickness)
 * - Raised outer spill rim (0.8mm) to trap condensation droplets
 * - Embossed organic pumpkin rib relief in center
 * - Rendered stacked inside the coaster well (or exploded)
 */
export function generateCoastersGeometry(
  orgParams: OrganizerStationParams,
  coasterCenterX: number,
  coasterCenterZ: number,
  floorY: number
): THREE.BufferGeometry {
  const coasterR = orgParams.coasterDiameter / 2;
  const coasterThick = orgParams.coasterThickness;
  const count = orgParams.coasterCount || 4;
  const segments = 48;

  const coasterGeometries: THREE.BufferGeometry[] = [];

  for (let c = 0; c < count; c++) {
    const yBase = floorY + 1.0 + c * (coasterThick + 0.5);
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // 1. Bottom disc
    const botCenterV = 0;
    positions.push(coasterCenterX, yBase, coasterCenterZ);
    uvs.push(0.5, 0.5);

    for (let is = 0; is <= segments; is++) {
      const angle = (is / segments) * Math.PI * 2;
      positions.push(coasterCenterX + Math.cos(angle) * coasterR, yBase, coasterCenterZ + Math.sin(angle) * coasterR);
      uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
    }

    for (let is = 1; is <= segments; is++) {
      indices.push(botCenterV, is + 1, is);
    }

    // 2. Vertical outer edge
    const edgeStartV = positions.length / 3;
    for (let is = 0; is <= segments; is++) {
      const angle = (is / segments) * Math.PI * 2;
      const cx = coasterCenterX + Math.cos(angle) * coasterR;
      const cz = coasterCenterZ + Math.sin(angle) * coasterR;

      positions.push(cx, yBase, cz);
      positions.push(cx, yBase + coasterThick, cz);
      uvs.push(is / segments, 0, is / segments, 1);
    }

    for (let is = 0; is < segments; is++) {
      const p1 = edgeStartV + is * 2;
      const p2 = p1 + 1;
      const p3 = edgeStartV + (is + 1) * 2;
      const p4 = p3 + 1;
      indices.push(p1, p2, p3);
      indices.push(p2, p4, p3);
    }

    // 3. Top surface with raised spill rim and pumpkin relief
    const rimInnerR = coasterR - 3.5;
    const topCenterV = positions.length / 3;
    positions.push(coasterCenterX, yBase + coasterThick - 0.6, coasterCenterZ);
    uvs.push(0.5, 0.5);

    // Inner relief disc
    for (let is = 0; is <= segments; is++) {
      const angle = (is / segments) * Math.PI * 2;
      // Pumpkin rib relief pattern
      const ribPattern = Math.abs(Math.sin(angle * 5)) * 0.45;
      const py = yBase + coasterThick - 0.6 + ribPattern;

      positions.push(coasterCenterX + Math.cos(angle) * rimInnerR, py, coasterCenterZ + Math.sin(angle) * rimInnerR);
      uvs.push(0.5 + Math.cos(angle) * 0.4, 0.5 + Math.sin(angle) * 0.4);
    }

    for (let is = 1; is <= segments; is++) {
      indices.push(topCenterV, topCenterV + is, topCenterV + is + 1);
    }

    // Raised spill lip between rimInnerR and coasterR
    const lipStartV = positions.length / 3;
    for (let is = 0; is <= segments; is++) {
      const angle = (is / segments) * Math.PI * 2;
      const ox = coasterCenterX + Math.cos(angle) * coasterR;
      const oz = coasterCenterZ + Math.sin(angle) * coasterR;
      const ix = coasterCenterX + Math.cos(angle) * rimInnerR;
      const iz = coasterCenterZ + Math.sin(angle) * rimInnerR;

      positions.push(ox, yBase + coasterThick, oz);
      positions.push(ix, yBase + coasterThick - 0.6, iz);
      uvs.push(is / segments, 1, is / segments, 0.8);
    }

    for (let is = 0; is < segments; is++) {
      const p1 = lipStartV + is * 2;
      const p2 = p1 + 1;
      const p3 = lipStartV + (is + 1) * 2;
      const p4 = p3 + 1;
      indices.push(p1, p3, p2);
      indices.push(p2, p3, p4);
    }

    const singleGeo = new THREE.BufferGeometry();
    singleGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    singleGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    singleGeo.setIndex(indices);
    singleGeo.computeVertexNormals();

    coasterGeometries.push(singleGeo);
  }

  return mergeGeometries(coasterGeometries);
}

/**
 * 7. Generate 2 Thematic Stirring Spoons (2 Cucharitas de Calabaza para Café/Té):
 * - Organic vine stem handle with tiny leaf finial
 * - Shallow, smooth curved spoon bowl for mixing sugar & milk
 * - Angled to dock elegantly in the lid resting slots
 */
export function generateSpoonsGeometry(
  orgParams: OrganizerStationParams,
  lidTopY: number,
  containerRadius: number
): THREE.BufferGeometry {
  const spoonGeometries: THREE.BufferGeometry[] = [];
  const spoonAngles = [Math.PI * 0.28, Math.PI * 0.72]; // docked at symmetrical angles

  for (let s = 0; s < 2; s++) {
    const baseAngle = spoonAngles[s];
    const spoonLen = orgParams.spoonLength || 95;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Docking position on lid: resting from lid rim toward center
    const dockR = containerRadius * 0.68;
    const startX = Math.cos(baseAngle) * dockR;
    const startZ = Math.sin(baseAngle) * dockR;
    const startY = lidTopY - 4.0;

    const dirX = Math.cos(baseAngle);
    const dirZ = Math.sin(baseAngle);

    // 1. Vine handle (curved spline with leaf sprout at top)
    const handleSteps = 20;
    const handleStartV = 0;
    for (let ih = 0; ih <= handleSteps; ih++) {
      const t = ih / handleSteps;
      const len = t * (spoonLen - 26); // length of handle
      const hx = startX + dirX * (len * 0.45);
      const hz = startZ + dirZ * (len * 0.45);
      const hy = startY + len * 0.88 + Math.sin(t * Math.PI) * 5.0; // angled upright

      // Handle cross-section: 6-gon vine
      const handleR = 2.2 * (1.0 - t * 0.25);
      for (let is = 0; is <= 6; is++) {
        const a = (is / 6) * Math.PI * 2;
        const vx = hx + Math.sin(a) * handleR;
        const vz = hz + Math.cos(a) * handleR;
        positions.push(vx, hy, vz);
        uvs.push(is / 6, t);
      }
    }

    for (let ih = 0; ih < handleSteps; ih++) {
      for (let is = 0; is < 6; is++) {
        const p1 = handleStartV + ih * 7 + is;
        const p2 = p1 + 1;
        const p3 = handleStartV + (ih + 1) * 7 + is;
        const p4 = p3 + 1;
        indices.push(p1, p3, p2);
        indices.push(p2, p3, p4);
      }
    }

    // 2. Spoon Bowl (scoop for coffee/sugar)
    const bowlStartV = positions.length / 3;
    const bowlLength = 25;
    const bowlWidth = 16;
    const bowlDepth = 4.5;
    const bStepsL = 12;
    const bStepsW = 8;

    for (let il = 0; il <= bStepsL; il++) {
      const u = il / bStepsL; // 0 to 1
      const bx = startX - dirX * (u * bowlLength);
      const bz = startZ - dirZ * (u * bowlLength);
      const by = startY - u * 6.0;

      const wScale = Math.sin(u * Math.PI) * (bowlWidth / 2);

      for (let iw = 0; iw <= bStepsW; iw++) {
        const v = (iw / bStepsW) - 0.5; // -0.5 to +0.5
        const px = bx - dirZ * (v * wScale * 2);
        const pz = bz + dirX * (v * wScale * 2);

        // Concave scoop profile
        const scoopIndent = (1 - Math.pow(v * 2, 2)) * Math.sin(u * Math.PI) * bowlDepth;
        const py = by - scoopIndent;

        positions.push(px, py, pz);
        uvs.push(u, v + 0.5);

        // Bowl bottom wall (1.4mm thickness)
        positions.push(px, py - 1.4, pz);
        uvs.push(u, v + 0.5);
      }
    }

    const ptsW = (bStepsW + 1) * 2;
    for (let il = 0; il < bStepsL; il++) {
      for (let iw = 0; iw < bStepsW; iw++) {
        const c1 = bowlStartV + il * ptsW + iw * 2;
        const c2 = bowlStartV + il * ptsW + (iw + 1) * 2;
        const c3 = bowlStartV + (il + 1) * ptsW + iw * 2;
        const c4 = bowlStartV + (il + 1) * ptsW + (iw + 1) * 2;

        indices.push(c1, c3, c2);
        indices.push(c2, c3, c4);

        indices.push(c1 + 1, c2 + 1, c3 + 1);
        indices.push(c2 + 1, c4 + 1, c3 + 1);
      }
    }

    const spoonGeo = new THREE.BufferGeometry();
    spoonGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    spoonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    spoonGeo.setIndex(indices);
    spoonGeo.computeVertexNormals();

    spoonGeometries.push(spoonGeo);
  }

  return mergeGeometries(spoonGeometries);
}

/**
 * 8. Generate TPU Non-Slip Base Pad (Cubierta / Almohadilla Antideslizante de TPU):
 * - Exactly matches the pumpkin flat base contact footprint
 * - Thickness 1.8mm with gentle top chamfer to nest against the bottom
 * - Concentric anti-slip grip treads on bottom for silent, scratch-free countertop stability
 */
export function generateTpuBaseGeometry(
  params: PumpkinParams,
  orgParams: OrganizerStationParams
): THREE.BufferGeometry {
  const baseR = params.flatBaseDiameter / 2;
  const thick = orgParams.tpuThickness || 1.8;
  const segments = 48;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Pad sits directly under the pumpkin flat base at Y = 0 down to Y = -thick
  // 1. Top mating face (sits against pumpkin base at Y = 0)
  const topCenterV = 0;
  positions.push(0, 0, 0);
  uvs.push(0.5, 0.5);

  for (let is = 0; is <= segments; is++) {
    const angle = (is / segments) * Math.PI * 2;
    positions.push(Math.cos(angle) * (baseR - 0.5), 0, Math.sin(angle) * (baseR - 0.5));
    uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
  }

  for (let is = 1; is <= segments; is++) {
    indices.push(topCenterV, is, is + 1);
  }

  // 2. Outer side with chamfered rim
  const sideStartV = positions.length / 3;
  for (let is = 0; is <= segments; is++) {
    const angle = (is / segments) * Math.PI * 2;
    const tx = Math.cos(angle) * (baseR - 0.5);
    const tz = Math.sin(angle) * (baseR - 0.5);
    const bx = Math.cos(angle) * baseR;
    const bz = Math.sin(angle) * baseR;

    positions.push(tx, 0, tz);
    positions.push(bx, -thick, bz);
    uvs.push(is / segments, 1, is / segments, 0);
  }

  for (let is = 0; is < segments; is++) {
    const p1 = sideStartV + is * 2;
    const p2 = p1 + 1;
    const p3 = sideStartV + (is + 1) * 2;
    const p4 = p3 + 1;
    indices.push(p1, p3, p2);
    indices.push(p2, p3, p4);
  }

  // 3. Bottom contact face with 3 concentric anti-slip tread rings
  const botStartV = positions.length / 3;
  const ringCount = orgParams.tpuPatternRings || 3;

  for (let r = 0; r <= ringCount; r++) {
    const currentR = (baseR / ringCount) * r;
    const treadDepth = (r % 2 === 1) ? -thick : -thick + 0.35; // alternating tread rib

    for (let is = 0; is <= segments; is++) {
      const angle = (is / segments) * Math.PI * 2;
      positions.push(Math.cos(angle) * currentR, treadDepth, Math.sin(angle) * currentR);
      uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
    }
  }

  for (let r = 0; r < ringCount; r++) {
    const r1 = botStartV + r * (segments + 1);
    const r2 = botStartV + (r + 1) * (segments + 1);

    for (let is = 0; is < segments; is++) {
      const p1 = r1 + is;
      const p2 = p1 + 1;
      const p3 = r2 + is;
      const p4 = p3 + 1;
      // Facing downward
      indices.push(p1, p2, p3);
      indices.push(p2, p4, p3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * MASTER GENERATOR: Assembles the entire Coffee & Tea Organizer Station Model:
 * 1. Hollow pumpkin container body with coasters cylinder & 3 dividers
 * 2. Pumpkin lid with stepped rim & spoon docking notches
 * 3. Sculpted organic pumpkin leaves handle
 * 4. Dual-function spice shaker stem with dispenser holes
 * 5. Knurled shaker screw cap
 * 6. 4 stackable pumpkin-relief coasters
 * 7. 2 pumpkin-vine stirring spoons
 * 8. Flexible TPU non-slip base pad
 */
export function generateOrganizerStation(
  params: PumpkinParams,
  orgParams: OrganizerStationParams
): OrganizerStationModel {
  const splitFraction = (orgParams.lidSplitHeightPercent || 70) / 100;

  // First, compute full height bounding to normalize Y to build plate Y=0
  const tempOuter = getPumpkinSurfacePoint(0, 0, params, 1.0);
  const tempBottom = getPumpkinSurfacePoint(0, 0.05 * Math.PI, params, 1.0);
  const globalMinY = -(params.radius * params.heightScale * 0.85);

  // 1. Container Body
  const { geometry: containerGeometry, splitY } = generateOrganizerContainerBody(
    params,
    orgParams,
    splitFraction,
    globalMinY
  );

  // 2. Lid
  const lidGeometry = generateOrganizerLid(
    params,
    orgParams,
    splitFraction,
    globalMinY,
    splitY
  );

  lidGeometry.computeBoundingBox();
  const lidTopY = lidGeometry.boundingBox?.max.y || (splitY + 25);

  // 3. Leaf Handle
  const leafHandleGeometry = generateLeafHandleGeometry(
    params,
    orgParams,
    lidTopY
  );

  // 4. Spice Shaker Stem
  const shakerStemGeometry = generateShakerStemGeometry(
    params,
    orgParams,
    lidTopY
  );

  // 5. Shaker Cap
  const shakerCapGeometry = generateShakerCapGeometry(
    orgParams,
    lidTopY
  );

  // 6. Coasters Set
  const coasterR = (orgParams.coasterDiameter / 2) + 1.2;
  const innerCavityRadius = (params.radius - orgParams.wallThickness) * 0.88;
  const coasterCenterX = -(innerCavityRadius - coasterR - 4.0);
  const floorY = orgParams.wallThickness + 1.5;

  const coastersGeometry = generateCoastersGeometry(
    orgParams,
    coasterCenterX,
    0,
    floorY
  );

  // 7. Spoons
  const spoonsGeometry = generateSpoonsGeometry(
    orgParams,
    lidTopY,
    params.radius
  );

  // 8. TPU Base Pad
  const tpuBaseGeometry = generateTpuBaseGeometry(
    params,
    orgParams
  );

  // Unified merged geometry for print analysis and full-assembly export
  const mergedGeometry = mergeGeometries([
    containerGeometry,
    lidGeometry,
    leafHandleGeometry,
    shakerStemGeometry,
    shakerCapGeometry,
    coastersGeometry,
    spoonsGeometry
  ]);

  mergedGeometry.computeBoundingBox();
  const box = mergedGeometry.boundingBox || new THREE.Box3();
  const widthMm = Math.round((box.max.x - box.min.x) * 10) / 10;
  const heightMm = Math.round((box.max.y - box.min.y) * 10) / 10;
  const baseContactAreaMm2 = Math.round(Math.PI * Math.pow(params.flatBaseDiameter / 2, 2));

  return {
    containerGeometry,
    lidGeometry,
    leafHandleGeometry,
    shakerStemGeometry,
    shakerCapGeometry,
    coastersGeometry,
    spoonsGeometry,
    tpuBaseGeometry,
    mergedGeometry,
    boundingBox: box,
    splitY,
    heightMm,
    widthMm,
    baseContactAreaMm2
  };
}
