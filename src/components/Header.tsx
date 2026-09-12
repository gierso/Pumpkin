import React, { useState } from 'react';
import { PUMPKIN_PRESETS } from '../data/presets';
import { Preset, PumpkinParams, SupportSettings, AppMode, OrganizerStationParams } from '../types';
import { GeneratedPumpkinModel, mergeGeometries } from '../utils/pumpkinGeometry';
import { GeneratedSupportResult } from '../utils/supportGenerator';
import { OrganizerStationModel } from '../utils/stationGeometry';
import { exportToBinarySTL, exportToOBJ, exportToOpenSCAD } from '../utils/stlExporter';
import { OpenSCADModal } from './OpenSCADModal';
import {
  Download,
  Box,
  ChevronDown,
  Sparkles,
  Layers,
  FileCheck,
  CheckCircle2,
  Code2,
  Coffee,
  Package,
  Disc,
  Utensils,
  ShieldCheck,
  TreeDeciduous
} from 'lucide-react';

interface HeaderProps {
  currentPresetId: string;
  onSelectPreset: (preset: Preset) => void;
  pumpkinModel: GeneratedPumpkinModel;
  supportResult: GeneratedSupportResult;
  pumpkinParams: PumpkinParams;
  supportSettings: SupportSettings;
  appMode?: AppMode;
  onAppModeChange?: (mode: AppMode) => void;
  stationModel?: OrganizerStationModel;
  organizerParams?: OrganizerStationParams;
  showOpenSCADModal?: boolean;
  onOpenOpenSCADModal?: () => void;
  onCloseOpenSCADModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPresetId,
  onSelectPreset,
  pumpkinModel,
  supportResult,
  pumpkinParams,
  supportSettings,
  appMode = 'station',
  onAppModeChange,
  stationModel,
  organizerParams,
  showOpenSCADModal: externalShowOpenSCADModal,
  onOpenOpenSCADModal,
  onCloseOpenSCADModal
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [localShowOpenSCADModal, setLocalShowOpenSCADModal] = useState<boolean>(false);

  const isModalOpen = externalShowOpenSCADModal !== undefined ? externalShowOpenSCADModal : localShowOpenSCADModal;
  const handleOpenModal = () => {
    if (onOpenOpenSCADModal) onOpenOpenSCADModal();
    else setLocalShowOpenSCADModal(true);
  };
  const handleCloseModal = () => {
    if (onCloseOpenSCADModal) onCloseOpenSCADModal();
    else setLocalShowOpenSCADModal(false);
  };

  const isStation = appMode === 'station';

