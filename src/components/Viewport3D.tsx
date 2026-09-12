import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  PumpkinParams,
  SupportSettings,
  PrintSettings,
  StationViewMode,
  StationPartId
} from '../types';
import { GeneratedPumpkinModel } from '../utils/pumpkinGeometry';
import { GeneratedSupportResult } from '../utils/supportGenerator';
import { OrganizerStationModel } from '../utils/stationGeometry';
import {
  RotateCcw,
  Eye,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid,
  Sun,
  Scissors,
  Coffee,
  Sparkles,
  ShieldCheck,
  Disc,
  Utensils,
  AlertTriangle
} from 'lucide-react';

interface Viewport3DProps {
  pumpkinModel: GeneratedPumpkinModel;
  supportResult: GeneratedSupportResult;
  pumpkinParams: PumpkinParams;
  supportSettings: SupportSettings;
  printSettings: PrintSettings;
  activeLayerPercent: number; // 0 to 100 for slicer inspection
  sliceMode: boolean;
  materialMode: 'realistic' | 'clay' | 'overhang' | 'print';
  isStationMode?: boolean;
  stationModel?: OrganizerStationModel;
  stationViewMode?: StationViewMode;
  onStationViewModeChange?: (mode: StationViewMode) => void;
  activePartId?: StationPartId;
  onActivePartIdChange?: (part: StationPartId) => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  pumpkinModel,
  supportResult,
  pumpkinParams,
  supportSettings,
  activeLayerPercent,
  sliceMode,
  materialMode,
  isStationMode = false,
  stationModel,
  stationViewMode = 'assembled',
  onStationViewModeChange,
  activePartId = 'all',
  onActivePartIdChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Classic Pumpkin Meshes
  const bodyMeshRef = useRef<THREE.Mesh | null>(null);
  const stemMeshRef = useRef<THREE.Mesh | null>(null);
  const brimMeshRef = useRef<THREE.Mesh | null>(null);
  const supportMeshRef = useRef<THREE.Mesh | null>(null);

  // Station Meshes
  const stationGroupRef = useRef<THREE.Group | null>(null);
  const containerMeshRef = useRef<THREE.Mesh | null>(null);
  const lidMeshRef = useRef<THREE.Mesh | null>(null);
  const leafHandleMeshRef = useRef<THREE.Mesh | null>(null);
  const shakerStemMeshRef = useRef<THREE.Mesh | null>(null);
  const shakerCapMeshRef = useRef<THREE.Mesh | null>(null);
  const coastersMeshRef = useRef<THREE.Mesh | null>(null);
  const spoonsMeshRef = useRef<THREE.Mesh | null>(null);
  const tpuBaseMeshRef = useRef<THREE.Mesh | null>(null);

  // Clipping Planes
  const sliceClipPlaneRef = useRef<THREE.Plane | null>(null);
  const cutawayClipPlaneRef = useRef<THREE.Plane | null>(null);

