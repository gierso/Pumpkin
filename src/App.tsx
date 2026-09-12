import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { Viewport3D } from './components/Viewport3D';
import { ControlsPanel } from './components/ControlsPanel';
import {
  PumpkinParams,
  SupportSettings,
  PrintSettings,
  Preset,
  AppMode,
  OrganizerStationParams,
  StationViewMode,
  StationPartId
} from './types';
import {
  PUMPKIN_PRESETS,
  DEFAULT_PUMPKIN_PARAMS,
  DEFAULT_SUPPORT_SETTINGS,
  DEFAULT_ORGANIZER_PARAMS
} from './data/presets';
import { generateCompletePumpkin } from './utils/pumpkinGeometry';
import { generateOptimizedSupports } from './utils/supportGenerator';
import { estimatePrintSpecs } from './utils/printEstimator';
import { generateOrganizerStation } from './utils/stationGeometry';
import {
  Ruler,
  Clock,
  Weight,
  Layers,
  ShieldCheck,
  Coffee,
  SlidersHorizontal,
  Disc,
  TreeDeciduous,
  Sparkles
} from 'lucide-react';

export default function App() {
  // Mode: 'station' (Estación Cafetera & Té) or 'classic' (Calabaza Clásica)
  const [appMode, setAppMode] = useState<AppMode>('station');

  // Active preset (defaults to the station preset)
  const [currentPresetId, setCurrentPresetId] = useState<string>('estacion-cafetera');

  // Core Geometry parameters (initialized with the station preset dimensions)
  const stationPreset = PUMPKIN_PRESETS.find((p) => p.id === 'estacion-cafetera');
  const [params, setParams] = useState<PumpkinParams>(
    stationPreset ? { ...DEFAULT_PUMPKIN_PARAMS, ...stationPreset.params } : DEFAULT_PUMPKIN_PARAMS
  );
  const [supportSettings, setSupportSettings] = useState<SupportSettings>(
    stationPreset ? { ...DEFAULT_SUPPORT_SETTINGS, ...stationPreset.supports } : DEFAULT_SUPPORT_SETTINGS
  );

  // Organizer Station Specific Parameters
  const [organizerParams, setOrganizerParams] = useState<OrganizerStationParams>(DEFAULT_ORGANIZER_PARAMS);

  // Station View Inspection Mode
  const [stationViewMode, setStationViewMode] = useState<StationViewMode>('assembled');
  const [activePartId, setActivePartId] = useState<StationPartId>('all');

  // Print settings
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    layerHeight: 0.20,
    infillPercent: 15,
    wallPerimeters: 3,
    printSpeed: 80,
    filamentType: 'PLA',
    bedSizeX: 220,
    bedSizeY: 220
  });

  // Viewport inspection modes
  const [sliceMode, setSliceMode] = useState<boolean>(false);
  const [activeLayerPercent, setActiveLayerPercent] = useState<number>(100);
  const [materialMode, setMaterialMode] = useState<'realistic' | 'clay' | 'overhang' | 'print'>('realistic');

  // OpenSCAD modal control
  const [showOpenSCADModal, setShowOpenSCADModal] = useState<boolean>(false);

  // Mobile sidebar drawer
  const [mobilePanelOpen, setMobilePanelOpen] = useState<boolean>(false);

  // 1. Generate Classic Pumpkin Mesh
  const pumpkinModel = useMemo(() => {
    return generateCompletePumpkin(params);
  }, [params]);

  // 2. Generate Optimized Breakaway Supports (for classic mode)
  const supportResult = useMemo(() => {
    return generateOptimizedSupports(pumpkinModel.mergedGeometry, supportSettings);
  }, [pumpkinModel.mergedGeometry, supportSettings]);

  // 3. Generate Complete Multi-Part Organizer Station
  const stationModel = useMemo(() => {
    return generateOrganizerStation(params, organizerParams);
  }, [params, organizerParams]);

  // 4. Compute Real-time 3D Print Specs & Adhesion Score
  const activeGeometry = appMode === 'station' ? stationModel.mergedGeometry : pumpkinModel.mergedGeometry;
  const activeBaseArea = appMode === 'station' ? stationModel.baseContactAreaMm2 : pumpkinModel.baseContactAreaMm2;

  const printEstimation = useMemo(() => {
    return estimatePrintSpecs(
      activeGeometry,
      activeBaseArea,
      printSettings,
      appMode === 'station' ? 0 : supportResult.estimatedSupportFilamentGrams
    );
  }, [activeGeometry, activeBaseArea, printSettings, supportResult.estimatedSupportFilamentGrams, appMode]);

  // Handle preset selection
  const handleSelectPreset = (preset: Preset) => {
    setCurrentPresetId(preset.id);
    setParams((prev) => ({ ...prev, ...preset.params }));
    setSupportSettings((prev) => ({ ...prev, ...preset.supports }));
    if (preset.id === 'estacion-cafetera') {
      setAppMode('station');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Header */}
      <Header
        currentPresetId={currentPresetId}
        onSelectPreset={handleSelectPreset}
        pumpkinModel={pumpkinModel}
        supportResult={supportResult}
        pumpkinParams={params}
        supportSettings={supportSettings}
        appMode={appMode}
        onAppModeChange={setAppMode}
        stationModel={stationModel}
        organizerParams={organizerParams}
        showOpenSCADModal={showOpenSCADModal}
        onOpenOpenSCADModal={() => setShowOpenSCADModal(true)}
        onCloseOpenSCADModal={() => setShowOpenSCADModal(false)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left / Center 3D Viewport */}
        <main className="flex-1 relative flex flex-col p-3 lg:p-4 min-h-0">
          <div className="relative flex-1 w-full h-full min-h-[300px]">
            <Viewport3D
              pumpkinModel={pumpkinModel}
              supportResult={supportResult}
              pumpkinParams={params}
              supportSettings={supportSettings}
              printSettings={printSettings}
              activeLayerPercent={activeLayerPercent}
              sliceMode={sliceMode}
              materialMode={materialMode}
              isStationMode={appMode === 'station'}
              stationModel={stationModel}
              stationViewMode={stationViewMode}
              onStationViewModeChange={setStationViewMode}
              activePartId={activePartId}
              onActivePartIdChange={setActivePartId}
            />

            {/* Mobile Controls Drawer Trigger */}
            <button
              id="btn-toggle-mobile-panel"
              onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
              className="lg:hidden absolute bottom-4 right-4 z-20 bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xl flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Ajustar Parámetros</span>
            </button>
          </div>

          {/* Quick Print & Functional Specs Ticker Bar underneath Viewport */}
          <div className="mt-3 bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {appMode === 'station' ? (
              <>
                {/* Station Dimensions */}
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Dimensiones: </span>
                    <span className="font-mono font-medium text-slate-200">
                      {stationModel.widthMm} × {stationModel.widthMm} × {stationModel.heightMm} mm
                    </span>
                  </div>
                </div>

                {/* Coasters Cylinder Info */}
                <div className="flex items-center gap-2">
                  <Disc className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-slate-400">Posavasos: </span>
                    <span className="font-mono font-medium text-amber-300">
                      Ø {organizerParams.coasterDiameter} mm (x{organizerParams.coasterCount})
                    </span>
                  </div>
                </div>

                {/* Shaker Stem Info */}
                <div className="flex items-center gap-2">
                  <TreeDeciduous className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Tallo Salero: </span>
                    <span className="font-mono font-medium text-emerald-300">
                      Doble función ({organizerParams.shakerHoleCount} orif.)
                    </span>
                  </div>
                </div>

                {/* Flat Base & TPU info */}
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Base Plana & TPU: </span>
                    <span className="font-mono font-medium text-sky-300">
                      Ø {params.flatBaseDiameter} mm (Pad {organizerParams.tpuThickness}mm)
                    </span>
                  </div>
                </div>

                {/* Weight */}
                <div className="flex items-center gap-2">
                  <Weight className="w-4 h-4 text-orange-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Filamento: </span>
                    <span className="font-mono font-medium text-slate-200">
                      ~{printEstimation.estimatedWeightGrams} g
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Dimensions */}
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-orange-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Dimensiones: </span>
                    <span className="font-mono font-medium text-slate-200">
                      {pumpkinModel.widthMm} × {pumpkinModel.widthMm} × {pumpkinModel.heightMm} mm
                    </span>
                  </div>
                </div>

                {/* Flat Base Adhesion Footprint */}
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Base Plana de Cama: </span>
                    <span className="font-mono font-medium text-emerald-300">
                      Ø {params.flatBaseDiameter} mm ({pumpkinModel.baseContactAreaMm2} mm²)
                    </span>
                  </div>
                </div>

                {/* Estimated Print Duration */}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Tiempo Est.: </span>
                    <span className="font-mono font-medium text-slate-200">
                      {printEstimation.estimatedTimeHours}h {printEstimation.estimatedTimeMinutes}m
                    </span>
                  </div>
                </div>

                {/* Weight */}
                <div className="flex items-center gap-2">
                  <Weight className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Filamento: </span>
                    <span className="font-mono font-medium text-slate-200">
                      {printEstimation.estimatedWeightGrams} g ({printSettings.filamentType})
                    </span>
                  </div>
                </div>

                {/* Layers */}
                <div className="hidden sm:flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Capas: </span>
                    <span className="font-mono font-medium text-slate-200">
                      {printEstimation.layerCount} ({printSettings.layerHeight}mm)
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        {/* Right Sidebar Controls (Desktop persistent / Mobile drawer) */}
        <aside
          className={`w-full lg:w-96 xl:w-[440px] p-3 lg:p-4 lg:pl-0 flex flex-col h-full shrink-0 transition-transform duration-300 z-30 lg:translate-x-0 ${
            mobilePanelOpen
              ? 'fixed inset-0 top-16 bg-slate-950/95 backdrop-blur-xl p-4 translate-x-0'
              : 'hidden lg:flex'
          }`}
        >
          {mobilePanelOpen && (
            <div className="lg:hidden flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
              <span className="font-semibold text-slate-200 text-sm">
                {appMode === 'station' ? 'Parámetros de la Estación Cafetera' : 'Parámetros de Diseño 3D'}
              </span>
              <button
                onClick={() => setMobilePanelOpen(false)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          )}

          <ControlsPanel
            params={params}
            onParamsChange={(newParams) => {
              setCurrentPresetId('custom');
              setParams(newParams);
            }}
            supportSettings={supportSettings}
            onSupportChange={(newSupport) => {
              setCurrentPresetId('custom');
              setSupportSettings(newSupport);
            }}
            printSettings={printSettings}
            onPrintSettingsChange={setPrintSettings}
            pumpkinModel={pumpkinModel}
            supportResult={supportResult}
            printEstimation={printEstimation}
            sliceMode={sliceMode}
            onSliceModeChange={setSliceMode}
            activeLayerPercent={activeLayerPercent}
            onActiveLayerPercentChange={setActiveLayerPercent}
            materialMode={materialMode}
            onMaterialModeChange={setMaterialMode}
            appMode={appMode}
            onAppModeChange={setAppMode}
            organizerParams={organizerParams}
            onOrganizerParamsChange={setOrganizerParams}
            stationModel={stationModel}
            onOpenOpenSCADModal={() => setShowOpenSCADModal(true)}
          />
        </aside>
      </div>
    </div>
  );
}