  // Export handlers
  const handleExportSTL = (includeSupports: boolean) => {
    if (isStation && stationModel) {
      // Export complete assembled station
      exportToBinarySTL(stationModel.mergedGeometry, `estacion_cafetera_calabaza_completa.stl`);
      setShowExportMenu(false);
      setDownloadSuccess('Kit completo STL generado');
      setTimeout(() => setDownloadSuccess(null), 3500);
      return;
    }

    let exportGeo = pumpkinModel.mergedGeometry;

    if (includeSupports && supportSettings.enabled && supportResult.supportGeometry && supportResult.supportGeometry.getAttribute('position')) {
      exportGeo = mergeGeometries([pumpkinModel.mergedGeometry, supportResult.supportGeometry]);
    }

    const name = includeSupports && supportSettings.enabled
      ? `calabaza_organica_con_soportes_${pumpkinParams.radius * 2}mm.stl`
      : `calabaza_organica_base_plana_${pumpkinParams.radius * 2}mm.stl`;

    exportToBinarySTL(exportGeo, name);
    setShowExportMenu(false);
    setDownloadSuccess('STL generado con éxito');
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  const handleExportSCAD = (includeSupports: boolean) => {
    exportToOpenSCAD({
      pumpkinModel,
      supportResult,
      pumpkinParams,
      supportSettings,
      includeSupports,
      stationModel,
      organizerParams,
      isStationMode: isStation
    });
    setShowExportMenu(false);
    setDownloadSuccess('OpenSCAD (.scad) generado');
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  const handleExportOBJ = () => {
    const geo = isStation && stationModel ? stationModel.mergedGeometry : pumpkinModel.mergedGeometry;
    const name = isStation
      ? `estacion_cafetera_calabaza.obj`
      : `calabaza_organica_${pumpkinParams.radius * 2}mm.obj`;

    exportToOBJ(geo, name);
    setShowExportMenu(false);
    setDownloadSuccess('OBJ generado con éxito');
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  return (
    <header className="relative z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: App Title & Specs */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-950/40 text-white font-bold text-lg">
              {isStation ? '☕' : '🎃'}
            </div>
            <div>
              <h1 className="font-bold text-slate-100 text-base lg:text-lg tracking-tight leading-tight flex items-center gap-2">
                <span>{isStation ? 'Estación Cafetera & Té Calabaza 3D' : 'Calabaza 3D Orgánica'}</span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-700/50">
                  {isStation ? 'Multi-Pieza 3D' : '3D Print Ready'}
                </span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                {isStation
                  ? 'Contenedor hueco para posavasos, té y azúcar con tallo salero y base de TPU'
                  : 'Base plana estable para cama de impresión y soportes breakaway optimizados'}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Presets Selector Carousel */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 md:pb-0 custom-scrollbar">
          {PUMPKIN_PRESETS.map((preset) => {
            const isSelected = preset.id === currentPresetId;
            return (
              <button
                key={preset.id}
                id={`preset-${preset.id}`}
                onClick={() => {
                  onSelectPreset(preset);
                  if (preset.id === 'estacion-cafetera' && onAppModeChange) {
                    onAppModeChange('station');
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-600/90 text-white shadow-md border border-amber-500/80'
                    : 'bg-slate-800/80 text-slate-300 hover:text-slate-100 hover:bg-slate-700/80 border border-slate-700/40'
                }`}
              >
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Export Menu & Notification */}
        <div className="relative flex items-center gap-2 w-full md:w-auto justify-end">
          {downloadSuccess && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-500/40 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          <div className="relative">
            <button
              id="btn-export-dropdown"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-orange-950/50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Modelo 3D</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>

            {/* Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-slate-800 mb-1">
                  <div className="text-xs font-semibold text-slate-200">Formatos para Impresión 3D</div>
                  <div className="text-[11px] text-slate-400">Orientado en Z=0 para laminadores</div>
                </div>

                {isStation ? (
                  <>
                    {/* Option 1: Full Kit STL */}
                    <button
                      id="btn-export-station-kit"
                      onClick={() => handleExportSTL(false)}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors flex items-start gap-2.5 group"
                    >
                      <Package className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-slate-200 group-hover:text-amber-400 flex items-center gap-1.5">
                          <span>Kit Estación Completo (STL)</span>
                          <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded border border-amber-800">
                            Ensamblado
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Todas las piezas combinadas para inspección global.
                        </div>
                      </div>
                    </button>

                    {/* Option 2: Individual Part STLs in Controls Panel Tip */}
                    <div className="px-3 py-1.5 text-[11px] text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800 my-1">
                      💡 Para descargar piezas individuales (contenedor, posavasos, tallo salero, base TPU), ve a la pestaña <strong>Exportar STLs</strong> en el panel derecho.
                    </div>
                  </>
                ) : (
                  <>
                    {/* Option 1: STL with Supports */}
                    {supportSettings.enabled && (
                      <button
                        id="btn-export-stl-supports"
                        onClick={() => handleExportSTL(true)}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors flex items-start gap-2.5 group"
                      >
                        <Box className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-400 flex items-center gap-1.5">
                            <span>STL con Soportes Integrados</span>
                            <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-800">
                              Recomendado
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Incluye pilares breakaway con micro-puntas de {supportSettings.contactPointDiameter}mm.
                          </div>
                        </div>
                      </button>
                    )}

                    {/* Option 2: Clean STL */}
                    <button
                      id="btn-export-stl-clean"
                      onClick={() => handleExportSTL(false)}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors flex items-start gap-2.5 group"
                    >
                      <FileCheck className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-slate-200 group-hover:text-orange-400">
                          STL Limpio (Base Plana Ø {pumpkinParams.flatBaseDiameter}mm)
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Para que tu laminador (Cura, Bambu Studio, Prusa) calcule soportes.
                        </div>
                      </div>
                    </button>
                  </>
                )}

                {/* OpenSCAD section */}
                <div className="px-3 py-1.5 border-t border-b border-slate-800 my-1 bg-slate-950/40">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                    <Code2 className="w-3 h-3" />
                    <span>OpenSCAD (.scad)</span>
                  </div>
                </div>

                {/* Direct OpenSCAD download */}
                <button
                  id="btn-export-scad-clean"
                  onClick={() => handleExportSCAD(false)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors flex items-start gap-2.5 group"
                >
                  <Code2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-slate-200 group-hover:text-emerald-400 flex items-center gap-1.5">
                      <span>Descargar Script OpenSCAD</span>
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-800">
                        Modular
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {isStation
                        ? 'Incluye módulos separados de contenedor, tapa, hojas, salero, coasters y TPU.'
                        : 'Módulos cuerpo + tallo, compatible con CSG booleano.'}
                    </div>
                  </div>
                </button>

                {/* OpenSCAD Code Modal / Viewer */}
                <button
                  id="btn-view-scad-code"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleOpenModal();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2.5 text-xs text-amber-300 hover:text-amber-200"
                >
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Ver / Copiar Código OpenSCAD</span>
                </button>

                <div className="border-t border-slate-800 my-1" />

                {/* Wavefront OBJ Format */}
                <button
                  id="btn-export-obj"
                  onClick={handleExportOBJ}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2.5 text-xs text-slate-300 hover:text-slate-100"
                >
                  <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Archivo Wavefront OBJ (.obj)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OpenSCAD Code & Export Modal */}
      <OpenSCADModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        pumpkinModel={pumpkinModel}
        supportResult={supportResult}
        pumpkinParams={pumpkinParams}
        supportSettings={supportSettings}
        stationModel={stationModel}
        organizerParams={organizerParams}
        isStationMode={isStation}
      />
    </header>
  );
};