  // View state
  const [cameraView, setCameraView] = useState<'perspective' | 'front' | 'bottom' | 'top'>('perspective');
  const [showGrid, setShowGrid] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Interaction tracking for smooth orbit controls
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const cameraAnglesRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3, radius: 180 });
  const cameraTargetRef = useRef(new THREE.Vector3(0, 35, 0));
  const autoRotateRef = useRef(autoRotate);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = Math.max(containerRef.current.clientWidth, 100);
    const height = Math.max(containerRef.current.clientHeight, 100);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x13171f);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 2000);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        powerPreference: 'high-performance'
      });
    } catch (err) {
      console.error('WebGL high-performance failed, attempting fallback:', err);
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          antialias: false,
          powerPreference: 'default'
        });
      } catch (fallbackErr) {
        console.error('All WebGL contexts failed:', fallbackErr);
        setWebglError('No se pudo inicializar el motor gráfico 3D WebGL en este navegador o entorno.');
        return;
      }
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;

    // Lighting setup for studio/print preview
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.35);
    keyLight.position.set(130, 210, 150);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7598c0, 0.65);
    fillLight.position.set(-130, 90, -110);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffb044, 0.75);
    rimLight.position.set(0, -60, -150);
    scene.add(rimLight);

    // Build Plate (220 x 220 mm)
    const bedGroup = new THREE.Group();
    bedGroup.name = 'bedGroup';

    // Bed plate surface
    const bedGeo = new THREE.PlaneGeometry(220, 220);
    bedGeo.rotateX(-Math.PI / 2);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x1a2130,
      roughness: 0.85,
      metalness: 0.1
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.position.y = -0.05;
    bedMesh.receiveShadow = true;
    bedGroup.add(bedMesh);

    // Bed 10mm grid
    const gridHelper = new THREE.GridHelper(220, 22, 0x38bdf8, 0x273549);
    gridHelper.position.y = 0.05;
    bedGroup.add(gridHelper);

    // Bed border lines (220x220 boundary)
    const borderPoints = [
      new THREE.Vector3(-110, 0.1, -110),
      new THREE.Vector3(110, 0.1, -110),
      new THREE.Vector3(110, 0.1, 110),
      new THREE.Vector3(-110, 0.1, 110),
      new THREE.Vector3(-110, 0.1, -110)
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2 });
    const borderLine = new THREE.Line(borderGeo, borderMat);
    bedGroup.add(borderLine);

    scene.add(bedGroup);

    // Slicing plane (horizontal Y-cut)
    sliceClipPlaneRef.current = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);

    // Cutaway plane (front-to-back cross-section cut showing hollow inside)
    cutawayClipPlaneRef.current = new THREE.Plane(new THREE.Vector3(0, 0, -1), 2);

    // Update camera position helper
    const updateCameraPos = () => {
      const { theta, phi, radius } = cameraAnglesRef.current;
      const target = cameraTargetRef.current;
      camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = target.y + radius * Math.cos(phi);
      camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(target);
    };
    updateCameraPos();

    // Render loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (autoRotateRef.current) {
        cameraAnglesRef.current.theta += 0.005;
        updateCameraPos();
      }

      try {
        renderer.render(scene, camera);
      } catch (renderErr) {
        console.warn('Render error in Viewport3D:', renderErr);
      }
    };
    animate();

    // ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Update Bed visibility
  useEffect(() => {
    if (!sceneRef.current) return;
    const bed = sceneRef.current.getObjectByName('bedGroup');
    if (bed) bed.visible = showGrid;
  }, [showGrid]);

  // Determine active clipping planes
  const activeClippingPlanes = useMemo(() => {
    const planes: THREE.Plane[] = [];
    if (sliceMode && sliceClipPlaneRef.current) {
      planes.push(sliceClipPlaneRef.current);
    }
    if (isStationMode && stationViewMode === 'cutaway' && cutawayClipPlaneRef.current) {
      planes.push(cutawayClipPlaneRef.current);
    }
    return planes;
  }, [sliceMode, isStationMode, stationViewMode]);

  // Materials definition
  const materials = useMemo(() => {
    const clippingPlanes = activeClippingPlanes;

    if (materialMode === 'clay') {
      const clayMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.6,
        metalness: 0.05,
        clippingPlanes,
        clipShadows: true,
        side: THREE.DoubleSide
      });
      return {
        bodyMat: clayMat,
        stemMat: clayMat,
        containerMat: clayMat,
        lidMat: clayMat,
        leavesMat: clayMat,
        shakerMat: clayMat,
        capMat: clayMat,
        coastersMat: clayMat,
        spoonsMat: clayMat,
        tpuMat: clayMat
      };
    }

    if (materialMode === 'print') {
      // 3D Printing filament look
      const filamentOrange = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        roughness: 0.35,
        metalness: 0.12,
        clippingPlanes,
        clipShadows: true,
        side: THREE.DoubleSide
      });
      const filamentGreen = new THREE.MeshStandardMaterial({
        color: 0x65a30d,
        roughness: 0.45,
        metalness: 0.1,
        clippingPlanes,
        clipShadows: true,
        side: THREE.DoubleSide
      });
      const filamentWood = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.65,
        metalness: 0.05,
        clippingPlanes,
        clipShadows: true,
        side: THREE.DoubleSide
      });
      const filamentTpu = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.85,
        metalness: 0.05,
        clippingPlanes,
        clipShadows: true,
        side: THREE.DoubleSide
      });

      return {
        bodyMat: filamentOrange,
        stemMat: filamentGreen,
        containerMat: filamentOrange,
        lidMat: filamentOrange,
        leavesMat: filamentGreen,
        shakerMat: filamentGreen,
        capMat: filamentGreen,
        coastersMat: filamentWood,
        spoonsMat: filamentGreen,
        tpuMat: filamentTpu
      };
    }

    // Realistic Organic Materials
    const pumpkinBodyMat = new THREE.MeshStandardMaterial({
      color: 0xeb6b14,
      roughness: 0.48,
      metalness: 0.06,
      clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });

    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x4d5b36,
      roughness: 0.72,
      metalness: 0.05,
      clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });

    // Station specific rich realistic textures
    const containerMat = new THREE.MeshStandardMaterial({
      color: 0xeb6414,
      roughness: 0.45,
      metalness: 0.06,
      clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });

    const lidMat = new THREE.MeshStandardMaterial({
      color: 0xf3751a,
      roughness: 0.44,
      metalness: 0.06,
      clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });

    const leavesMat = new THREE.MeshStandardMaterial({
      color: 0x3d7036,
      roughness: 0.55,
      metalness: 0.08,
      clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });

    const shakerMat = new THREE.MeshStandardMaterial({
      color: 0x5a6d38,
      roughness: 0.65,
      metalness: 0.08,
      clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });

    const capMat = new THREE.MeshStandardMaterial({
      color: 0x455628,
      roughness: 0.55,
      metalness: 0.15,
      clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });

    // Toasted warm cork/bamboo wood look for coasters
    const coastersMat = new THREE.MeshStandardMaterial({
      color: 0xc89658,
      roughness: 0.75,
      metalness: 0.02,
      clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });

    // Tea spoons in organic vine stem green
    const spoonsMat = new THREE.MeshStandardMaterial({
      color: 0x6e9646,
      roughness: 0.40,
      metalness: 0.12,
      clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });

    // Anti-slip flexible TPU mat (dark rubber texture)
    const tpuMat = new THREE.MeshStandardMaterial({
      color: 0x1c1e24,
      roughness: 0.90,
      metalness: 0.04,
      clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });

    return {
      bodyMat: pumpkinBodyMat,
      stemMat,
      containerMat,
      lidMat,
      leavesMat,
      shakerMat,
      capMat,
      coastersMat,
      spoonsMat,
      tpuMat
    };
  }, [materialMode, activeClippingPlanes]);

  // Update Slicing Height
  useEffect(() => {
    if (!sliceClipPlaneRef.current) return;
    const box = isStationMode && stationModel ? stationModel.boundingBox : pumpkinModel.boundingBox;
    if (sliceMode && box) {
      const maxY = box.max.y;
      const currentCutY = (activeLayerPercent / 100) * maxY;
      sliceClipPlaneRef.current.constant = currentCutY;
    }
  }, [sliceMode, activeLayerPercent, pumpkinModel, stationModel, isStationMode]);

  // Update Meshes in Scene when mode or geometries change
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Clean up Classic Pumpkin Meshes
    if (bodyMeshRef.current) scene.remove(bodyMeshRef.current);
    if (stemMeshRef.current) scene.remove(stemMeshRef.current);
    if (brimMeshRef.current) scene.remove(brimMeshRef.current);
    if (supportMeshRef.current) scene.remove(supportMeshRef.current);

    // Clean up Station Group
    if (stationGroupRef.current) {
      scene.remove(stationGroupRef.current);
      stationGroupRef.current = null;
    }

    if (isStationMode && stationModel) {
      // ----------------------------------------------------
      // RENDER ORGANIZER STATION MODE
      // ----------------------------------------------------
      const stationGroup = new THREE.Group();
      stationGroup.name = 'stationGroup';

      // Compute exploded/lid-off vertical offsets
      let tpuY = 0;
      let containerY = 0;
      let coastersY = 0;
      let lidY = 0;
      let leavesY = 0;
      let spoonsY = 0;
      let shakerY = 0;
      let capY = 0;

      if (stationViewMode === 'lid-off') {
        // Lift lid assembly +55mm so user can see inside container, coasters, and dividers
        lidY = 55;
        leavesY = 55;
        spoonsY = 55;
        shakerY = 55;
        capY = 55;
      } else if (stationViewMode === 'exploded') {
        // Complete exploded vertical stack
        tpuY = -22;
        containerY = 0;
        coastersY = 32; // lifted out of the cylinder
        lidY = 55;
        leavesY = 75;
        spoonsY = 88;
        shakerY = 110;
        capY = 135;
      }

      const shouldShow = (id: StationPartId) => {
        if (stationViewMode !== 'solo-part') return true;
        return activePartId === id;
      };

      // 1. TPU Base
      if (shouldShow('tpu-base')) {
        const m = new THREE.Mesh(stationModel.tpuBaseGeometry, materials.tpuMat);
        m.position.y = tpuY;
        m.castShadow = true;
        m.receiveShadow = true;
        stationGroup.add(m);
        tpuBaseMeshRef.current = m;
      }

      // 2. Hollow Container with Coasters Well & Dividers
      if (shouldShow('container')) {
        const m = new THREE.Mesh(stationModel.containerGeometry, materials.containerMat);
        m.position.y = containerY;
        m.castShadow = true;
        m.receiveShadow = true;
        stationGroup.add(m);
        containerMeshRef.current = m;
      }

      // 3. Coasters Stack
      if (shouldShow('coasters')) {
        const m = new THREE.Mesh(stationModel.coastersGeometry, materials.coastersMat);
        m.position.y = coastersY;
        m.castShadow = true;
        m.receiveShadow = true;
        stationGroup.add(m);
        coastersMeshRef.current = m;
      }

      // 4. Lid with Stepped Rim
      if (shouldShow('lid')) {
        const m = new THREE.Mesh(stationModel.lidGeometry, materials.lidMat);
        m.position.y = lidY;
        m.castShadow = true;
        m.receiveShadow = true;
        stationGroup.add(m);
        lidMeshRef.current = m;
      }

      // 5. Leaf Handle
      if (shouldShow('lid')) {
        const m = new THREE.Mesh(stationModel.leafHandleGeometry, materials.leavesMat);
        m.position.y = leavesY;
        m.castShadow = true;
        m.receiveShadow = true;
        stationGroup.add(m);
        leafHandleMeshRef.current = m;
      }

      // 6. Dual-Function Spice Shaker Stem
      if (shouldShow('shaker-stem')) {
        const m = new THREE.Mesh(stationModel.shakerStemGeometry, materials.shakerMat);
        m.position.y = shakerY;
        m.castShadow = true;
        m.receiveShadow = true;
        stationGroup.add(m);
        shakerStemMeshRef.current = m;
      }

      // 7. Shaker Cap
      if (shouldShow('shaker-cap')) {
        const m = new THREE.Mesh(stationModel.shakerCapGeometry, materials.capMat);
        m.position.y = capY;
        m.castShadow = true;
        m.receiveShadow = true;
        stationGroup.add(m);
        shakerCapMeshRef.current = m;
      }

      // 8. Thematic Spoons
      if (shouldShow('spoons')) {
        const m = new THREE.Mesh(stationModel.spoonsGeometry, materials.spoonsMat);
        m.position.y = spoonsY;
        m.castShadow = true;
        m.receiveShadow = true;
        stationGroup.add(m);
        spoonsMeshRef.current = m;
      }

      scene.add(stationGroup);
      stationGroupRef.current = stationGroup;

      // Adjust camera target
      const box = stationModel.boundingBox;
      const midY = (box.max.y - box.min.y) * 0.45;
      cameraTargetRef.current.set(0, midY, 0);

    } else {
      // ----------------------------------------------------
      // RENDER CLASSIC PUMPKIN MODE
      // ----------------------------------------------------
      // 1. Pumpkin Body Mesh
      const bodyMesh = new THREE.Mesh(pumpkinModel.bodyGeometry, materials.bodyMat);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      scene.add(bodyMesh);
      bodyMeshRef.current = bodyMesh;

      // 2. Detailed Stem Mesh
      const stemMesh = new THREE.Mesh(pumpkinModel.stemGeometry, materials.stemMat);
      stemMesh.castShadow = true;
      stemMesh.receiveShadow = true;
      scene.add(stemMesh);
      stemMeshRef.current = stemMesh;

      // 3. Brim Mesh (if enabled)
      if (pumpkinModel.brimGeometry) {
        const brimMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          transparent: true,
          opacity: 0.8
        });
        const brimMesh = new THREE.Mesh(pumpkinModel.brimGeometry, brimMat);
        scene.add(brimMesh);
        brimMeshRef.current = brimMesh;
      }

      // 4. Support System Mesh
      if (
        supportSettings.enabled &&
        supportResult.supportGeometry &&
        supportResult.supportGeometry.getAttribute('position')
      ) {
        const supportMat = new THREE.MeshStandardMaterial({
          color: 0x06b6d4, // cyan technical support
          roughness: 0.5,
          metalness: 0.1,
          transparent: true,
          opacity: 0.85,
          clippingPlanes: activeClippingPlanes
        });
        const supportMesh = new THREE.Mesh(supportResult.supportGeometry, supportMat);
        supportMesh.castShadow = true;
        scene.add(supportMesh);
        supportMeshRef.current = supportMesh;
      }

      // Center camera target around pumpkin center
      const box = pumpkinModel.boundingBox;
      const midY = (box.max.y - box.min.y) * 0.45;
      cameraTargetRef.current.set(0, midY, 0);
    }

  }, [
    isStationMode,
    stationModel,
    stationViewMode,
    activePartId,
    pumpkinModel,
    supportResult,
    supportSettings.enabled,
    materials,
    activeClippingPlanes
  ]);

  // Preset Camera Angles
  const setViewAngle = (view: 'perspective' | 'front' | 'bottom' | 'top') => {
    setCameraView(view);
    setAutoRotate(false);

    if (view === 'perspective') {
      cameraAnglesRef.current.theta = Math.PI / 4;
      cameraAnglesRef.current.phi = Math.PI / 3;
      cameraAnglesRef.current.radius = 180;
    } else if (view === 'front') {
      cameraAnglesRef.current.theta = 0;
      cameraAnglesRef.current.phi = Math.PI / 2;
      cameraAnglesRef.current.radius = 180;
    } else if (view === 'bottom') {
      // Bottom view: crucial to inspect flat base adhesion contact!
      cameraAnglesRef.current.theta = 0;
      cameraAnglesRef.current.phi = Math.PI * 0.88;
      cameraAnglesRef.current.radius = 150;
    } else if (view === 'top') {
      cameraAnglesRef.current.theta = 0;
      cameraAnglesRef.current.phi = 0.05;
      cameraAnglesRef.current.radius = 180;
    }

    // Update camera immediately
    if (cameraRef.current) {
      const { theta, phi, radius } = cameraAnglesRef.current;
      const target = cameraTargetRef.current;
      cameraRef.current.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      cameraRef.current.position.y = target.y + radius * Math.cos(phi);
      cameraRef.current.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.lookAt(target);
    }
  };

  // Mouse & Touch Controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || e.shiftKey) {
      isPanningRef.current = true;
    } else {
      isDraggingRef.current = true;
    }
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current && !isPanningRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (isDraggingRef.current) {
      cameraAnglesRef.current.theta -= dx * 0.008;
      cameraAnglesRef.current.phi = Math.max(0.05, Math.min(Math.PI * 0.95, cameraAnglesRef.current.phi - dy * 0.008));
    } else if (isPanningRef.current) {
      cameraTargetRef.current.y += dy * 0.15;
    }

    if (cameraRef.current) {
      const { theta, phi, radius } = cameraAnglesRef.current;
      const target = cameraTargetRef.current;
      cameraRef.current.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      cameraRef.current.position.y = target.y + radius * Math.cos(phi);
      cameraRef.current.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.lookAt(target);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY * 0.12;
    cameraAnglesRef.current.radius = Math.max(40, Math.min(480, cameraAnglesRef.current.radius + zoomFactor));

    if (cameraRef.current) {
      const { theta, phi, radius } = cameraAnglesRef.current;
      const target = cameraTargetRef.current;
      cameraRef.current.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      cameraRef.current.position.y = target.y + radius * Math.cos(phi);
      cameraRef.current.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.lookAt(target);
    }
  };

  return (
    <div
      ref={containerRef}
      id="viewport-container"
      className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-2xl overflow-hidden select-none cursor-grab active:cursor-grabbing border border-slate-800/80 shadow-2xl"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating Top-Left HUD */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        {isStationMode ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-amber-500/40 rounded-xl px-3.5 py-2 text-xs shadow-lg flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <div>
              <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-amber-400" />
                <span>Estación Cafetera & Organizador de Té</span>
              </div>
              <div className="text-slate-300 font-mono text-[11px] mt-0.5">
                Autosoportada • Con cilindro coasters, separadores & salero
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl px-3.5 py-2 text-xs shadow-lg flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <div className="font-semibold text-slate-200">Base Plana de Impresión</div>
              <div className="text-slate-400 font-mono text-[11px]">
                Ø {pumpkinParams.flatBaseDiameter} mm • Área: {pumpkinModel.baseContactAreaMm2} mm²
              </div>
            </div>
          </div>
        )}

        {!isStationMode && supportSettings.enabled && (
          <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 rounded-xl px-3.5 py-2 text-xs shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <div>
              <span className="font-medium text-cyan-200">Soportes Breakaway Activos</span>
              <span className="text-slate-400 ml-1.5 font-mono text-[11px]">
                Punta: {supportSettings.contactPointDiameter}mm
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Top-Right: Camera View Angle Quick Selectors */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-lg pointer-events-auto">
        <button
          id="btn-view-perspective"
          onClick={() => setViewAngle('perspective')}
          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
            cameraView === 'perspective' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Vista Perspectiva"
        >
          Perspectiva
        </button>
        <button
          id="btn-view-front"
          onClick={() => setViewAngle('front')}
          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
            cameraView === 'front' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Vista Frontal"
        >
          Frente
        </button>
        <button
          id="btn-view-bottom"
          onClick={() => setViewAngle('bottom')}
          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
            cameraView === 'bottom' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Inspeccionar Base Plana Inferior"
        >
          Base Plana
        </button>
        <button
          id="btn-view-top"
          onClick={() => setViewAngle('top')}
          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
            cameraView === 'top' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Vista Superior Tallo"
        >
          Superior
        </button>
      </div>

      {/* Station Mode Interactive View Bar (Top-Center Floating) */}
      {isStationMode && onStationViewModeChange && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1.5 shadow-2xl pointer-events-auto">
          <button
            id="btn-station-view-assembled"
            onClick={() => onStationViewModeChange('assembled')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              stationViewMode === 'assembled'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ensamblado</span>
          </button>

          <button
            id="btn-station-view-cutaway"
            onClick={() => onStationViewModeChange('cutaway')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              stationViewMode === 'cutaway'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Corte en sección para ver el cilindro de posavasos, separadores y cavidades interiores"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Corte Interior</span>
          </button>

          <button
            id="btn-station-view-lid-off"
            onClick={() => onStationViewModeChange('lid-off')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              stationViewMode === 'lid-off'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Levantar la tapa con hojas para ver el compartimento de té y posavasos desde arriba"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Sin Tapa</span>
          </button>

          <button
            id="btn-station-view-exploded"
            onClick={() => onStationViewModeChange('exploded')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              stationViewMode === 'exploded'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Separar verticalmente todas las piezas (base TPU, contenedor, coasters, tapa, hojas, salero, cucharitas)"
          >
            <Maximize className="w-3.5 h-3.5" />
            <span>Explosionado</span>
          </button>

          {/* Submenu for Solo-part inspection */}
          <div className="h-4 w-px bg-slate-700 mx-1" />

          <select
            id="select-active-part"
            value={stationViewMode === 'solo-part' ? activePartId : 'all'}
            onChange={(e) => {
              const val = e.target.value as StationPartId;
              if (val === 'all') {
                onStationViewModeChange('assembled');
                if (onActivePartIdChange) onActivePartIdChange('all');
              } else {
                onStationViewModeChange('solo-part');
                if (onActivePartIdChange) onActivePartIdChange(val);
              }
            }}
            className="bg-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">Ver Todas las Piezas</option>
            <option value="container">Pieza: Contenedor Base (Hueco)</option>
            <option value="lid">Pieza: Tapa con Labio</option>
            <option value="shaker-stem">Pieza: Tallo Salero/Especiero</option>
            <option value="shaker-cap">Pieza: Tapita del Salero</option>
            <option value="coasters">Pieza: Set de Posavasos</option>
            <option value="spoons">Pieza: 2 Cucharitas</option>
            <option value="tpu-base">Pieza: Base TPU Antideslizante</option>
          </select>
        </div>
      )}

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        {/* Helper instructions */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-3 py-1.5 shadow">
          <span>Arrastra para rotar</span>
          <span>•</span>
          <span>Rueda para zoom</span>
          <span>•</span>
          <span>Shift+Arrastrar para mover</span>
        </div>

        {/* Viewport Action Icons */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-lg ml-auto pointer-events-auto">
          <button
            id="btn-toggle-grid"
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded-lg text-xs transition-colors ${
              showGrid ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Cama de impresión 220x220mm"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            id="btn-toggle-autorotate"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-2 rounded-lg text-xs transition-colors ${
              autoRotate ? 'bg-orange-600/30 text-orange-400 border border-orange-500/50' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Rotación automática"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            id="btn-reset-camera"
            onClick={() => setViewAngle('perspective')}
            className="p-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Centrar cámara"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* WebGL Failure Fallback Card */}
      {webglError && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-50">
          <div className="w-14 h-14 rounded-2xl bg-orange-950/80 border border-orange-500/50 flex items-center justify-center text-orange-400 mb-4 shadow-xl shadow-orange-950/50">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-100 mb-1">Aceleración Gráfica 3D No Disponible</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">{webglError}</p>
          <div className="text-[11px] text-slate-400 bg-slate-900 border border-slate-800 rounded-xl p-3.5 max-w-sm text-left space-y-1.5">
            <div className="font-semibold text-slate-200">Cómo solucionarlo:</div>
            <div>• Activa la opción <strong>Usar aceleración por hardware</strong> en los ajustes de tu navegador.</div>
            <div>• Verifica que WebGL esté habilitado en tu navegador (chrome://gpu).</div>
          </div>
        </div>
      )}
    </div>
  );
};
