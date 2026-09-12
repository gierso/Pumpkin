import * as THREE from 'three';
import { PumpkinParams } from '../types';
import { fbmNoise3D, simplexNoise3D } from './noise';

export interface GeneratedPumpkinModel {
  bodyGeometry: THREE.BufferGeometry;
  stemGeometry: THREE.BufferGeometry;
  brimGeometry?: THREE.BufferGeometry;
  mergedGeometry: THREE.BufferGeometry;
  boundingBox: THREE.Box3;
  baseContactAreaMm2: number;
  heightMm: number;
  widthMm: number;
}

/**
 * Generates an organic, 3D-printable pumpkin body with:
 * - Natural ribs / lobes
 * - Organic asymmetry and procedural surface micro-texture
 * - Planar, stable flat base for build plate adhesion
 * - Top stem indentation (calyx)
 */
export function generatePumpkinBodyGeometry(params: PumpkinParams): {
  geometry: THREE.BufferGeometry;
  baseContactAreaMm2: number;
} {
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
    flatBaseChamfer,
    isHollow,
    wallThickness,
    bottomHoleDiameter,
    segmentsRadial,
    segmentsHeight
  } = params;

  const radialSteps = segmentsRadial || 72;
  const heightSteps = segmentsHeight || 54;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const flatBaseRadius = flatBaseDiameter / 2;
  const bottomCutAngle = Math.asin(Math.min(0.9, flatBaseRadius / (radius * 1.05)));

  // Grid of vertices: v goes from 0 (bottom pole) to heightSteps (top pole)
  // u goes from 0 to radialSteps
  for (let iv = 0; iv <= heightSteps; iv++) {
    const vFraction = iv / heightSteps; // 0 = south pole, 1 = north pole
    const phi = vFraction * Math.PI; // 0 (bottom) to PI (top)

    for (let iu = 0; iu <= radialSteps; iu++) {
      const uFraction = iu / radialSteps;
      const theta = uFraction * Math.PI * 2; // 0 to 2PI

      // 1. Base sphere coordinates
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      // 2. Rib modulation (organic lobes around circumference)
      // Natural pumpkins have irregular lobes: slightly different widths
      const ribAngle = theta * ribCount;
      // Slight asymmetric wobble in rib frequency
      const lobeWobble = Math.sin(theta * 3) * asymmetry * 0.5;
      const ribWave = Math.cos(ribAngle + lobeWobble);
      
      // Shape the rib profile (sharp furrow between rounded bulging lobes)
      const shapedRib = Math.sign(ribWave) * Math.pow(Math.abs(ribWave), ribSharpness);
      const ribFactor = 1.0 + (shapedRib - 0.5) * ribDepth;

      // Vertical attenuation: ribs are strongest at equator, tapering at poles
      const equatorFactor = Math.sin(phi);
      const ribDisplacement = 1.0 + (ribFactor - 1.0) * Math.pow(equatorFactor, 1.2);

      // 3. Asymmetric organic bulge (nature is never perfectly symmetric)
      const asymNoise = simplexNoise3D(
        Math.cos(theta) * 1.2,
        cosPhi * 1.2,
        Math.sin(theta) * 1.2
      ) * asymmetry * radius * 0.25;

      // 4. Realistic organic skin texture (micro-warts & natural striations)
      const skinNoise = fbmNoise3D(
        Math.cos(theta) * skinFrequency,
        (cosPhi * heightScale) * skinFrequency,
        Math.sin(theta) * skinFrequency,
        3, 2.2, 0.45
      ) * skinRoughness * radius * 0.15;

      // Compute initial radius in 3D
      let r = (radius * ribDisplacement + asymNoise + skinNoise);

      // 5. Crown & Bottom indentations
      // Pumpkins have an indented top where the stem meets, and indented bottom
      const topIndent = Math.pow(Math.max(0, cosPhi), 3.5) * (radius * 0.3);
      
      // Calculate coordinates with Y as UP
      let x = r * sinPhi * Math.cos(theta);
      let z = r * sinPhi * Math.sin(theta);
      let y = (cosPhi * radius * heightScale) - topIndent;

      // 6. FLAT BASE OPTIMIZATION FOR 3D PRINTING:
      // The user requested: "una base plana estable para mayor adherencia en la placa"
      // Cut/clamp the bottom region to a clean flat plane at Y = -bottomExtent
      // If phi is within the bottom zone or radius from center is <= flatBaseRadius:
      const horizontalDist = Math.hypot(x, z);
      const bottomThresholdY = -(radius * heightScale * 0.85);

      if (vFraction < 0.18 && horizontalDist <= flatBaseRadius + flatBaseChamfer) {
        // Flatten to build plate plane
        if (horizontalDist <= flatBaseRadius) {
          y = bottomThresholdY;
        } else {
          // Smooth transition / chamfer to avoid elephant foot & sharp stress corner
          const t = (horizontalDist - flatBaseRadius) / Math.max(0.01, flatBaseChamfer);
          const blend = (1 - Math.cos(t * Math.PI)) * 0.5;
          y = bottomThresholdY + (y - bottomThresholdY) * blend;
        }
      }

      // If hollow with bottom hole for tea light:
      if (isHollow && bottomHoleDiameter > 0 && horizontalDist < bottomHoleDiameter / 2 && vFraction < 0.08) {
        // push inward or create opening
        r *= 0.1;
        x = r * Math.cos(theta);
        z = r * Math.sin(theta);
      }

      positions.push(x, y, z);
      uvs.push(uFraction, vFraction);
    }
  }

  // Create faces (triangles)
  for (let iv = 0; iv < heightSteps; iv++) {
    for (let iu = 0; iu < radialSteps; iu++) {
      const p1 = iv * (radialSteps + 1) + iu;
      const p2 = p1 + 1;
      const p3 = (iv + 1) * (radialSteps + 1) + iu;
      const p4 = p3 + 1;

      // Two triangles per quad
      indices.push(p1, p3, p2);
      indices.push(p2, p3, p4);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Align lowest point to Y = 0 (build plate level)
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox?.min.y || 0;
  geometry.translate(0, -minY, 0);

  // Calculate actual flat base contact area (circle area approximately pi * r^2)
  const baseContactAreaMm2 = Math.round(Math.PI * Math.pow(flatBaseRadius, 2));

  return { geometry, baseContactAreaMm2 };
}

/**
 * Generates the detailed, organic twisted pumpkin stem:
 * - Fluted/ribbed star cross-section
 * - Organic helical twist & bend
 * - Fibrous bark roughness
 * - Top cut cap with woody concentric texture
 */
export function generatePumpkinStemGeometry(params: PumpkinParams, pumpkinTopY: number): THREE.BufferGeometry {
  const {
    stemLength,
    stemBaseRadius,
    stemTipRadius,
    stemCurvature,
    stemTwist,
    stemRibs,
    stemRoughness,
    stemTiltAngle
  } = params;

  const heightSteps = 36;
  const radialSteps = 32;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const radTilt = (stemTiltAngle * Math.PI) / 180;

  // Create curved stem spine
  const spinePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= heightSteps; i++) {
    const t = i / heightSteps;
    // Organic S-curve or natural bend
    const bend = Math.sin(t * Math.PI * 0.5) * stemCurvature * 20;
    const bendX = Math.cos(radTilt) * bend;
    const bendZ = Math.sin(radTilt) * bend;
    const y = pumpkinTopY - 2 + t * stemLength; // sinks 2mm into crown for solid 3D print union
    spinePoints.push(new THREE.Vector3(bendX, y, bendZ));
  }

  // Generate vertices along spine
  for (let ih = 0; ih <= heightSteps; ih++) {
    const t = ih / heightSteps;
    const center = spinePoints[ih];
    
    // Taper from base to tip, with flare at the base where it roots into the pumpkin
    const baseFlare = Math.pow(1 - t, 4) * (stemBaseRadius * 0.8);
    const radiusAtHeight = (stemBaseRadius * (1 - t) + stemTipRadius * t) + baseFlare;

    // Twist along height
    const currentTwist = t * stemTwist * Math.PI * 2;

    for (let ir = 0; ir <= radialSteps; ir++) {
      const u = ir / radialSteps;
      const angle = u * Math.PI * 2 + currentTwist;

      // Fluted stem star profile (5-7 ridges)
      const ribAngle = angle * stemRibs;
      const ribMod = 1.0 + Math.cos(ribAngle) * 0.28;

      // Fibrous rough bark noise
      const barkNoise = simplexNoise3D(
        Math.cos(angle) * 3,
        t * 12,
        Math.sin(angle) * 3
      ) * stemRoughness * 1.5;

      const r = Math.max(0.8, radiusAtHeight * ribMod + barkNoise);

      const vx = center.x + Math.cos(angle) * r;
      const vz = center.z + Math.sin(angle) * r;
      const vy = center.y;

      positions.push(vx, vy, vz);
      uvs.push(u, t);
    }
  }

  // Faces for stem tube
  for (let ih = 0; ih < heightSteps; ih++) {
    for (let ir = 0; ir < radialSteps; ir++) {
      const p1 = ih * (radialSteps + 1) + ir;
      const p2 = p1 + 1;
      const p3 = (ih + 1) * (radialSteps + 1) + ir;
      const p4 = p3 + 1;

      indices.push(p1, p3, p2);
      indices.push(p2, p3, p4);
    }
  }

  // Cap the top with a woody cut face
  const topCenterIndex = positions.length / 3;
  const tipCenter = spinePoints[heightSteps];
  positions.push(tipCenter.x, tipCenter.y + 0.3, tipCenter.z); // slightly convex cut
  uvs.push(0.5, 1.0);

  const topRingStart = heightSteps * (radialSteps + 1);
  for (let ir = 0; ir < radialSteps; ir++) {
    indices.push(
      topCenterIndex,
      topRingStart + ir,
      topRingStart + ir + 1
    );
  }

  // Cap the bottom to keep mesh manifold
  const bottomCenterIndex = positions.length / 3;
  const baseCenter = spinePoints[0];
  positions.push(baseCenter.x, baseCenter.y, baseCenter.z);
  uvs.push(0.5, 0.0);

  for (let ir = 0; ir < radialSteps; ir++) {
    indices.push(
      bottomCenterIndex,
      ir + 1,
      ir
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Generates an optional adhesion Brim ring (flat single layer ring on the build plate)
 */
export function generateBrimGeometry(flatBaseDiameter: number, brimWidth: number): THREE.BufferGeometry {
  const innerRadius = flatBaseDiameter / 2;
  const outerRadius = innerRadius + brimWidth;
  const segments = 48;

  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0.2, 0); // 0.2mm first layer height
  return geometry;
}

/**
 * Merges body and stem into a unified manifold BufferGeometry for export
 */
export function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const validGeoms = geometries.filter(g => g && g.getAttribute('position'));
  if (validGeoms.length === 0) return new THREE.BufferGeometry();
  if (validGeoms.length === 1) return validGeoms[0].clone();

  let totalVertices = 0;
  let totalIndices = 0;

  for (const g of validGeoms) {
    totalVertices += g.getAttribute('position').count;
    if (g.index) {
      totalIndices += g.index.count;
    }
  }

  const mergedPositions = new Float32Array(totalVertices * 3);
  const mergedNormals = new Float32Array(totalVertices * 3);
  const mergedIndices = new Uint32Array(totalIndices);

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const g of validGeoms) {
    const pos = g.getAttribute('position');
    const norm = g.getAttribute('normal');
    const idx = g.index;

    mergedPositions.set(pos.array, vertexOffset * 3);
    if (norm) {
      mergedNormals.set(norm.array, vertexOffset * 3);
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        mergedIndices[indexOffset + i] = idx.getX(i) + vertexOffset;
      }
      indexOffset += idx.count;
    }

    vertexOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
  merged.setIndex(new THREE.BufferAttribute(mergedIndices, 1));
  merged.computeBoundingBox();

  return merged;
}

/**
 * Master generator function
 */
export function generateCompletePumpkin(params: PumpkinParams): GeneratedPumpkinModel {
  const { geometry: bodyGeometry, baseContactAreaMm2 } = generatePumpkinBodyGeometry(params);
  
  bodyGeometry.computeBoundingBox();
  const maxY = bodyGeometry.boundingBox?.max.y || (params.radius * params.heightScale);

  const stemGeometry = generatePumpkinStemGeometry(params, maxY);
  
  let brimGeometry: THREE.BufferGeometry | undefined;
  if (params.addBrim) {
    brimGeometry = generateBrimGeometry(params.flatBaseDiameter, params.brimWidth);
  }

  const mergedGeometry = mergeGeometries([bodyGeometry, stemGeometry]);
  mergedGeometry.computeBoundingBox();
  const box = mergedGeometry.boundingBox || new THREE.Box3();

  const widthMm = Math.round((box.max.x - box.min.x) * 10) / 10;
  const heightMm = Math.round((box.max.y - box.min.y) * 10) / 10;

  return {
    bodyGeometry,
    stemGeometry,
    brimGeometry,
    mergedGeometry,
    boundingBox: box,
    baseContactAreaMm2,
    heightMm,
    widthMm
  };
}
