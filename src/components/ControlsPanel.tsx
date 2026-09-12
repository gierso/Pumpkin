import React, { useState } from 'react';
import {
  PumpkinParams,
  SupportSettings,
  PrintSettings,
  AppMode,
  OrganizerStationParams,
  StationPartId
} from '../types';
import { GeneratedPumpkinModel } from '../utils/pumpkinGeometry';
import { GeneratedSupportResult } from '../utils/supportGenerator';
import { PrintEstimationResult } from '../utils/printEstimator';
import { OrganizerStationModel } from '../utils/stationGeometry';
import { exportToBinarySTL } from '../utils/stlExporter';
import {
  Sparkles,
  Sliders,
  ShieldCheck,
  Layers,
  TreeDeciduous,
  Code2,
  Coffee,
  Disc,
  Utensils,
  Download,
  CheckCircle2,
  SlidersHorizontal,
  Package,
  Wrench,
  RotateCcw
} from 'lucide-react';

interface ControlsPanelProps {
  params: PumpkinParams;
  onParamsChange: (newParams: PumpkinParams) => void;
  supportSettings: SupportSettings;
  onSupportChange: (newSettings: SupportSettings) => void;
  printSettings: PrintSettings;
  onPrintSettingsChange: (newSettings: PrintSettings) => void;
  pumpkinModel: GeneratedPumpkinModel;
  supportResult: GeneratedSupportResult;
  printEstimation: PrintEstimationResult;
  sliceMode: boolean;
  onSliceModeChange: (enabled: boolean) => void;
  activeLayerPercent: number;
  onActiveLayerPercentChange: (percent: number) => void;
  materialMode: 'realistic' | 'clay' | 'overhang' | 'print';
  onMaterialModeChange: (mode: 'realistic' | 'clay' | 'overhang' | 'print') => void;

