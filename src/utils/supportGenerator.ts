import * as THREE from 'three';
import { SupportSettings } from '../types';

export interface OverhangPoint {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  angleDeg: number;
}

export interface GeneratedSupportResult {
  supportGeometry: THREE.BufferGeometry;
  overhangPoints: OverhangPoint[];
  criticalOverhangCount: number;
  estimatedSupportFilamentGrams: number;
}

/**
 * Analyzes geometry faces to find points requiring 3D print support
 * (normals pointing downward greater than the overhang angle threshold)
 */
export function analyzeOverhangs(
  geometry: THREE.BufferGeometry,
  thresholdAngleDeg: number = 45,
  minHeightFromBed: number = 2.0 // ignore flat base touching the bed
): OverhangPoint[] {
  const overhangs: OverhangPoint[] = [];
  const posAttr = geometry.getAttribute('position');
  const normAttr = geometry.getAttribute('normal');
  const indexAttr = geometry.index;

  if (!posAttr || !normAttr) return overhangs;

  const thresholdCos = -Math.cos((90 - thresholdAngleDeg) * (Math.PI / 180));
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const nA = new THREE.Vector3();
  const nB = new THREE.Vector3();
  const nC = new THREE.Vector3();
  const faceCenter = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();

  const count = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

  for (let i = 0; i < count; i++) {
    let iA: number, iB: number, iC: number;
    if (indexAttr) {
      iA = indexAttr.getX(i * 3);
      iB = indexAttr.getX(i * 3 + 1);
      iC = indexAttr.getX(i * 3 + 2);
    } else {
      iA = i * 3;
      iB = i * 3 + 1;
      iC = i * 3 + 2;
    }

    vA.fromBufferAttribute(posAttr, iA);
    vB.fromBufferAttribute(posAttr, iB);
    vC.fromBufferAttribute(posAttr, iC);

    nA.fromBufferAttribute(normAttr, iA);
    nB.fromBufferAttribute(normAttr, iB);
    nC.fromBufferAttribute(normAttr, iC);

    faceCenter.copy(vA).add(vB).add(vC).divideScalar(3);
    faceNormal.copy(nA).add(nB).add(nC).divideScalar(3).normalize();

    // In 3D printing, Y is UP. Downward pointing normal has negative Y.
    // An overhang angle of 45° means normal.y < -cos(45°) = -0.707
    if (faceCenter.y > minHeightFromBed && faceNormal.y < thresholdCos) {
      const angleDeg = Math.round((Math.asin(-faceNormal.y) * 180) / Math.PI);
      overhangs.push({
        position: faceCenter.clone(),
        normal: faceNormal.clone(),
        angleDeg
      });
    }
  }

  return overhangs;
}

/**
 * Clusters overhang points into spaced anchor locations
 */
export function clusterOverhangPoints(points: OverhangPoint[], minDistance: number = 6.0): OverhangPoint[] {
  const clustered: OverhangPoint[] = [];

  for (const pt of points) {
    let tooClose = false;
    for (const c of clustered) {
      if (pt.position.distanceTo(c.position) < minDistance) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      clustered.push(pt);
    }
  }

  return clustered;
}

/**
 * Generates optimized tree-style and conical breakaway supports.
 * Features:
 * - Wide flared base on build plate for adhesion
 * - Strong, hollow/slender vertical trunk
 * - Sharp tapered micro-contact point (0.6mm - 0.8mm) at the contact interface
 * - Breakaway interface prevents surface scarring on the organic pumpkin skin
 */
