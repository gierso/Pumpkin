import React, { useState, useMemo } from 'react';
import { GeneratedPumpkinModel } from '../utils/pumpkinGeometry';
import { GeneratedSupportResult } from '../utils/supportGenerator';
import { PumpkinParams, SupportSettings, OrganizerStationParams } from '../types';
import { generateOpenSCADScript, exportToOpenSCAD } from '../utils/openscadExporter';
import { OrganizerStationModel } from '../utils/stationGeometry';
import {
  X,
  Copy,
  Check,
  Download,
  Code2,
  Box,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface OpenSCADModalProps {
  isOpen: boolean;
  onClose: () => void;
  pumpkinModel: GeneratedPumpkinModel;
  supportResult: GeneratedSupportResult;
  pumpkinParams: PumpkinParams;
  supportSettings: SupportSettings;
  stationModel?: OrganizerStationModel;
  organizerParams?: OrganizerStationParams;
  isStationMode?: boolean;
}

export const OpenSCADModal: React.FC<OpenSCADModalProps> = ({
  isOpen,
  onClose,
  pumpkinModel,
  supportResult,
  pumpkinParams,
  supportSettings,
  stationModel,
  organizerParams,
  isStationMode = false
}) => {
  const [includeSupports, setIncludeSupports] = useState<boolean>(supportSettings.enabled);
  const [copied, setCopied] = useState<boolean>(false);
  const [showTips, setShowTips] = useState<boolean>(false);

  const scadCode = useMemo(() => {
    if (!isOpen) return '';
    return generateOpenSCADScript({
      pumpkinModel,
      supportResult,
      pumpkinParams,
      supportSettings,
      includeSupports,
      stationModel,
      organizerParams,
      isStationMode
    });
  }, [isOpen, pumpkinModel, supportResult, pumpkinParams, supportSettings, includeSupports, stationModel, organizerParams, isStationMode]);

  if (!isOpen) return null;

  const totalVertices =
    pumpkinModel.mergedGeometry.getAttribute('position')?.count || 0;
  const supportVertices =
    includeSupports && supportResult.supportGeometry.getAttribute('position')
      ? supportResult.supportGeometry.getAttribute('position').count
      : 0;

  const approximateKb = Math.round(scadCode.length / 1024);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scadCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleDownload = () => {
    exportToOpenSCAD({
      pumpkinModel,
      supportResult,
      pumpkinParams,
      supportSettings,
      includeSupports,
      stationModel,
      organizerParams,
      isStationMode,
      filename: isStationMode
        ? `calabaza_estacion_cafetera_${pumpkinParams.radius * 2}mm.scad`
        : undefined
    });
  };

  // Preview snippet for UI rendering so it doesn't freeze the DOM with 10,000 lines
  const previewLines = scadCode.split('\n');
  const previewSnippet = previewLines.slice(0, 140).join('\n') +
    (previewLines.length > 140 ? `\n\n// ... [+ ${previewLines.length - 140} líneas adicionales de vértices y facetas de la calabaza] ...\n// (El archivo completo se descarga o copia íntegramente con todos los puntos y módulos)` : '');

  return (
    <div
      id="modal-openscad-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="modal-openscad-content"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Exportar a OpenSCAD (.scad)
                </h3>
                <span className="text-[10px] font-mono bg-orange-950/80 text-orange-300 border border-orange-700/60 px-2 py-0.5 rounded-full">
                  Z=0 Base Plana
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Módulos poligonales paramétricos compatibles con CGAL y CSG booleano
              </p>
            </div>
          </div>

          <button
            id="btn-close-openscad-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Configuration Bar */}
        <div className="px-5 py-3 bg-slate-950/50 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Support toggle & metadata */}
          <div className="flex items-center gap-4">
            {supportSettings.enabled && (
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-slate-100">
                <input
                  type="checkbox"
                  id="chk-scad-include-supports"
                  checked={includeSupports}
                  onChange={(e) => setIncludeSupports(e.target.checked)}
                  className="rounded border-slate-700 text-orange-600 focus:ring-orange-500 bg-slate-800 w-4 h-4 cursor-pointer"
                />
                <span>Incluir módulo de pilares de soporte breakaway</span>
              </label>
            )}

            <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Box className="w-3.5 h-3.5 text-slate-500" />
                <span>{totalVertices + supportVertices} vértices</span>
              </span>
              <span>•</span>
              <span>~{approximateKb} KB</span>
            </div>
          </div>

          {/* Quick buttons: Copy and Download */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              id="btn-toggle-scad-tips"
              onClick={() => setShowTips(!showTips)}
              className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
              <span>Atajos OpenSCAD</span>
            </button>

            <button
              id="btn-copy-openscad"
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Código Copiado!' : 'Copiar Código'}</span>
            </button>

            <button
              id="btn-download-scad-file"
              onClick={handleDownload}
              className="px-3.5 py-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-semibold text-xs rounded-lg shadow-md flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar .scad</span>
            </button>
          </div>
        </div>

        {/* Tips Drawer */}
        {showTips && (
          <div className="px-5 py-3 bg-orange-950/20 border-b border-orange-900/30 text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-orange-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span>Cómo usar este archivo en OpenSCAD:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="font-mono text-orange-400 font-bold">F5 (Preview)</span>: Renderizado rápido OpenCSG con colores diferenciados para cuerpo y tallo.
              </div>
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="font-mono text-emerald-400 font-bold">F6 (Render)</span>: Renderizado booleano sólido CGAL para exportar a STL o modificar.
              </div>
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="font-mono text-cyan-400 font-bold">difference()</span>: Usa CSG para ahuecar la calabaza o tallar expresiones de Halloween.
              </div>
            </div>
          </div>
        )}

        {/* Code Content Viewer */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-950 font-mono text-[11px] leading-relaxed text-slate-300 select-text custom-scrollbar">
          <pre className="whitespace-pre overflow-x-auto selection:bg-orange-600/40">
            <code>{previewSnippet}</code>
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Módulos incluidos: <code className="text-slate-300 font-mono">calabaza_cuerpo()</code>, <code className="text-slate-300 font-mono">calabaza_tallo()</code>{includeSupports && <>, <code className="text-slate-300 font-mono">calabaza_soportes()</code></>}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800 text-xs transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs rounded-lg shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar .scad</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