  // Station Mode Integration Props
  appMode?: AppMode;
  onAppModeChange?: (mode: AppMode) => void;
  organizerParams?: OrganizerStationParams;
  onOrganizerParamsChange?: (newParams: OrganizerStationParams) => void;
  stationModel?: OrganizerStationModel;
  onOpenOpenSCADModal?: () => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  params,
  onParamsChange,
  supportSettings,
  onSupportChange,
  printSettings,
  onPrintSettingsChange,
  pumpkinModel,
  supportResult,
  printEstimation,
  sliceMode,
  onSliceModeChange,
  activeLayerPercent,
  onActiveLayerPercentChange,
  materialMode,
  onMaterialModeChange,
  appMode = 'station',
  onAppModeChange,
  organizerParams,
  onOrganizerParamsChange,
  stationModel,
  onOpenOpenSCADModal
}) => {
  // Classic tabs
  const [classicTab, setClassicTab] = useState<'body' | 'stem' | 'base' | 'supports' | 'slicer'>('body');

  // Station tabs
  const [stationTab, setStationTab] = useState<'container' | 'coasters' | 'leaves' | 'shaker' | 'kit'>('container');

  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const updateParam = <K extends keyof PumpkinParams>(key: K, value: PumpkinParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };

  const updateSupport = <K extends keyof SupportSettings>(key: K, value: SupportSettings[K]) => {
    onSupportChange({ ...supportSettings, [key]: value });
  };

  const updatePrint = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    onPrintSettingsChange({ ...printSettings, [key]: value });
  };

  const updateOrganizer = <K extends keyof OrganizerStationParams>(key: K, value: OrganizerStationParams[K]) => {
    if (organizerParams && onOrganizerParamsChange) {
      onOrganizerParamsChange({ ...organizerParams, [key]: value });
    }
  };

  const handleDownloadPart = (part: StationPartId, label: string) => {
    if (!stationModel) return;
    let geo = stationModel.mergedGeometry;
    let filename = `estacion_cafetera_kit_completo.stl`;

    if (part === 'container') {
      geo = stationModel.containerGeometry;
      filename = `calabaza_contenedor_base_hueco.stl`;
    } else if (part === 'lid') {
      geo = stationModel.lidGeometry;
      filename = `tapa_calabaza_con_labio.stl`;
    } else if (part === 'shaker-stem') {
      geo = stationModel.shakerStemGeometry;
      filename = `tallo_salero_especiero_roscable.stl`;
    } else if (part === 'shaker-cap') {
      geo = stationModel.shakerCapGeometry;
      filename = `tapita_roscada_salero.stl`;
    } else if (part === 'coasters') {
      geo = stationModel.coastersGeometry;
      filename = `set_${organizerParams?.coasterCount || 4}_posavasos.stl`;
    } else if (part === 'spoons') {
      geo = stationModel.spoonsGeometry;
      filename = `cucharitas_mezcla_calabaza_par.stl`;
    } else if (part === 'tpu-base') {
      geo = stationModel.tpuBaseGeometry;
      filename = `base_protectora_tpu_antideslizante.stl`;
    }

    exportToBinarySTL(geo, filename);
    setDownloadSuccess(label);
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Application Mode Switcher (Calabaza Clásica vs Estación Cafetera & Té) */}
      {onAppModeChange && (
        <div className="p-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center gap-2">
          <button
            id="btn-mode-station"
            onClick={() => onAppModeChange('station')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              appMode === 'station'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-orange-950/40 border border-amber-500/50'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Coffee className="w-4 h-4 text-amber-300" />
            <span>Estación Cafetera & Té</span>
          </button>

          <button
            id="btn-mode-classic"
            onClick={() => onAppModeChange('classic')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              appMode === 'classic'
                ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-950/40 border border-orange-500/50'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-orange-300" />
            <span>Calabaza Clásica</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATION MODE TABS & CONTROLS */}
      {/* ========================================================================= */}
      {appMode === 'station' && organizerParams && (
        <>
          {/* Station Sub-tabs Navigation */}
          <div className="grid grid-cols-5 bg-slate-950/60 p-1.5 border-b border-slate-800 text-xs font-medium">
            <button
              id="tab-btn-station-container"
              onClick={() => setStationTab('container')}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                stationTab === 'container'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Package className="w-4 h-4 mb-1" />
              <span className="truncate">Contenedor</span>
            </button>

            <button
              id="tab-btn-station-coasters"
              onClick={() => setStationTab('coasters')}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                stationTab === 'coasters'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Disc className="w-4 h-4 mb-1" />
              <span className="truncate">Coasters & Té</span>
            </button>

            <button
              id="tab-btn-station-leaves"
              onClick={() => setStationTab('leaves')}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                stationTab === 'leaves'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-4 h-4 mb-1" />
              <span className="truncate">Tapa & Hojas</span>
            </button>

            <button
              id="tab-btn-station-shaker"
              onClick={() => setStationTab('shaker')}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                stationTab === 'shaker'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <TreeDeciduous className="w-4 h-4 mb-1" />
              <span className="truncate">Tallo Salero</span>
            </button>

            <button
              id="tab-btn-station-kit"
              onClick={() => setStationTab('kit')}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                stationTab === 'kit'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Download className="w-4 h-4 mb-1" />
              <span className="truncate">Exportar STLs</span>
            </button>
          </div>

          {/* Station Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm text-slate-300 custom-scrollbar">
            {/* SUBTAB: CONTENEDOR INTERIOR Y TAPA */}
            {stationTab === 'container' && (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-400" />
                    <span>Contenedor Vaciado Autosoportado</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Vaciado cónico a 45° que no requiere soportes internos para la impresión 3D.
                  </p>
                </div>

                {/* Wall Thickness */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Grosor de Pared del Contenedor</span>
                    <span className="font-mono text-amber-400">{organizerParams.wallThickness.toFixed(1)} mm</span>
                  </div>
                  <input
                    id="slider-station-wall-thickness"
                    type="range"
                    min="2.0"
                    max="5.0"
                    step="0.2"
                    value={organizerParams.wallThickness}
                    onChange={(e) => updateOrganizer('wallThickness', parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500">
                    Garantiza 3 a 4 perímetros continuos para resistir lavado y uso diario.
                  </span>
                </div>

                {/* Lid Split Height Percent */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Altura de Separación de la Tapa</span>
                    <span className="font-mono text-amber-400">{organizerParams.lidSplitHeightPercent}%</span>
                  </div>
                  <input
                    id="slider-station-split-height"
                    type="range"
                    min="55"
                    max="80"
                    step="1"
                    value={organizerParams.lidSplitHeightPercent}
                    onChange={(e) => updateOrganizer('lidSplitHeightPercent', parseInt(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500">
                    Corta la calabaza a lo largo del plano ecuatorial superior para máxima apertura de acceso.
                  </span>
                </div>

                {/* Lid Fitting Tolerance */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Tolerancia de Encaje de la Tapa</span>
                    <span className="font-mono text-amber-400">{organizerParams.lidTolerance.toFixed(2)} mm</span>
                  </div>
                  <input
                    id="slider-station-lid-tolerance"
                    type="range"
                    min="0.20"
                    max="0.60"
                    step="0.05"
                    value={organizerParams.lidTolerance}
                    onChange={(e) => updateOrganizer('lidTolerance', parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500">
                    Holgura radial óptima para filamento PLA (0.30–0.40mm) o PETG (0.35–0.50mm).
                  </span>
                </div>

                {/* Lid Lip Height */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Altura del Labio Concéntrico</span>
                    <span className="font-mono text-amber-400">{organizerParams.lidLipHeight.toFixed(1)} mm</span>
                  </div>
                  <input
                    id="slider-station-lip-height"
                    type="range"
                    min="3.0"
                    max="7.0"
                    step="0.5"
                    value={organizerParams.lidLipHeight}
                    onChange={(e) => updateOrganizer('lidLipHeight', parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500">
                    Mantiene la tapa firmemente alineada para evitar deslizamientos accidentales.
                  </span>
                </div>

                {/* Pumpkin Size Modifiers */}
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="text-xs font-semibold text-slate-200">Escala Global de la Calabaza</div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-200">Radio Exterior (Diámetro: {params.radius * 2}mm)</span>
                      <span className="font-mono text-amber-400">{params.radius} mm</span>
                    </div>
                    <input
                      id="slider-station-pumpkin-radius"
                      type="range"
                      min="45"
                      max="75"
                      step="1"
                      value={params.radius}
                      onChange={(e) => updateParam('radius', parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB: COASERS Y COMPARTIMENTO TÉ/AZÚCAR */}
            {stationTab === 'coasters' && (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <Disc className="w-4 h-4 text-amber-400" />
                    <span>Cilindro de Posavasos & Tabiques para Té</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cilindro vertical con muesca ergonómica para dedos + separadores para bolsitas de té y azúcar.
                  </p>
                </div>

                {/* Coaster Diameter */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Diámetro de los Posavasos (Coasters)</span>
                    <span className="font-mono text-amber-400">{organizerParams.coasterDiameter} mm</span>
                  </div>
                  <input
                    id="slider-station-coaster-diameter"
                    type="range"
                    min="75"
                    max="95"
                    step="1"
                    value={organizerParams.coasterDiameter}
                    onChange={(e) => updateOrganizer('coasterDiameter', parseInt(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500">
                    Estándar para tazas de café y mugs (85mm de diámetro recomendado).
                  </span>
                </div>

                {/* Coaster Count */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Cantidad de Posavasos en Torre</span>
                    <span className="font-mono text-amber-400">{organizerParams.coasterCount} unidades</span>
                  </div>
                  <input
                    id="slider-station-coaster-count"
                    type="range"
                    min="2"
                    max="6"
                    step="1"
                    value={organizerParams.coasterCount}
                    onChange={(e) => updateOrganizer('coasterCount', parseInt(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Coaster Finger Cutout Width */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Ancho de la Muesca para Dedos</span>
                    <span className="font-mono text-amber-400">{organizerParams.coasterFingerCutoutWidth} mm</span>
                  </div>
                  <input
                    id="slider-station-finger-cutout"
                    type="range"
                    min="24"
                    max="45"
                    step="1"
                    value={organizerParams.coasterFingerCutoutWidth}
                    onChange={(e) => updateOrganizer('coasterFingerCutoutWidth', parseInt(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500">
                    Ranura abierta en la pared del cilindro para sacar los posavasos cómodamente con la mano.
                  </span>
                </div>

                {/* Divider Thickness */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Espesor de Tabiques Divisores</span>
                    <span className="font-mono text-amber-400">{organizerParams.dividerThickness.toFixed(1)} mm</span>
                  </div>
                  <input
                    id="slider-station-divider-thickness"
                    type="range"
                    min="1.6"
                    max="3.6"
                    step="0.2"
                    value={organizerParams.dividerThickness}
                    onChange={(e) => updateOrganizer('dividerThickness', parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500">
                    Separan los compartimentos para sobres de azúcar, bolsitas de té y creamers.
                  </span>
                </div>

                {/* Divider Height */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Altura Relativa de Tabiques</span>
                    <span className="font-mono text-amber-400">{organizerParams.dividerHeightPercent}%</span>
                  </div>
                  <input
                    id="slider-station-divider-height"
                    type="range"
                    min="60"
                    max="95"
                    step="2"
                    value={organizerParams.dividerHeightPercent}
                    onChange={(e) => updateOrganizer('dividerHeightPercent', parseInt(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* SUBTAB: TAPA Y HOJAS MANIJA */}
            {stationTab === 'leaves' && (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Hojas de Calabaza Manija</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hojas orgánicas curvadas con nervaduras que sirven de manija ergonómica para levantar la tapa.
                  </p>
                </div>

                {/* Leaf Count */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Cantidad de Hojas</span>
                    <span className="font-mono text-amber-400">{organizerParams.leafCount} hojas</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateOrganizer('leafCount', 2)}
                      className={`py-2 rounded-xl text-xs font-medium border ${
                        organizerParams.leafCount === 2
                          ? 'bg-amber-600 text-white border-amber-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      2 Hojas (Asa Bilateral)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateOrganizer('leafCount', 3)}
                      className={`py-2 rounded-xl text-xs font-medium border ${
                        organizerParams.leafCount === 3
                          ? 'bg-amber-600 text-white border-amber-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      3 Hojas (Trípode Corona)
                    </button>
                  </div>
                </div>

                {/* Leaf Span */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Envergadura de las Hojas</span>
                    <span className="font-mono text-amber-400">{organizerParams.leafSpan} mm</span>
                  </div>
                  <input
                    id="slider-station-leaf-span"
                    type="range"
                    min="40"
                    max="75"
                    step="1"
                    value={organizerParams.leafSpan}
                    onChange={(e) => updateOrganizer('leafSpan', parseInt(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500">
                    Extensión radial sobre la tapa superior.
                  </span>
                </div>

                {/* Leaf Arch Height */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Elevación del Arco para Agarre</span>
                    <span className="font-mono text-amber-400">{organizerParams.leafArchHeight} mm</span>
                  </div>
                  <input
                    id="slider-station-leaf-arch"
                    type="range"
                    min="12"
                    max="26"
                    step="1"
                    value={organizerParams.leafArchHeight}
                    onChange={(e) => updateOrganizer('leafArchHeight', parseInt(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500">
                    Espacio libre debajo de las hojas para introducir los dedos al abrir la tapa.
                  </span>
                </div>
              </div>
            )}

            {/* SUBTAB: TALLO SALERO ROSCABLE */}
            {stationTab === 'shaker' && (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <TreeDeciduous className="w-4 h-4 text-amber-400" />
                    <span>Tallo Salero / Especiero (Doble Función)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tallo desenroscable con cavidad interior y orificios dosificadores para canela, azúcar o especias.
                  </p>
                </div>

                {/* Shaker Toggle */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200 text-xs">Función Salero/Especiero Activa</div>
                    <div className="text-[11px] text-slate-400">
                      Integra cámara hueca, rosca de ensamble a la tapa y tapita dosificadora.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={organizerParams.shakerStemEnabled}
                    onChange={(e) => updateOrganizer('shakerStemEnabled', e.target.checked)}
                    className="w-5 h-5 accent-amber-500 cursor-pointer"
                  />
                </div>

                {organizerParams.shakerStemEnabled && (
                  <>
                    {/* Shaker Chamber Radius */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-200">Radio de Cámara Interna</span>
                        <span className="font-mono text-amber-400">{organizerParams.shakerChamberRadius.toFixed(1)} mm</span>
                      </div>
                      <input
                        id="slider-station-chamber-radius"
                        type="range"
                        min="4.5"
                        max="9.0"
                        step="0.5"
                        value={organizerParams.shakerChamberRadius}
                        onChange={(e) => updateOrganizer('shakerChamberRadius', parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    {/* Shaker Hole Count */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-200">Número de Orificios Dosificadores</span>
                        <span className="font-mono text-amber-400">{organizerParams.shakerHoleCount} agujeros</span>
                      </div>
                      <input
                        id="slider-station-hole-count"
                        type="range"
                        min="3"
                        max="7"
                        step="1"
                        value={organizerParams.shakerHoleCount}
                        onChange={(e) => updateOrganizer('shakerHoleCount', parseInt(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    {/* Shaker Hole Diameter */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-200">Diámetro de Orificios</span>
                        <span className="font-mono text-amber-400">{organizerParams.shakerHoleDiameter.toFixed(1)} mm</span>
                      </div>
                      <input
                        id="slider-station-hole-diameter"
                        type="range"
                        min="1.6"
                        max="3.2"
                        step="0.2"
                        value={organizerParams.shakerHoleDiameter}
                        onChange={(e) => updateOrganizer('shakerHoleDiameter', parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-500">
                        2.0–2.4mm es ideal para canela molida, azúcar flor o sal fina.
                      </span>
                    </div>

                    {/* Thread Pitch */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-200">Paso de Rosca 3D (Pitch)</span>
                        <span className="font-mono text-amber-400">{organizerParams.shakerThreadPitch.toFixed(1)} mm</span>
                      </div>
                      <input
                        id="slider-station-thread-pitch"
                        type="range"
                        min="2.0"
                        max="3.5"
                        step="0.5"
                        value={organizerParams.shakerThreadPitch}
                        onChange={(e) => updateOrganizer('shakerThreadPitch', parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-500">
                        Paso ancho optimizado para impresión FDM sin atascos de hilo.
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* SUBTAB: ACCESORIOS & DESCARGAS STL INDIVIDUALES */}
            {stationTab === 'kit' && (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Kit Completo & Descarga STL por Pieza</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Descarga cada componente por separado para imprimir en distintos colores y filamentos (PLA, PETG, TPU).
                  </p>
                </div>

                {downloadSuccess && (
                  <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Descargando archivo STL: <strong>{downloadSuccess}</strong></span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {/* 1. Container */}
                  <button
                    id="btn-dl-container"
                    onClick={() => handleDownloadPart('container', 'Contenedor Base Vaciado')}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Package className="w-4 h-4 text-orange-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">1. Contenedor Base Hueco</div>
                        <div className="text-[11px] text-slate-400">Autosoportado a 45° • Con pozo de posavasos y divisiones</div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-amber-400 bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-800/60">
                      .STL
                    </span>
                  </button>

                  {/* 2. Lid */}
                  <button
                    id="btn-dl-lid"
                    onClick={() => handleDownloadPart('lid', 'Tapa con Hojas Manija')}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">2. Tapa con Labio & Hojas</div>
                        <div className="text-[11px] text-slate-400">Hojas de calabaza como manija ergonómica</div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-amber-400 bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-800/60">
                      .STL
                    </span>
                  </button>

                  {/* 3. Shaker Stem */}
                  <button
                    id="btn-dl-shaker-stem"
                    onClick={() => handleDownloadPart('shaker-stem', 'Tallo Salero Desenroscable')}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <TreeDeciduous className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">3. Tallo Salero / Especiero</div>
                        <div className="text-[11px] text-slate-400">Cámara interna y rosca de fijación a la tapa</div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-amber-400 bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-800/60">
                      .STL
                    </span>
                  </button>

                  {/* 4. Shaker Cap */}
                  <button
                    id="btn-dl-shaker-cap"
                    onClick={() => handleDownloadPart('shaker-cap', 'Tapita Roscada de Salero')}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <TreeDeciduous className="w-4 h-4 text-emerald-300" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">4. Tapita Roscada Moleteada</div>
                        <div className="text-[11px] text-slate-400">Cierra y dosifica las especias con seguridad</div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-amber-400 bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-800/60">
                      .STL
                    </span>
                  </button>

                  {/* 5. Coasters Set */}
                  <button
                    id="btn-dl-coasters"
                    onClick={() => handleDownloadPart('coasters', 'Set de Posavasos')}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Disc className="w-4 h-4 text-amber-500" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">5. Set de Posavasos (Coasters)</div>
                        <div className="text-[11px] text-slate-400">
                          {organizerParams.coasterCount} posavasos apilables de Ø{organizerParams.coasterDiameter}mm
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-amber-400 bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-800/60">
                      .STL
                    </span>
                  </button>

                  {/* 6. Spoons */}
                  <button
                    id="btn-dl-spoons"
                    onClick={() => handleDownloadPart('spoons', '2 Cucharitas de Calabaza')}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Utensils className="w-4 h-4 text-lime-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">6. Par de Cucharitas de Mezcla</div>
                        <div className="text-[11px] text-slate-400">Mango de tallo botánico para insertar en ranura de tapa</div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-amber-400 bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-800/60">
                      .STL
                    </span>
                  </button>

                  {/* 7. TPU Base */}
                  <button
                    id="btn-dl-tpu"
                    onClick={() => handleDownloadPart('tpu-base', 'Base TPU Antideslizante')}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-sky-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">7. Base Protectora TPU Flexible</div>
                        <div className="text-[11px] text-slate-400">Pad antideslizante con anillos de tracción concéntricos</div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-sky-400 bg-sky-950/60 px-2 py-1 rounded-lg border border-sky-800/60">
                      .STL (TPU)
                    </span>
                  </button>
                </div>

                {/* OpenSCAD Script Modal Action */}
                {onOpenOpenSCADModal && (
                  <button
                    id="btn-open-scad-from-panel"
                    onClick={onOpenOpenSCADModal}
                    className="w-full mt-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/50 hover:to-orange-600/50 text-amber-200 border border-amber-500/50 flex items-center justify-center gap-2 text-xs font-semibold transition-all"
                  >
                    <Code2 className="w-4 h-4 text-amber-400" />
                    <span>Ver y Exportar Código Modular OpenSCAD (.scad)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* CLASSIC MODE TABS & CONTROLS */}
      {/* ========================================================================= */}
      {appMode === 'classic' && (
        <>
          {/* Classic Tabs Navigation */}
          <div className="grid grid-cols-5 bg-slate-950/60 p-1.5 border-b border-slate-800 text-xs font-medium">
            <button
              id="tab-btn-body"
              onClick={() => setClassicTab('body')}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                classicTab === 'body'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-4 h-4 mb-1" />
              <span className="truncate">Cuerpo</span>
            </button>

            <button
              id="tab-btn-stem"
              onClick={() => setClassicTab('stem')}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                classicTab === 'stem'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <TreeDeciduous className="w-4 h-4 mb-1" />
              <span className="truncate">Tallo</span>
            </button>

            <button
              id="tab-btn-base"
              onClick={() => setClassicTab('base')}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                classicTab === 'base'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 mb-1" />
              <span className="truncate">Base Plana</span>
            </button>

            <button
              id="tab-btn-supports"
              onClick={() => setClassicTab('supports')}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all relative ${
                classicTab === 'supports'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {supportSettings.enabled && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              )}
              <Sliders className="w-4 h-4 mb-1" />
              <span className="truncate">Soportes</span>
            </button>

            <button
              id="tab-btn-slicer"
              onClick={() => setClassicTab('slicer')}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                classicTab === 'slicer'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-4 h-4 mb-1" />
              <span className="truncate">Slicer</span>
            </button>
          </div>

          {/* Classic Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm text-slate-300 custom-scrollbar">
            {/* TAB: BODY */}
            {classicTab === 'body' && (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <span>Morfología y Textura Orgánica</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Genera los lóbulos de la cáscara y la microrrugosidad natural realista.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Número de Costillas / Lóbulos</span>
                    <span className="font-mono text-orange-400">{params.ribCount}</span>
                  </div>
                  <input
                    id="slider-rib-count"
                    type="range"
                    min="6"
                    max="16"
                    step="1"
                    value={params.ribCount}
                    onChange={(e) => updateParam('ribCount', parseInt(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Profundidad de Hendiduras</span>
                    <span className="font-mono text-orange-400">{Math.round(params.ribDepth * 100)}%</span>
                  </div>
                  <input
                    id="slider-rib-depth"
                    type="range"
                    min="0.10"
                    max="0.45"
                    step="0.01"
                    value={params.ribDepth}
                    onChange={(e) => updateParam('ribDepth', parseFloat(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Proporción Vertical (Achatamiento)</span>
                    <span className="font-mono text-orange-400">
                      {params.heightScale < 0.75 ? 'Achatada (Cenicienta)' : params.heightScale > 0.95 ? 'Alargada' : 'Equilibrada'}
                    </span>
                  </div>
                  <input
                    id="slider-height-scale"
                    type="range"
                    min="0.55"
                    max="1.15"
                    step="0.02"
                    value={params.heightScale}
                    onChange={(e) => updateParam('heightScale', parseFloat(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Asimetría Natural Orgánica</span>
                    <span className="font-mono text-orange-400">{Math.round(params.asymmetry * 100)}%</span>
                  </div>
                  <input
                    id="slider-asymmetry"
                    type="range"
                    min="0.0"
                    max="0.35"
                    step="0.01"
                    value={params.asymmetry}
                    onChange={(e) => updateParam('asymmetry', parseFloat(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Rugosidad de Cáscara (Verrugas)</span>
                    <span className="font-mono text-orange-400">{Math.round(params.skinRoughness * 100)}%</span>
                  </div>
                  <input
                    id="slider-skin-roughness"
                    type="range"
                    min="0.02"
                    max="0.22"
                    step="0.01"
                    value={params.skinRoughness}
                    onChange={(e) => updateParam('skinRoughness', parseFloat(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* TAB: STEM */}
            {classicTab === 'stem' && (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <span>Tallo Superior Orgánico y Fibras</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Modelado con estrías helicoidales, curvatura natural y corte superior realista.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Longitud del Tallo</span>
                    <span className="font-mono text-orange-400">{params.stemLength} mm</span>
                  </div>
                  <input
                    id="slider-stem-length"
                    type="range"
                    min="18"
                    max="45"
                    step="1"
                    value={params.stemLength}
                    onChange={(e) => updateParam('stemLength', parseInt(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Curvatura Natural Orgánica</span>
                    <span className="font-mono text-orange-400">{Math.round(params.stemCurvature * 100)}%</span>
                  </div>
                  <input
                    id="slider-stem-curvature"
                    type="range"
                    min="0.05"
                    max="0.65"
                    step="0.02"
                    value={params.stemCurvature}
                    onChange={(e) => updateParam('stemCurvature', parseFloat(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Torsión Espiral (Twist)</span>
                    <span className="font-mono text-orange-400">{params.stemTwist.toFixed(1)} vueltas</span>
                  </div>
                  <input
                    id="slider-stem-twist"
                    type="range"
                    min="0.0"
                    max="1.5"
                    step="0.1"
                    value={params.stemTwist}
                    onChange={(e) => updateParam('stemTwist', parseFloat(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* TAB: FLAT BASE */}
            {classicTab === 'base' && (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Base Plana para Adherencia en Cama</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Corta geométricamente la parte inferior para garantizar contacto plano perfecto.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Diámetro de la Base Plana</span>
                    <span className="font-mono text-emerald-400">{params.flatBaseDiameter} mm</span>
                  </div>
                  <input
                    id="slider-base-diameter"
                    type="range"
                    min="25"
                    max="75"
                    step="1"
                    value={params.flatBaseDiameter}
                    onChange={(e) => updateParam('flatBaseDiameter', parseInt(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200">Chaflán Anti Pata de Elefante</span>
                    <span className="font-mono text-emerald-400">{params.flatBaseChamfer.toFixed(1)} mm</span>
                  </div>
                  <input
                    id="slider-base-chamfer"
                    type="range"
                    min="0.5"
                    max="4.0"
                    step="0.2"
                    value={params.flatBaseChamfer}
                    onChange={(e) => updateParam('flatBaseChamfer', parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Brim Ring */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200 text-xs">Añadir Borde de Adhesión (Brim)</div>
                    <div className="text-[11px] text-slate-400">Anillo plano circundante para camas sin laca</div>
                  </div>
                  <input
                    id="checkbox-add-brim"
                    type="checkbox"
                    checked={params.addBrim}
                    onChange={(e) => updateParam('addBrim', e.target.checked)}
                    className="w-5 h-5 accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* TAB: SUPPORTS */}
            {classicTab === 'supports' && (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span>Soportes Breakaway Optimizados</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pilares tipo árbol con micro-contactos desmontables sin dañar la superficie.
                  </p>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200 text-xs">Generar Soportes Automáticos</div>
                    <div className="text-[11px] text-slate-400">Calcula voladizos &gt;45° en la base de la calabaza y tallo</div>
                  </div>
                  <input
                    id="checkbox-enable-supports"
                    type="checkbox"
                    checked={supportSettings.enabled}
                    onChange={(e) => updateSupport('enabled', e.target.checked)}
                    className="w-5 h-5 accent-cyan-500 cursor-pointer"
                  />
                </div>

                {supportSettings.enabled && (
                  <>
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-200">Diámetro de Micro-Punta (Breakaway)</span>
                        <span className="font-mono text-cyan-400">{supportSettings.contactPointDiameter.toFixed(1)} mm</span>
                      </div>
                      <input
                        id="slider-contact-diameter"
                        type="range"
                        min="0.4"
                        max="1.2"
                        step="0.1"
                        value={supportSettings.contactPointDiameter}
                        onChange={(e) => updateSupport('contactPointDiameter', parseFloat(e.target.value))}
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-200">Ángulo Umbral de Voladizo</span>
                        <span className="font-mono text-cyan-400">{supportSettings.overhangThresholdAngle}°</span>
                      </div>
                      <input
                        id="slider-overhang-angle"
                        type="range"
                        min="35"
                        max="60"
                        step="1"
                        value={supportSettings.overhangThresholdAngle}
                        onChange={(e) => updateSupport('overhangThresholdAngle', parseInt(e.target.value))}
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB: SLICER */}
            {classicTab === 'slicer' && (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Laminador & Simulación de Capas</span>
                  </h3>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200 text-xs">Inspección de Capas en Vivo</div>
                    <div className="text-[11px] text-slate-400">Corte interactivo horizontal del modelo</div>
                  </div>
                  <input
                    id="checkbox-slice-mode"
                    type="checkbox"
                    checked={sliceMode}
                    onChange={(e) => onSliceModeChange(e.target.checked)}
                    className="w-5 h-5 accent-purple-500 cursor-pointer"
                  />
                </div>

                {sliceMode && (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-200">Altura de Capa Activa</span>
                      <span className="font-mono text-purple-400">{activeLayerPercent}%</span>
                    </div>
                    <input
                      id="slider-layer-percent"
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={activeLayerPercent}
                      onChange={(e) => onActiveLayerPercentChange(parseInt(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Material / Render Mode Quick Switcher Bar */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">Material 3D:</span>
        <div className="flex items-center gap-1">
          <button
            id="mat-btn-realistic"
            onClick={() => onMaterialModeChange('realistic')}
            className={`px-2 py-1 rounded-md transition-colors ${
              materialMode === 'realistic' ? 'bg-orange-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Realista
          </button>
          <button
            id="mat-btn-print"
            onClick={() => onMaterialModeChange('print')}
            className={`px-2 py-1 rounded-md transition-colors ${
              materialMode === 'print' ? 'bg-orange-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Filamento PLA
          </button>
          <button
            id="mat-btn-clay"
            onClick={() => onMaterialModeChange('clay')}
            className={`px-2 py-1 rounded-md transition-colors ${
              materialMode === 'clay' ? 'bg-orange-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Arcilla CAD
          </button>
        </div>
      </div>
    </div>
  );
};