export function generateOptimizedSupports(
  geometry: THREE.BufferGeometry,
  settings: SupportSettings
): GeneratedSupportResult {
  const rawOverhangs = analyzeOverhangs(geometry, settings.overhangThresholdAngle);
  
  // Cluster points based on support density spacing
  const spacing = Math.max(4.0, 14.0 - settings.supportDensity);
  const clusteredAnchors = clusterOverhangPoints(rawOverhangs, spacing);

  if (!settings.enabled || clusteredAnchors.length === 0) {
    return {
      supportGeometry: new THREE.BufferGeometry(),
      overhangPoints: rawOverhangs,
      criticalOverhangCount: rawOverhangs.length,
      estimatedSupportFilamentGrams: 0
    };
  }

  const allPositions: number[] = [];
  const allNormals: number[] = [];
  const allIndices: number[] = [];

  let vertexOffset = 0;
  let totalSupportVolumeMm3 = 0;

  for (const anchor of clusteredAnchors) {
    const contactPos = anchor.position;
    const targetY = contactPos.y;
    if (targetY < 2.5) continue; // no support needed for points practically on the bed

    const contactRadius = settings.contactPointDiameter / 2; // e.g. 0.3mm (0.6mm diameter)
    const trunkRadius = settings.branchDiameter / 2; // e.g. 1.8mm
    const baseRadius = trunkRadius * 1.8; // flared foot on plate

    // 4 vertical stages:
    // 0: Bed base (Y = 0) with wide foot
    // 1: Trunk start (Y = 2mm)
    // 2: Trunk upper neck (Y = targetY - 1.5mm)
    // 3: Breakaway micro-cone tip (Y = targetY - 0.3mm air gap for clean snap-off)
    const stages = [
      { y: 0, r: baseRadius },
      { y: Math.min(3.0, targetY * 0.2), r: trunkRadius },
      { y: Math.max(3.0, targetY - 2.0), r: trunkRadius },
      { y: targetY - 0.25, r: contactRadius } // sacrificial breakaway tip
    ];

    const radialSegments = 12;

    // Build lofted support column
    for (let is = 0; is < stages.length; is++) {
      const stage = stages[is];
      // Slight branch curve toward anchor position
      const t = is / (stages.length - 1);
      const cx = contactPos.x * (0.3 + 0.7 * t);
      const cz = contactPos.z * (0.3 + 0.7 * t);

      for (let ir = 0; ir < radialSegments; ir++) {
        const angle = (ir / radialSegments) * Math.PI * 2;
        const px = cx + Math.cos(angle) * stage.r;
        const pz = cz + Math.sin(angle) * stage.r;
        const py = stage.y;

        allPositions.push(px, py, pz);
        allNormals.push(Math.cos(angle), 0, Math.sin(angle));
      }
    }

    // Connect rings with quads (two triangles)
    for (let is = 0; is < stages.length - 1; is++) {
      const ring1Start = vertexOffset + is * radialSegments;
      const ring2Start = vertexOffset + (is + 1) * radialSegments;

      for (let ir = 0; ir < radialSegments; ir++) {
        const nextIr = (ir + 1) % radialSegments;
        const p1 = ring1Start + ir;
        const p2 = ring1Start + nextIr;
        const p3 = ring2Start + ir;
        const p4 = ring2Start + nextIr;

        allIndices.push(p1, p3, p2);
        allIndices.push(p2, p3, p4);
      }
    }

    // Close bottom base disc at Y = 0
    const bottomCenterIdx = allPositions.length / 3;
    allPositions.push(contactPos.x * 0.3, 0, contactPos.z * 0.3);
    allNormals.push(0, -1, 0);

    const baseRingStart = vertexOffset;
    for (let ir = 0; ir < radialSegments; ir++) {
      const nextIr = (ir + 1) % radialSegments;
      allIndices.push(bottomCenterIdx, baseRingStart + nextIr, baseRingStart + ir);
    }

    // Close top contact cone tip
    const topCenterIdx = allPositions.length / 3;
    allPositions.push(contactPos.x, targetY - 0.25, contactPos.z);
    allNormals.push(0, 1, 0);

    const topRingStart = vertexOffset + (stages.length - 1) * radialSegments;
    for (let ir = 0; ir < radialSegments; ir++) {
      const nextIr = (ir + 1) % radialSegments;
      allIndices.push(topCenterIdx, topRingStart + ir, topRingStart + nextIr);
    }

    vertexOffset = allPositions.length / 3;

    // Estimate volume for pillar (approx cylinder volume + flared base)
    const pillarVolume = Math.PI * Math.pow(trunkRadius, 2) * targetY;
    totalSupportVolumeMm3 += pillarVolume;
  }

  const supportGeometry = new THREE.BufferGeometry();
  supportGeometry.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
  supportGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(allNormals, 3));
  supportGeometry.setIndex(allIndices);
  supportGeometry.computeVertexNormals();

  // PLA density ~ 1.24 g/cm3 (1 cm3 = 1000 mm3), 15% infill for support
  const filamentGrams = (totalSupportVolumeMm3 / 1000) * 1.24 * 0.3;

  return {
    supportGeometry,
    overhangPoints: rawOverhangs,
    criticalOverhangCount: rawOverhangs.length,
    estimatedSupportFilamentGrams: Math.round(filamentGrams * 10) / 10
  };
}
