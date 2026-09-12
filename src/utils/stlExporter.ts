import * as THREE from 'three';

/**
 * Exports THREE.BufferGeometry to standard Binary STL format.
 * Converts Three.js Y-up coordinates to 3D printing Z-up coordinates so the model
 * immediately sits flat on the slicer build plate (Z=0).
 */
export function exportToBinarySTL(geometry: THREE.BufferGeometry, filename = 'calabaza_organica_3d.stl'): void {
  const posAttr = geometry.getAttribute('position');
  const indexAttr = geometry.index;

  if (!posAttr) {
    console.error('Geometry has no position attribute');
    return;
  }

  const triangleCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

  // 80 bytes header + 4 bytes triangle count + 50 bytes per triangle
  const bufferSize = 84 + triangleCount * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const dataView = new DataView(buffer);

  // Write 80-byte header
  const header = 'Calabaza 3D Organica para Impresion 3D - Base Plana & Soportes';
  for (let i = 0; i < 80; i++) {
    dataView.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  }

  // Write triangle count (little endian)
  dataView.setUint32(80, triangleCount, true);

  let offset = 84;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i < triangleCount; i++) {
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

    // Read Three.js coordinates (X, Y=up, Z)
    vA.fromBufferAttribute(posAttr, iA);
    vB.fromBufferAttribute(posAttr, iB);
    vC.fromBufferAttribute(posAttr, iC);

    // Convert to 3D Print Standard (X -> X, Y -> Z up, Z -> -Y):
    const printVA = new THREE.Vector3(vA.x, -vA.z, vA.y);
    const printVB = new THREE.Vector3(vB.x, -vB.z, vB.y);
    const printVC = new THREE.Vector3(vC.x, -vC.z, vC.y);

    // Calculate facet normal
    edge1.subVectors(printVB, printVA);
    edge2.subVectors(printVC, printVA);
    normal.crossVectors(edge1, edge2).normalize();

    // Normal (float32 x 3)
    dataView.setFloat32(offset, normal.x, true);
    dataView.setFloat32(offset + 4, normal.y, true);
    dataView.setFloat32(offset + 8, normal.z, true);
    offset += 12;

    // Vertex A (float32 x 3)
    dataView.setFloat32(offset, printVA.x, true);
    dataView.setFloat32(offset + 4, printVA.y, true);
    dataView.setFloat32(offset + 8, printVA.z, true);
    offset += 12;

    // Vertex B (float32 x 3)
    dataView.setFloat32(offset, printVB.x, true);
    dataView.setFloat32(offset + 4, printVB.y, true);
    dataView.setFloat32(offset + 8, printVB.z, true);
    offset += 12;

    // Vertex C (float32 x 3)
    dataView.setFloat32(offset, printVC.x, true);
    dataView.setFloat32(offset + 4, printVC.y, true);
    dataView.setFloat32(offset + 8, printVC.z, true);
    offset += 12;

    // Attribute byte count (uint16)
    dataView.setUint16(offset, 0, true);
    offset += 2;
  }

  // Trigger browser download
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Exports to Wavefront OBJ format
 */
export function exportToOBJ(geometry: THREE.BufferGeometry, filename = 'calabaza_organica_3d.obj'): void {
  const posAttr = geometry.getAttribute('position');
  const normAttr = geometry.getAttribute('normal');
  const indexAttr = geometry.index;

  if (!posAttr) return;

  let objContent = '# Calabaza 3D Organica para Impresion 3D\n';
  objContent += 'o Pumpkin\n';

  // Vertices
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    // Convert Y-up to Z-up for 3D printing
    objContent += `v ${x.toFixed(4)} ${(-z).toFixed(4)} ${y.toFixed(4)}\n`;
  }

  // Normals
  if (normAttr) {
    for (let i = 0; i < normAttr.count; i++) {
      const nx = normAttr.getX(i);
      const ny = normAttr.getY(i);
      const nz = normAttr.getZ(i);
      objContent += `vn ${nx.toFixed(4)} ${(-nz).toFixed(4)} ${ny.toFixed(4)}\n`;
    }
  }

  // Faces (1-based indices)
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 3) {
      const a = indexAttr.getX(i) + 1;
      const b = indexAttr.getX(i + 1) + 1;
      const c = indexAttr.getX(i + 2) + 1;
      objContent += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
    }
  } else {
    for (let i = 1; i <= posAttr.count; i += 3) {
      objContent += `f ${i}//${i} ${i + 1}//${i + 1} ${i + 2}//${i + 2}\n`;
    }
  }

  const blob = new Blob([objContent], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export { exportToOpenSCAD, generateOpenSCADScript } from './openscadExporter';
export type { OpenSCADExportOptions } from './openscadExporter';
