import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { 
  Droplet, 
  Layers, 
  RotateCcw, 
  History, 
  Trash2, 
  ArrowRight, 
  CheckCircle, 
  ChevronRight, 
  Plus, 
  Minus,
  Settings,
  Info,
  Calendar,
  Layers3,
  Sparkles,
  Wind,
  Tag,
  ChevronDown,
  ChevronUp,
  Package,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Lock,
  Flame,
  Power,
  HelpCircle,
  BookOpen,
  CheckSquare,
  Square,
  Wrench,
  AlertTriangle,
  Pencil,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Upload,
  X,
  Menu,
  Camera,
  FileText,
  ChevronLeft,
  FileDown,
  Loader2,
  Printer
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { BottleFormat, CalculationInput, BottleFormatType, CalculationLog, ProductionRecap } from './types';
import { PACKAGING_MACHINES, MachineProcedure, ProcedureStep, SupplyItem } from './operatingProcedures';
import { db, MachineProcedureExtended } from './db/db';
import CameraCaptureModal from './components/CameraCaptureModal';

const BOTTLE_FORMATS: BottleFormat[] = [
  { 
    id: '75cl', 
    label: 'Format 75 cl', 
    volume: '75cl', 
    conveyorDefault: 3400,
    palletDefaultSize: 600 // ~100 packs of 6
  },
  { 
    id: '33cl', 
    label: 'Format 33 cl', 
    volume: '33cl', 
    conveyorDefault: 5200,
    palletDefaultSize: 1200 // ~100 packs of 12
  },
  { 
    id: 'custom', 
    label: 'Format Spécifique', 
    volume: 'Perso', 
    conveyorDefault: 0,
    palletDefaultSize: 1000
  }
];

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

interface CircularProgressRingProps {
  percent: number;
  colorClass?: string;
  trailColorClass?: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: React.ReactNode;
}

function CircularProgressRing({ 
  percent, 
  colorClass = "stroke-blue-500", 
  trailColorClass = "stroke-slate-850/60",
  size = 64, 
  strokeWidth = 5,
  label = "",
  sublabel = ""
}: CircularProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center bg-slate-950/50 p-3 rounded-2xl border border-slate-850/60 flex-1 justify-between min-w-[85px] hover:border-slate-800 transition-colors">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={`${trailColorClass} fill-none`}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={`${colorClass} fill-none transition-all duration-700 ease-out`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-mono font-black text-white">
            {percent.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="text-center mt-2.5 w-full">
        <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest block leading-none">
          {label}
        </span>
        {sublabel && (
          <div className="text-[10.5px] font-mono font-extrabold text-slate-200 block mt-1 leading-none">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

function compressImage(base64Str: string, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      // Compress to JPEG format with specified visual quality (0.7 reduces size significantly while maintaining perfect readability)
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
}

/**
 * Saves a file on Web, or writes to cache & shares on APK/Capacitor native platforms.
 * @param filename The name of the file to save (e.g. 'doc.pdf', 'data.json')
 * @param data The data, either as raw base64 string (for binary like PDF) or text string (for JSON/text)
 * @param mimeType The mime type (e.g. 'application/pdf', 'application/json')
 * @param isBase64 True if the data parameter is a raw base64-encoded string
 */
async function saveOrShareFile(
  filename: string,
  data: string,
  mimeType: string,
  isBase64: boolean = false
) {
  if (Capacitor.isNativePlatform()) {
    try {
      const writeOptions: any = {
        path: filename,
        data: data,
        directory: Directory.Cache,
      };
      if (!isBase64) {
        writeOptions.encoding = Encoding.UTF8;
      }
      
      const fileResult = await Filesystem.writeFile(writeOptions);
      
      await Share.share({
        title: filename,
        url: fileResult.uri,
        dialogTitle: `Partager ou enregistrer ${filename}`
      });
    } catch (error) {
      console.error('Failed to save or share file on native platform:', error);
      alert(`Erreur d'exportation sur mobile : ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    try {
      let url: string;
      if (isBase64) {
        url = `data:${mimeType};base64,${data}`;
      } else {
        const blob = new Blob([data], { type: mimeType });
        url = URL.createObjectURL(blob);
      }
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      if (!isBase64) {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download file on web:', error);
      alert(`Erreur de téléchargement : ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default function App() {
  // Navigation / Tab state
  // "calculator" = Le calculateur d'embouteillage, "procedures" = Modes opératoires des machines, "pilote" = Calendrier Pilote de production
  const [activeTab, setActiveTab] = useState<'procedures' | 'pilote'>('procedures');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // States for "Pilote" calendar and production recaps
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(true);
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState<number>(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(today.getMonth()); // 0-11
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [piloteSubTab, setPiloteSubTab] = useState<'recap'>('recap');

  const mopRef = useRef<HTMLDivElement>(null);

  const prepareStylesheets = () => {
    const restoredRules: Array<{ rule: CSSStyleRule; prop: string; originalValue: string }> = [];
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (!sheet.cssRules) continue;
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && rule.style) {
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                const value = rule.style.getPropertyValue(prop);
                if (value && /(oklch|oklab|lch|lab)\([^)]+\)/.test(value)) {
                  restoredRules.push({
                    rule,
                    prop,
                    originalValue: value
                  });
                  const replaced = value.replace(/(oklch|oklab|lch|lab)\([^)]+\)/g, '#0ea5e9');
                  rule.style.setProperty(prop, replaced);
                }
              }
            }
          }
        } catch (e) {
          // Ignore CORS-protected stylesheets
        }
      }
    } catch (e) {
      console.error('Error preparing stylesheets', e);
    }

    return () => {
      for (const item of restoredRules) {
        try {
          item.rule.style.setProperty(item.prop, item.originalValue);
        } catch (e) {
          // Ignore restore errors
        }
      }
    };
  };

  const prepareInlineStyles = (element: HTMLElement) => {
    const restoredInline: Array<{ element: HTMLElement; prop: string; originalValue: string }> = [];
    const traverse = (el: HTMLElement) => {
      if (el.style) {
        for (let i = 0; i < el.style.length; i++) {
          const prop = el.style[i];
          const value = el.style.getPropertyValue(prop);
          if (value && /(oklch|oklab|lch|lab)\([^)]+\)/.test(value)) {
            restoredInline.push({
              element: el,
              prop,
              originalValue: value
            });
            const replaced = value.replace(/(oklch|oklab|lch|lab)\([^)]+\)/g, '#0ea5e9');
            el.style.setProperty(prop, replaced);
          }
        }
      }
      for (let i = 0; i < el.children.length; i++) {
        traverse(el.children[i] as HTMLElement);
      }
    };

    traverse(element);

    return () => {
      for (const item of restoredInline) {
        try {
          item.element.style.setProperty(item.prop, item.originalValue);
        } catch (e) {
          // Ignore restore errors
        }
      }
    };
  };

  const replaceModernColors = (value: string): string => {
    if (typeof value !== 'string') return value;
    
    let val = value;
    if (/(oklch|lch)\(([^)]+)\)/i.test(val)) {
      val = val.replace(/(oklch|lch)\(([^)]+)\)/gi, (match, type, content) => {
        try {
          const parts = content.trim().split(/\s*[\s/]\s*/);
          if (parts.length >= 3) {
            let lStr = parts[0];
            let cStr = parts[1];
            let hStr = parts[2];
            let aStr = parts[3] || '1';
            
            let l = 0;
            if (lStr.endsWith('%')) {
              l = parseFloat(lStr);
            } else {
              l = parseFloat(lStr) * 100;
            }
            
            let c = parseFloat(cStr);
            if (cStr.endsWith('%')) {
              c = parseFloat(cStr) / 100;
            }
            let s = Math.min(100, Math.max(0, c * 250));
            
            let h = parseFloat(hStr) || 0;
            
            let a = 1;
            if (aStr) {
              if (aStr.endsWith('%')) {
                a = parseFloat(aStr) / 100;
              } else {
                a = parseFloat(aStr);
              }
            }
            
            if (isNaN(l) || isNaN(s) || isNaN(h)) {
              return '#f1f5f9';
            }
            
            if (a < 1) {
              return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a})`;
            } else {
              return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
            }
          }
        } catch (e) {
          console.error('Error parsing oklch/lch', e);
        }
        return '#f1f5f9';
      });
    }
    
    if (/(oklab|lab)\([^)]+\)/i.test(val)) {
      val = val.replace(/(oklab|lab)\([^)]+\)/gi, '#f1f5f9');
    }
    if (/color-mix\([^)]+\)/i.test(val)) {
      val = val.replace(/color-mix\([^)]+\)/gi, 'rgba(15, 23, 42, 0.1)');
    }
    if (/color\([^)]+\)/i.test(val)) {
      val = val.replace(/color\([^)]+\)/gi, '#f1f5f9');
    }
    
    return val;
  };

  const handleExportStepsHTML = async () => {
    if (!selectedMachine) {
      alert("Aucune machine sélectionnée.");
      return;
    }

    const activeImgUrl = selectedMachine.containerImages && selectedMachine.containerImages.length > 0
      ? (selectedMachine.containerImages.find(img => img.id === activeContainerId)?.imageUrl || selectedMachine.imageUrl)
      : selectedMachine.imageUrl;

    const currentFormatSteps = (selectedMachine.containerSteps && activeContainerId && selectedMachine.containerSteps[activeContainerId])
      ? selectedMachine.containerSteps[activeContainerId]
      : selectedMachine.mainSteps;

    const activeFormatLabel = (selectedMachine.containerImages && activeContainerId)
      ? selectedMachine.containerImages.find(img => img.id === activeContainerId)?.label
      : null;

    const formattedDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fiche de Préparation - ${selectedMachine.name}</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 0;
      line-height: 1.5;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }
    .no-print-banner {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #ffffff;
      padding: 18px 24px;
      border-radius: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    }
    .banner-title {
      margin: 0;
      font-size: 16px;
      font-weight: 850;
      letter-spacing: -0.02em;
    }
    .banner-sub {
      margin: 4px 0 0 0;
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
    }
    .btn-print {
      background-color: #2563eb;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      font-weight: 700;
      font-size: 13px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
      transition: all 0.2s ease;
    }
    .btn-print:hover {
      background-color: #1d4ed8;
      transform: translateY(-1px);
    }
    .mop-card {
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
      box-sizing: border-box;
      border-top: 8px solid #2563eb;
    }
    .mop-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-b: 2px solid #f1f5f9;
      padding-bottom: 20px;
      margin-bottom: 24px;
      gap: 16px;
    }
    .header-left h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.025em;
    }
    .machine-badge {
      display: inline-block;
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
      background-color: #f1f5f9;
      color: #475569;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin-top: 6px;
    }
    .format-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      background-color: #eff6ff;
      color: #1d4ed8;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #bfdbfe;
      margin-top: 6px;
      margin-left: 6px;
    }
    .header-right {
      text-align: right;
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .header-right p {
      margin: 2px 0;
    }
    .schema-section {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 28px;
      text-align: center;
    }
    .schema-title {
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
      text-align: left;
    }
    .schema-img-container {
      background-color: #ffffff;
      border-radius: 8px;
      border: 1px dashed #cbd5e1;
      padding: 12px;
      display: inline-block;
      max-width: 100%;
      box-sizing: border-box;
    }
    .schema-img-container img {
      max-height: 220px;
      max-width: 100%;
      object-fit: contain;
    }
    .steps-section-title {
      font-size: 13px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }
    .step-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .step-checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid #cbd5e1;
      border-radius: 5px;
      margin-top: 2px;
      flex-shrink: 0;
      box-sizing: border-box;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .step-checkbox:hover {
      border-color: #2563eb;
    }
    .step-item.checked .step-checkbox {
      background-color: #10b981;
      border-color: #10b981;
    }
    .step-item.checked .step-checkbox::after {
      content: "✓";
      color: white;
      font-size: 12px;
      font-weight: bold;
    }
    .step-content {
      font-size: 13px;
    }
    .step-title-line {
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .step-num {
      font-family: monospace;
      color: #64748b;
      font-weight: 800;
    }
    .step-description {
      margin: 4px 0 0 0;
      color: #475569;
      white-space: pre-line;
      line-height: 1.5;
    }
    .visa-section {
      margin-top: 40px;
      border-top: 2px dashed #e2e8f0;
      padding-top: 24px;
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 24px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .visa-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 16px;
      min-height: 80px;
    }
    .visa-title {
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }
    .visa-line {
      border-bottom: 1px solid #cbd5e1;
      margin-top: 16px;
      height: 20px;
    }
    .mop-footer {
      text-align: center;
      margin-top: 32px;
      font-size: 10px;
      color: #94a3b8;
      font-family: monospace;
    }

    @media print {
      body {
        background-color: #ffffff;
        color: #000000;
      }
      .container {
        max-width: 100%;
        padding: 0;
        margin: 0;
      }
      .no-print-banner {
        display: none !important;
      }
      .mop-card {
        border: none;
        box-shadow: none;
        padding: 0;
      }
      .step-item {
        border-color: #94a3b8;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="no-print-banner">
      <div>
        <h1 class="banner-title">Mode Opératoire d'Impression</h1>
        <p class="banner-sub">Fiche de préparation prête pour l'impression physique ou PDF</p>
      </div>
      <button class="btn-print" onclick="window.print()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 1.144c.111.558-.303 1.056-.874 1.056H6.985c-.571 0-.985-.498-.874-1.056L6.34 18m11.32 0h-11.32M9 10.5h.008v.008H9V10.5Zm3 0h.008v.008H12V10.5Zm3 0h.008v.008H15V10.5Zm-9.25-3h12.5a1.25 1.25 0 0 1 1.25 1.25v3.75a1.25 1.25 0 0 1-1.25 1.25h-12.5A1.25 1.25 0 0 1 3.75 12.5V8.75A1.25 1.25 0 0 1 5 7.5ZM12 2.25c-1.913 0-3.52 1.398-3.81 3.25h7.62c-.29-1.852-1.897-3.25-3.81-3.25Z"></path>
        </svg>
        <span>Imprimer</span>
      </button>
    </div>

    <div class="mop-card">
      <div class="mop-header">
        <div class="header-left">
          <h1>Mode Opératoire : ${selectedMachine.name}</h1>
          <span class="machine-badge">Code: ${selectedMachine.code}</span>
          ${activeFormatLabel ? `<span class="format-badge">Format : ${activeFormatLabel}</span>` : ''}
        </div>
        <div class="header-right">
          <p><strong>Fiche de Préparation Technique</strong></p>
          <p>Ligne d'Embouteillage</p>
          <p>Édité le ${capitalizedDate}</p>
        </div>
      </div>

      ${activeImgUrl ? `
      <div class="schema-section">
        <div class="schema-title">Schéma / Photo d'Illustration</div>
        <div class="schema-img-container">
          <img src="${activeImgUrl}" alt="${selectedMachine.name}" />
        </div>
      </div>
      ` : ''}

      <div class="steps-section-title">Étapes de Préparation Recommandées</div>

      <div class="step-list">
        ${currentFormatSteps.map((step) => {
          const isChecked = (checkedSteps[selectedMachine.id] || []).includes(step.num);
          const checkedClass = isChecked ? 'checked' : '';
          return `
          <div class="step-item ${checkedClass}" onclick="this.classList.toggle('checked')">
            <div class="step-checkbox"></div>
            <div class="step-content">
              <div class="step-title-line">
                <span class="step-num">Étape ${step.num} :</span>
                <span>${step.title}</span>
              </div>
              <p class="step-description">${step.description}</p>
            </div>
          </div>
          `;
        }).join('')}
      </div>

      <div class="mop-footer">
        Fiche opérationnelle générée par l'Assistant de Shift • Code Document: mop-${selectedMachine.id}
      </div>
    </div>
  </div>
</body>
</html>`;

    await saveOrShareFile(`Mode_Operatoire_${selectedMachine.name}.html`, htmlContent, 'text/html', false);
  };

  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState<boolean>(false);
  const [showAndroidPrintPreview, setShowAndroidPrintPreview] = useState<boolean>(false);
  const [showPrintSuccessToast, setShowPrintSuccessToast] = useState<boolean>(false);

  // States for the Android Print Spooler configuration
  const [androidPrinter, setAndroidPrinter] = useState<string>('pdf'); // 'pdf', 'drive', 'printer_wifi'
  const [androidCopies, setAndroidCopies] = useState<number>(1);
  const [androidColor, setAndroidColor] = useState<'color' | 'mono'>('color');
  const [androidPaperSize, setAndroidPaperSize] = useState<'A4' | 'Letter'>('A4');
  const [androidOrientation, setAndroidOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [androidExpandedOptions, setAndroidExpandedOptions] = useState<boolean>(false);
  const [androidSelectedPages, setAndroidSelectedPages] = useState<Record<number, boolean>>({});

  // States for Local PDF Document Editor & Generator (100% offline, no AI connection)
  const [localPdfTitle, setLocalPdfTitle] = useState<string>('Procédure de nettoyage de la laveuse');
  const [localPdfDate, setLocalPdfDate] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  });
  const [localPdfAuthor, setLocalPdfAuthor] = useState<string>('F. Florand');
  const [localPdfParagraphs, setLocalPdfParagraphs] = useState<string[]>([
    "Cette procédure décrit les étapes indispensables pour nettoyer la laveuse rotative après une production complète.",
    "Premièrement, couper l'alimentation électrique générale et fermer les vannes d'alimentation en eau chaude.",
    "Deuxièmement, retirer les filtres à sédiments et les rincer soigneusement sous l'eau claire avec une brosse souple.",
    "Enfin, effectuer un cycle de désinfection à vide avec le produit recommandé, puis consigner l'opération dans le registre."
  ]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('procedure');
  const [localPdfError, setLocalPdfError] = useState<string>('');

  useEffect(() => {
    if (showSaveSuccess) {
      const timer = setTimeout(() => setShowSaveSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSaveSuccess]);

  useEffect(() => {
    if (showPrintSuccessToast) {
      const timer = setTimeout(() => setShowPrintSuccessToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showPrintSuccessToast]);

  useEffect(() => {
    db.machines.orderBy('order').toArray().then(m => {
        setMachines(m.length > 0 ? m : PACKAGING_MACHINES);
    });
    db.productionRecaps.toArray().then(r => {
        const recaps: Record<string, ProductionRecap> = {};
        r.forEach(recap => { recaps[recap.dateStr] = recap; });
        setProductionRecaps(recaps);
    });
    db.history.toArray().then(h => {
        setHistory(h);
    });
    db.checkedSteps.toArray().then(cs => {
        const steps: Record<string, number[]> = {};
        cs.forEach(item => { steps[item.machineId] = item.steps; });
        setCheckedSteps(steps);
    });
  }, []);

  const [productionRecaps, setProductionRecaps] = useState<Record<string, ProductionRecap>>(() => {
    try {
      const saved = localStorage.getItem('bottle_production_recaps');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Failed to parse production recaps', e);
      return {};
    }
  });

  const saveProductionRecap = (dateStr: string, updated: Partial<ProductionRecap>) => {
    setProductionRecaps(prev => {
      const curr = prev[dateStr] || { dateStr, notes: '', photos: [null, null, null] };
      const next = { ...curr, ...updated };
      const updatedMap = { ...prev, [dateStr]: next };
      db.productionRecaps.put(next);
      return updatedMap;
    });
  };

  // Function to process and generate PDF locally (completely offline, APK / hybrid compatible)
  const genererPdfDepuisEditeurLocal = async () => {
    try {
      setLocalPdfError('');
      if (!localPdfTitle.trim()) {
        throw new Error("Le titre du document ne peut pas être vide.");
      }

      // Initialize jsPDF
      const doc = new jsPDF('p', 'mm', 'a4');
      
      let y = 30;
      const margin = 20;
      const printableWidth = 170; // A4 standard is 210mm wide. 210 - (20 * 2) = 170mm

      // Title layout
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42); // slate-900
      const titleLines = doc.splitTextToSize(localPdfTitle, printableWidth);
      for (const line of titleLines) {
        if (y + 10 > 280) {
          doc.addPage();
          y = 25;
        }
        doc.text(line, margin, y);
        y += 8;
      }

      // Thin separator
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(margin, y + 2, 210 - margin, y + 2);
      y += 12;

      // Author & Date layout
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Rédacteur : ${localPdfAuthor || 'Non précisé'}`, margin, y);
      doc.text(`Date : ${localPdfDate}`, 210 - margin - doc.getTextWidth(`Date : ${localPdfDate}`), y);
      y += 12;

      // Paragraphs layout
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59); // slate-800

      const validParagraphs = localPdfParagraphs.filter(p => p.trim() !== '');
      if (validParagraphs.length === 0) {
        throw new Error("Veuillez saisir au moins un paragraphe de contenu.");
      }

      for (const p of validParagraphs) {
        const lines = doc.splitTextToSize(p, printableWidth);
        for (const line of lines) {
          if (y + 7 > 280) {
            doc.addPage();
            y = 25;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(30, 41, 59);
          }
          doc.text(line, margin, y);
          y += 6.5;
        }
        y += 5; // Spacing between paragraphs
      }

      // Page numbers footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(`Document Technique Local • Page ${i}/${totalPages}`, margin, 287);
      }

      // Convert to Base64 and export using saveOrShareFile (Capacitor/Cordova friendly)
      const dataUri = doc.output('datauristring');
      const base64Index = dataUri.indexOf(';base64,');
      const base64Data = base64Index !== -1 ? dataUri.substring(base64Index + 8) : dataUri;

      // Clean filename
      const cleanFilename = localPdfTitle
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .substring(0, 35) || 'document_technique';

      await saveOrShareFile(`${cleanFilename}.pdf`, base64Data, 'application/pdf', true);
      return true;
    } catch (err: any) {
      console.error("Erreur génération PDF local:", err);
      setLocalPdfError(err.message || "Erreur lors de la génération du fichier PDF.");
      return false;
    }
  };

  // Switch template and pre-populate fields
  const appliquerTemplateLocal = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const todayStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    setLocalPdfDate(todayStr);

    if (templateKey === 'production') {
      setLocalPdfTitle("Rapport de Production - Ligne d'embouteillage");
      setLocalPdfAuthor("Responsable de Ligne");
      setLocalPdfParagraphs([
        "Ce rapport technique consigne les performances globales et le suivi opérationnel de la ligne de conditionnement sur la journée de production.",
        "La cadence nominale a été maintenue avec succès à 4500 bouteilles par heure. Aucune anomalie majeure de sertissage ou d'étiquetage n'est à signaler.",
        "Le rendement global machine s'établit à 94.5% pour ce lot. Un nettoyage complet de fin de poste a été rigoureusement exécuté conformément aux protocoles sanitaires HACCP."
      ]);
    } else if (templateKey === 'securite') {
      setLocalPdfTitle("Consignes de Sécurité - Intervention Machine");
      setLocalPdfAuthor("Animateur HSE");
      setLocalPdfParagraphs([
        "Toute intervention d'entretien ou de débourrage sur les parties mobiles de la ligne exige l'application la plus stricte de la procédure de consignation électrique.",
        "Il est impératif de s'équiper de l'ensemble des équipements de protection individuelle (EPI) obligatoires : lunettes anti-projections, gants renforcés et protections auditives.",
        "En cas de dysfonctionnement critique ou de danger immédiat, actionnez instantanément l'un des boutons d'arrêt d'urgence de type 'coup de poing' disposés le long du convoie."
      ]);
    } else if (templateKey === 'incident') {
      setLocalPdfTitle("Rapport d'Incident - Bourrage Étiqueteuse");
      setLocalPdfAuthor("Technicien de Maintenance");
      setLocalPdfParagraphs([
        "Un arrêt de ligne imprévu de 14 minutes est survenu en cours de matinée suite à un bourrage répétitif sur le carrousel principal de distribution des étiquettes.",
        "Après investigation, l'arbre d'entraînement a été nettoyé des résidus de colle et de papier, puis lubrifié. Les capteurs d'alignement optique ont subi un recalibrage.",
        "Un essai de production à vide de 50 bouteilles a été effectué avec succès avant la relance effective de la production. Une surveillance accrue est recommandée sur les prochaines bobines."
      ]);
    } else {
      // Vierge
      setLocalPdfTitle("Document Technique Personnalisé");
      setLocalPdfAuthor("Opérateur de Production");
      setLocalPdfParagraphs([
        "Saisissez vos paragraphes de contenu dans l'éditeur local ci-contre.",
        "Vous pouvez librement ajouter de nouveaux paragraphes, les modifier ou supprimer ceux qui ne vous conviennent pas pour adapter ce document à votre situation."
      ]);
    }
  };

  const handleRecapImageUpload = (slotIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      if (base64Data) {
        try {
          const compressed = await compressImage(base64Data, 1000, 1000, 0.7);
          const currentForDate = productionRecaps[selectedDateStr] || { dateStr: selectedDateStr, notes: '', photos: [null, null, null] };
          const nextPhotos = [...currentForDate.photos];
          nextPhotos[slotIndex] = compressed;
          saveProductionRecap(selectedDateStr, { photos: nextPhotos });
        } catch (err) {
          console.error("Compression error:", err);
          const currentForDate = productionRecaps[selectedDateStr] || { dateStr: selectedDateStr, notes: '', photos: [null, null, null] };
          const nextPhotos = [...currentForDate.photos];
          nextPhotos[slotIndex] = base64Data;
          saveProductionRecap(selectedDateStr, { photos: nextPhotos });
        } finally {
          setIsCompressing(false);
        }
      } else {
        setIsCompressing(false);
      }
    };
    reader.onerror = () => {
      setIsCompressing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRecapImageDelete = (slotIndex: number) => {
    const currentForDate = productionRecaps[selectedDateStr];
    if (!currentForDate) return;
    const nextPhotos = [...currentForDate.photos];
    nextPhotos[slotIndex] = null;
    saveProductionRecap(selectedDateStr, { photos: nextPhotos });
  };

  const handleRecapNotesChange = (text: string) => {
    saveProductionRecap(selectedDateStr, { notes: text });
  };

  const handleExportPDF = async () => {
    const recap = productionRecaps[selectedDateStr] || { dateStr: selectedDateStr, notes: '', photos: [null, null, null] };
    
    let formattedDate = selectedDateStr;
    try {
      const d = new Date(selectedDateStr);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
    } catch (e) {
      console.error(e);
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Sleek corporate slate banner at top
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(15, 15, 180, 24, 'F');

    // Title in banner
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text("RAPPORT QUOTIDIEN DE PRODUCTION", 22, 24);

    // Subtitle in banner
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(147, 197, 253); // Light Blue-300
    doc.text("Généré automatiquement • Pilote de Production", 22, 31);

    // 2. Fiche Details Box
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.rect(15, 45, 180, 18, 'F');
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.rect(15, 45, 180, 18, 'S');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text("DATE DU RAPPORT :", 20, 52);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59); // Slate-800
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    doc.text(capitalizedDate, 20, 58);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("STATUS :", 145, 52);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129); // Emerald-500
    doc.text("ENREGISTRÉ", 145, 58);

    // 3. Observations Text Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("OBSERVATIONS, INCIDENTS ET RELÈVES :", 15, 75);

    const notesText = recap.notes?.trim() || "Aucune observation ou consigne n'a été saisie pour cette journée de production.";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85); // Slate-700
    
    const splitNotes = doc.splitTextToSize(notesText, 170);
    const lineSpacing = 5.2;
    const padding = 8;
    const bodyHeight = Math.max(25, splitNotes.length * lineSpacing + padding);
    
    // Draw bg rect
    doc.setFillColor(248, 250, 252);
    doc.rect(17, 80, 178, bodyHeight, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.rect(17, 80, 178, bodyHeight, 'S');

    // Render left bar exactly stretching the height
    doc.setFillColor(59, 130, 246);
    doc.rect(15, 80, 2, bodyHeight, 'F');

    // Draw notes lines inside the box
    doc.text(splitNotes, 22, 87);

    // 4. Photos Visuelles Section (Enlarged on dedicated annex page for maximal readability)
    const hasPhotos = recap.photos?.some(p => p !== null);
    let activePage = 1;

    if (hasPhotos) {
      doc.addPage();
      activePage = 2;
      
      // Page 2 header
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("RAPPORT DE PRODUCTION DU " + capitalizedDate.toUpperCase() + " - ANNEXES PHOTO", 15, 12);
      doc.setDrawColor(241, 245, 249);
      doc.line(15, 14, 195, 14);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text("RÉCAPITULATIFS VISUELS (GRAND CONFIGURATION)", 15, 22);

      const photosY = 28;
      const photoWidth = 82;
      const photoHeight = 82;
      const rowGap = 15;
      const colGap = 16;

      for (let i = 0; i < 3; i++) {
        const row = i === 2 ? 1 : 0;
        const col = i === 2 ? 0 : i;

        const x = 15 + col * (photoWidth + colGap);
        const y = photosY + row * (photoHeight + rowGap);
        const imgData = recap.photos?.[i];

        if (imgData) {
          try {
            // Draw a subtle border frame around the image space
            doc.setDrawColor(203, 213, 225); // slate-300
            doc.rect(x - 0.5, y - 0.5, photoWidth + 1, photoHeight + 7, 'S');

            // Draw image
            doc.addImage(imgData, 'JPEG', x, y, photoWidth, photoHeight);
            
            // Draw a footer background inside the frame for labels
            doc.setFillColor(241, 245, 249);
            doc.rect(x, y + photoHeight, photoWidth, 6, 'F');
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(`PHOTO DU RÉCAPITULATIF RELEVÉ ${i + 1}`, x + 16, y + photoHeight + 4.2);
          } catch (e) {
            console.error("Failed to add image to PDF:", e);
            // Draw fallback block
            doc.setFillColor(248, 250, 252);
            doc.rect(x, y, photoWidth, photoHeight, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.rect(x, y, photoWidth, photoHeight, 'S');
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184);
            doc.text("Erreur d'affichage d'image", x + 18, y + 38);
            doc.text(`Photo ${i + 1}`, x + 34, y + 46);
          }
        } else {
          // Draw empty slot block
          doc.setFillColor(250, 250, 250);
          doc.rect(x, y, photoWidth, photoHeight, 'F');
          doc.setDrawColor(241, 245, 249);
          doc.rect(x, y, photoWidth, photoHeight, 'S');
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(164, 178, 192);
          doc.text("Aucun visuel enregistré", x + 24, y + 38);
          doc.text(`Emplacement Photo ${i + 1}`, x + 23, y + 45);
        }
      }
    }

    const totalPages = activePage;
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Document généré via le Pilote de Production • Code Relève: recaps-${selectedDateStr} • Page ${p}/${totalPages}`, 15, 287);
    }

    const dataUri = doc.output('datauristring');
    const base64Index = dataUri.indexOf(';base64,');
    const base64Data = base64Index !== -1 ? dataUri.substring(base64Index + 8) : dataUri;
    await saveOrShareFile(`Fiche_Production_${selectedDateStr}.pdf`, base64Data, 'application/pdf', true);
  };

  const handleExportPhotosHTML = async () => {
    const recap = productionRecaps[selectedDateStr];
    const photos = recap?.photos ? recap.photos.filter((p): p is string => p !== null) : [];
    if (photos.length === 0) {
      alert("Aucune photo disponible dans ce rapport de shift.");
      return;
    }

    let formattedDate = selectedDateStr;
    try {
      const d = new Date(selectedDateStr);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
    } catch (e) {
      console.error(e);
    }
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Photos de Rapport - ${selectedDateStr}</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px;
    }
    .no-print-banner {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #ffffff;
      padding: 20px 24px;
      border-radius: 16px;
      margin-bottom: 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    }
    .banner-title {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .banner-sub {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: #94a3b8;
      font-weight: 500;
    }
    .btn-print {
      background-color: #2563eb;
      color: #ffffff;
      border: none;
      padding: 11px 22px;
      font-weight: 700;
      font-size: 13px;
      border-radius: 10px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
      transition: all 0.2s ease;
    }
    .btn-print:hover {
      background-color: #1d4ed8;
      transform: translateY(-1px);
    }
    .btn-print:active {
      transform: translateY(1px);
    }
    .photo-card {
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 32px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
      box-sizing: border-box;
    }
    .photo-header {
      text-align: left;
      margin-bottom: 18px;
      border-left: 4px solid #2563eb;
      padding-left: 12px;
    }
    .photo-title {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .photo-date {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .photo-frame {
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: #0f172a;
      border-radius: 12px;
      overflow: hidden;
      padding: 8px;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .photo-frame img {
      max-width: 100%;
      max-height: 75vh;
      object-fit: contain;
      border-radius: 6px;
    }
    .photo-footer {
      text-align: center;
      margin-top: 16px;
      font-size: 10px;
      color: #94a3b8;
      font-family: monospace;
    }
    @media print {
      body {
        background-color: #ffffff;
      }
      .container {
        max-width: 100%;
        padding: 0;
        margin: 0;
      }
      .no-print-banner {
        display: none !important;
      }
      .photo-card {
        border: none;
        box-shadow: none;
        padding: 0;
        margin: 0;
        page-break-after: always;
        break-after: page;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .photo-card:last-child {
        page-break-after: avoid;
        break-after: avoid;
      }
      .photo-frame {
        background-color: transparent;
        padding: 0;
        box-shadow: none;
      }
      .photo-frame img {
        max-height: 80vh;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="no-print-banner">
      <div>
        <h1 class="banner-title">Photos de Rapport - Shift de Production</h1>
        <p class="banner-sub">${capitalizedDate}</p>
      </div>
      <button class="btn-print" onclick="window.print()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 1.144c.111.558-.303 1.056-.874 1.056H6.985c-.571 0-.985-.498-.874-1.056L6.34 18m11.32 0h-11.32M9 10.5h.008v.008H9V10.5Zm3 0h.008v.008H12V10.5Zm3 0h.008v.008H15V10.5Zm-9.25-3h12.5a1.25 1.25 0 0 1 1.25 1.25v3.75a1.25 1.25 0 0 1-1.25 1.25h-12.5A1.25 1.25 0 0 1 3.75 12.5V8.75A1.25 1.25 0 0 1 5 7.5ZM12 2.25c-1.913 0-3.52 1.398-3.81 3.25h7.62c-.29-1.852-1.897-3.25-3.81-3.25Z"></path>
        </svg>
        <span>Imprimer la page</span>
      </button>
    </div>

    ${photos.map((imgSrc, idx) => `
    <div class="photo-card">
      <div class="photo-header">
        <h2 class="photo-title">Photo ${idx + 1} sur ${photos.length}</h2>
        <p class="photo-date">${capitalizedDate}</p>
      </div>
      <div class="photo-frame">
        <img src="${imgSrc}" alt="Photo ${idx + 1}" />
      </div>
      <div class="photo-footer">
        Fiche de Production • Code Relève : recaps-${selectedDateStr} • Page ${idx + 1} / ${photos.length}
      </div>
    </div>
    `).join('')}
  </div>
</body>
</html>`;

    await saveOrShareFile(`Photos_Rapport_Shift_${selectedDateStr}.html`, htmlContent, 'text/html', false);
  };

  const handleExportData = async () => {
    const data = {
      recaps: localStorage.getItem('bottle_production_recaps'),
      history: localStorage.getItem('bottle_calc_history'),
      checkedSteps: localStorage.getItem('bottle_checked_steps'),
      machines: localStorage.getItem('bottle_machines_custom')
    };
    const jsonString = JSON.stringify(data);
    await saveOrShareFile(
      `pilote_db_${new Date().toISOString().split('T')[0]}.json`,
      jsonString,
      'application/json',
      false
    );
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.recaps) localStorage.setItem('bottle_production_recaps', data.recaps);
        if (data.history) localStorage.setItem('bottle_calc_history', data.history);
        if (data.checkedSteps) localStorage.setItem('bottle_checked_steps', data.checkedSteps);
        if (data.machines) localStorage.setItem('bottle_machines_custom', data.machines);
        alert("Données importées avec succès. L'application va se recharger.");
        window.location.reload();
      } catch (err) {
        alert("Erreur lors de l'importation. Le fichier est peut-être corrompu.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  // Inputs state for calculator
  const [targetQuantity, setTargetQuantity] = useState<number>(30000);
  const [formatId, setFormatId] = useState<BottleFormatType>('75cl');
  const [customConveyor, setCustomConveyor] = useState<number>(3400);
  const [palletizerQuantity, setPalletizerQuantity] = useState<number>(1800);
  
  // Custom configurations for pallets
  const [customPalletSize, setCustomPalletSize] = useState<number>(0); 
  const [bottlesPerHour, setBottlesPerHour] = useState<number>(3000);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Editable Internal Reference variables
  const [conveyor75, setConveyor75] = useState<number>(3400);
  const [conveyor33, setConveyor33] = useState<number>(5200);
  const [pallet75, setPallet75] = useState<number>(600);
  const [pallet33, setPallet33] = useState<number>(1200);
  const [conveyorCustom, setConveyorCustom] = useState<number>(0);
  const [palletCustom, setPalletCustom] = useState<number>(1000);
  const [showRefEdit, setShowRefEdit] = useState<boolean>(false);

  // History state
  const [history, setHistory] = useState<CalculationLog[]>([]);

  // Selected Machine in operating procedures tab
  const [selectedMachineId, setSelectedMachineId] = useState<string>('souffleuse');
  
  // Camera capture state
  const [cameraActiveTarget, setCameraActiveTarget] = useState<{
    type: 'machine' | 'supply' | 'recap';
    id?: string; // supply ID
    slotIndex?: number; // recap photo slot index
  } | null>(null);
  
  // Machine Checklist State: stores completed steps per machine ID as string[]
  const [checkedSteps, setCheckedSteps] = useState<Record<string, number[]>>({});

  // Machine test cycle simulation state
  const [simulatingMachineId, setSimulatingMachineId] = useState<string | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'testing' | 'success'>('idle');

  // Machines list state with support for persistent custom troubleshooting pannes & solutions and metadata merging
  const [machines, setMachines] = useState<MachineProcedure[]>(() => {
    try {
      const saved = localStorage.getItem('bottle_machines_custom');
      if (saved) {
        const parsed = JSON.parse(saved) as MachineProcedure[];
        // Merge with PACKAGING_MACHINES to ensure new layout fields like containerImages are available
        return PACKAGING_MACHINES.map(original => {
          const savedMach = parsed.find(m => m.id === original.id);
          if (savedMach) {
            let mergedContainers = original.containerImages;
            if (original.containerImages && savedMach.containerImages) {
              mergedContainers = original.containerImages.map(origCont => {
                const savedCont = savedMach.containerImages?.find(c => c.id === origCont.id);
                return {
                  ...origCont,
                  label: savedCont?.label || origCont.label,
                  imageUrl: savedCont?.imageUrl || origCont.imageUrl
                };
              });
            } else if (original.containerImages) {
              mergedContainers = original.containerImages;
            }
            return {
              ...original,
              troubleshooting: savedMach.troubleshooting || original.troubleshooting,
              imageUrl: savedMach.imageUrl || original.imageUrl,
              containerImages: mergedContainers,
              supplies: savedMach.supplies !== undefined ? savedMach.supplies : original.supplies,
              mainSteps: (savedMach.mainSteps && savedMach.mainSteps.length > 0) ? savedMach.mainSteps : original.mainSteps,
              containerSteps: savedMach.containerSteps || original.containerSteps
            };
          }
          return original;
        });
      }
    } catch (e) {
      console.error('Failed to parse custom machines from localstorage', e);
    }
    return PACKAGING_MACHINES;
  });

  // Troubleshooting editing state
  const [isEditingTroubles, setIsEditingTroubles] = useState<boolean>(false);
  const [editingTroublesList, setEditingTroublesList] = useState<{ issue: string; solution: string }[]>([]);

  // Machine Addition & Editing standard states
  const [isAddingMachine, setIsAddingMachine] = useState<boolean>(false);
  const [newMachName, setNewMachName] = useState<string>('');
  const [newMachCode, setNewMachCode] = useState<string>('');
  const [newMachIcon, setNewMachIcon] = useState<string>('Settings');
  const [newMachColor, setNewMachColor] = useState<string>('blue');
  const [newMachDesc, setNewMachDesc] = useState<string>('');

  const [isEditingSelectedMachine, setIsEditingSelectedMachine] = useState<boolean>(false);
  const [editMachName, setEditMachName] = useState<string>('');
  const [editMachCode, setEditMachCode] = useState<string>('');
  const [editMachIcon, setEditMachIcon] = useState<string>('Settings');
  const [editMachDesc, setEditMachDesc] = useState<string>('');
  const [editMachSteps, setEditMachSteps] = useState<ProcedureStep[]>([]);
  const [editForContainerFormat, setEditForContainerFormat] = useState<boolean>(true);

  const handleCreateMachine = () => {
    if (!newMachName.trim()) {
      alert("Veuillez saisir un nom pour la machine.");
      return;
    }
    const code = newMachCode.trim() || `MACH-${Math.floor(100 + Math.random() * 900)}`;
    const newId = newMachName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    
    const newMachine: MachineProcedureExtended = {
      id: newId,
      name: newMachName.trim(),
      code: code,
      icon: newMachIcon,
      color: newMachColor,
      description: newMachDesc.trim() || 'No description provided.',
      mainSteps: [
        { num: 1, title: 'Vérification visuelle', description: 'Inspecter visuellement l\'état général et les alimentations.' },
        { num: 2, title: 'Mise sous tension', description: 'Actionner le sectionneur général et s\'assurer que l\'IHM s\'allume sans défaut.' }
      ],
      troubleshooting: [
        { issue: 'Défaut d\'initialisation', solution: 'Vérifier l\'arrêt d\'urgence ou réinitialiser le disjoncteur principal.' }
      ],
      supplies: [],
      order: machines.length
    };

    db.machines.add(newMachine).then(() => {
        const updated = [...machines, newMachine];
        setMachines(updated);
        setSelectedMachineId(newId);
    });
    
    // Reset form states
    setIsAddingMachine(false);
    setNewMachName('');
    setNewMachCode('');
    setNewMachIcon('Settings');
    setNewMachColor('blue');
    setNewMachDesc('');
  };

  const handleDeleteMachine = (id: string) => {
    console.log("deleting machine", id);
    const mach = machines.find(m => m.id === id);
    if (!mach) {
      console.log("machine not found", id, machines);
      return;
    }
    const updated = machines.filter(m => m.id !== id);
    setMachines(updated);
    localStorage.setItem('bottle_machines_custom', JSON.stringify(updated));
    if (selectedMachineId === id) {
      if (updated.length > 0) {
        setSelectedMachineId(updated[0].id);
      } else {
        setSelectedMachineId('');
      }
    }
  };

  const handleStartEditingSelectedMachine = () => {
    if (!selectedMachine) return;
    setEditMachName(selectedMachine.name);
    setEditMachCode(selectedMachine.code);
    setEditMachIcon(selectedMachine.icon);
    setEditMachDesc(selectedMachine.description);
    
    const hasContainers = selectedMachine.containerImages && selectedMachine.containerImages.length > 0;
    const isFormatEditing = hasContainers && activeContainerId;
    setEditForContainerFormat(!!isFormatEditing);

    const initialSteps = (isFormatEditing && selectedMachine.containerSteps && selectedMachine.containerSteps[activeContainerId])
      ? selectedMachine.containerSteps[activeContainerId]
      : (selectedMachine.mainSteps || []);

    setEditMachSteps(initialSteps.map(s => ({ ...s })));
    setIsEditingSelectedMachine(true);
  };

  const handleSaveSelectedMachine = () => {
    if (!editMachName.trim()) {
      alert("Veuillez saisir un nom pour la machine.");
      return;
    }
    const updated = machines.map(m => {
      if (m.id === selectedMachineId) {
        const processedSteps = editMachSteps.map((step, index) => ({
          ...step,
          num: index + 1
        }));

        if (editForContainerFormat && activeContainerId) {
          const nextContainerSteps = {
            ...(m.containerSteps || {}),
            [activeContainerId]: processedSteps
          };
          return {
            ...m,
            name: editMachName.trim(),
            code: editMachCode.trim() || m.code,
            icon: editMachIcon,
            description: editMachDesc.trim(),
            containerSteps: nextContainerSteps
          };
        } else {
          return {
            ...m,
            name: editMachName.trim(),
            code: editMachCode.trim() || m.code,
            icon: editMachIcon,
            description: editMachDesc.trim(),
            mainSteps: processedSteps
          };
        }
      }
      return m;
    });

    setMachines(updated);
    localStorage.setItem('bottle_machines_custom', JSON.stringify(updated));
    setIsEditingSelectedMachine(false);
  };

  // Machine image light-box/zoom states
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [zoomRotation, setZoomRotation] = useState<number>(0);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; action: () => void; title: string; message: string }>({ isOpen: false, action: () => {}, title: '', message: '' });

  // States and handlers for multi-touch pinch to zoom
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [initScale, setInitScale] = useState<number>(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      setTouchStartDist(dist);
      setInitScale(zoomScale);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist !== null) {
      if (e.cancelable) {
        e.preventDefault();
      }
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = dist / touchStartDist;
      const dampenedFactor = 1 + (factor - 1) * 0.5;
      const newScale = Math.min(Math.max(initScale * dampenedFactor, 0.5), 5);
      setZoomScale(Number(newScale.toFixed(2)));
    }
  };

  const handleTouchEnd = () => {
    setTouchStartDist(null);
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(y => y - 1);
    } else {
      setCalendarMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(y => y + 1);
    } else {
      setCalendarMonth(m => m + 1);
    }
  };

  // Active container format for machine-specific multipart images (e.g., verre 33cl, PET 50cl etc.)
  const [activeContainerId, setActiveContainerId] = useState<string>('verre_33cl_plat');

  // Currently selected tab of the machine details card (either 'mop' for operating procedure, or 'supplies' for supplies/fournitures)
  const [activeMachineSection, setActiveMachineSection] = useState<'mop' | 'supplies'>('mop');

  // Load target configuration and history
  useEffect(() => {
    const savedHistory = localStorage.getItem('bottle_calc_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load history', e);
      }
    }

    // Load checked steps from localStorage
    const savedSteps = localStorage.getItem('bottle_checked_steps');
    if (savedSteps) {
      try {
        setCheckedSteps(JSON.parse(savedSteps));
      } catch (e) {
        console.error('Failed to load checked steps', e);
      }
    }
  }, []);

  // Dynamic reference formats based on custom states
  const currentFormats: BottleFormat[] = [
    { 
      id: '75cl', 
      label: 'Format 75 cl', 
      volume: '75cl', 
      conveyorDefault: conveyor75,
      palletDefaultSize: pallet75
    },
    { 
      id: '33cl', 
      label: 'Format 33 cl', 
      volume: '33cl', 
      conveyorDefault: conveyor33,
      palletDefaultSize: pallet33
    },
    { 
      id: 'custom', 
      label: 'Format Spécifique', 
      volume: 'Perso', 
      conveyorDefault: conveyorCustom,
      palletDefaultSize: palletCustom
    }
  ];

  // Update conveyor value when format changes
  const handleFormatChange = (id: BottleFormatType) => {
    setFormatId(id);
    const selectedFormat = currentFormats.find(f => f.id === id);
    if (selectedFormat && id !== 'custom') {
      setCustomConveyor(selectedFormat.conveyorDefault);
    } else if (id === 'custom') {
      setCustomConveyor(0);
    }
  };

  const selectedFormat = currentFormats.find(f => f.id === formatId) || currentFormats[0];
  const conveyorQuantity = formatId === 'custom' ? customConveyor : selectedFormat.conveyorDefault;
  
  // Calculations
  const totalSubtracted = conveyorQuantity + palletizerQuantity;
  const quantityToProduce = Math.max(0, targetQuantity - totalSubtracted);
  const targetCompleted = totalSubtracted >= targetQuantity;

  // Pallet estimations
  const bottlesPerPallet = customPalletSize > 0 ? customPalletSize : (selectedFormat.palletDefaultSize || 1000);
  const estimatedPalletsNeeded = (quantityToProduce / bottlesPerPallet).toFixed(2);

  // Carton calculations for Palletizer
  const getCartonsAndRemainder = (quantity: number) => {
    if (formatId === '75cl') {
      const cartons = Math.floor(quantity / 12);
      const remainder = quantity % 12;
      return { cartons, remainder, bottlePerCarton: 12 };
    } else if (formatId === '33cl') {
      const cartons = Math.floor(quantity / 20);
      const remainder = quantity % 20;
      return { cartons, remainder, bottlePerCarton: 20 };
    }
    return null;
  };

  const getCartonText = (quantity: number) => {
    const calc = getCartonsAndRemainder(quantity);
    if (!calc) return '';
    const { cartons, remainder } = calc;
    if (remainder === 0) {
      return `${cartons.toLocaleString('fr-FR')} ct.`;
    }
    return `${cartons.toLocaleString('fr-FR')} ct. + ${remainder} b.`;
  };

  const bottleFactor = formatId === '75cl' ? 12 : formatId === '33cl' ? 20 : 0;
  const currentCartons = bottleFactor > 0 ? Math.floor(palletizerQuantity / bottleFactor) : 0;

  // Quick increment handlers for shop floor usability
  const adjustValue = (
    field: 'target' | 'conveyor' | 'palletizer', 
    amount: number
  ) => {
    if (field === 'target') {
      setTargetQuantity(prev => Math.max(0, prev + amount));
    } else if (field === 'conveyor') {
      setCustomConveyor(prev => Math.max(0, prev + amount));
    } else if (field === 'palletizer') {
      setPalletizerQuantity(prev => Math.max(0, prev + amount));
    }
  };

  // Safe manual adjustments via input
  const handleNumberInput = (
    valStr: string, 
    setter: React.Dispatch<React.SetStateAction<number>>
  ) => {
    const parsed = parseInt(valStr.replace(/\s/g, ''), 10);
    setter(isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  // Reset calculations
  const handleReset = () => {
    setTargetQuantity(30000);
    setFormatId('75cl');
    setCustomConveyor(conveyor75);
    setPalletizerQuantity(1800);
    setCustomPalletSize(0);
  };

  // Save to Local Logs History
  const saveCalculation = () => {
    const newLog: CalculationLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      input: {
        targetQuantity,
        format: formatId,
        customConveyorQuantity: customConveyor,
        palletizerQuantity
      },
      result: {
        targetQuantity,
        formatLabel: selectedFormat.label,
        conveyorQuantity,
        palletizerQuantity,
        quantityToProduce,
        isCompleted: targetCompleted
      }
    };

    const updatedHistory = [newLog, ...history].slice(0, 15); // Limit to top 15 logs
    setHistory(updatedHistory);
    localStorage.setItem('bottle_calc_history', JSON.stringify(updatedHistory));
    setShowSaveSuccess(true);
  };

  // Delete history item
  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('bottle_calc_history', JSON.stringify(updated));
  };

  // Clear all history
  const clearAllHistory = () => {
    if (window.confirm('Voulez-vous vraiment effacer tout l\'historique ?')) {
      setHistory([]);
      localStorage.removeItem('bottle_calc_history');
    }
  };

  // Restore calculation inputs from log
  const loadFromLog = (log: CalculationLog) => {
    setTargetQuantity(log.input.targetQuantity);
    setFormatId(log.input.format);
    setCustomConveyor(log.input.customConveyorQuantity);
    setPalletizerQuantity(log.input.palletizerQuantity);
    setActiveTab('calculator'); // auto focus calculations tab
  };

  const moveMachine = async (id: string, direction: number) => {
    const currentIndex = machines.findIndex(m => m.id === id);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= machines.length) return;

    const newMachines = [...machines];
    [newMachines[currentIndex], newMachines[nextIndex]] = [newMachines[nextIndex], newMachines[currentIndex]];
    
    // Update order
    const updated = newMachines.map((m, index) => ({ ...m, order: index } as MachineProcedureExtended));
    
    setMachines(updated);
    
    // Update Dexie
    await db.machines.bulkPut(updated);
  };

  // Checklist handler
  const toggleStep = (machineId: string, stepNum: number) => {
    const machineChecked = checkedSteps[machineId] || [];
    let updated: number[];
    if (machineChecked.includes(stepNum)) {
      updated = machineChecked.filter(n => n !== stepNum);
    } else {
      updated = [...machineChecked, stepNum];
    }
    const newChecked = { ...checkedSteps, [machineId]: updated };
    setCheckedSteps(newChecked);
    localStorage.setItem('bottle_checked_steps', JSON.stringify(newChecked));
  };

  // Reset checklist for specific machine
  const resetChecklist = (machineId: string) => {
    const newChecked = { ...checkedSteps, [machineId]: [] };
    setCheckedSteps(newChecked);
    localStorage.setItem('bottle_checked_steps', JSON.stringify(newChecked));
  };

  // Simulate machine test cycle
  const runMachineTest = (machineId: string) => {
    setSimulatingMachineId(machineId);
    setSimulationStatus('testing');
    
    setTimeout(() => {
      setSimulationStatus('success');
      setTimeout(() => {
        setSimulatingMachineId(null);
        setSimulationStatus('idle');
      }, 2500);
    }, 1800);
  };

  // Troubleshooting helper methods
  const startEditingTroubles = () => {
    const currentMachine = machines.find(m => m.id === selectedMachineId) || machines[0];
    setEditingTroublesList(currentMachine.troubleshooting.map(t => ({ ...t })));
    setIsEditingTroubles(true);
  };

  const handleTroubleChange = (index: number, field: 'issue' | 'solution', value: string) => {
    const updated = [...editingTroublesList];
    updated[index] = { ...updated[index], [field]: value };
    setEditingTroublesList(updated);
  };

  const addTroubleItem = () => {
    setEditingTroublesList([...editingTroublesList, { issue: '', solution: '' }]);
  };

  const removeTroubleItem = (index: number) => {
    setEditingTroublesList(editingTroublesList.filter((_, idx) => idx !== index));
  };

  const saveTroubles = () => {
    const updatedMachines = machines.map(m => {
      if (m.id === selectedMachineId) {
        return {
          ...m,
          troubleshooting: editingTroublesList.filter(t => t.issue.trim() !== '' || t.solution.trim() !== '')
        };
      }
      return m;
    });
    setMachines(updatedMachines);
    localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
    setIsEditingTroubles(false);
  };

  const resetTroublesToDefault = () => {
    if (window.confirm('Voulez-vous vraiment restaurer les pannes et solutions d\'usine pour cette machine ?')) {
      const originalMachine = PACKAGING_MACHINES.find(m => m.id === selectedMachineId);
      if (originalMachine) {
        const updatedMachines = machines.map(m => {
          if (m.id === selectedMachineId) {
            return {
              ...m,
              troubleshooting: originalMachine.troubleshooting.map(t => ({ ...t }))
            };
          }
          return m;
        });
        setMachines(updatedMachines);
        localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
        setEditingTroublesList(originalMachine.troubleshooting.map(t => ({ ...t })));
        setIsEditingTroubles(false);
      }
    }
  };

  // Machine drawing/photo setup handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const updatedMachines = machines.map(m => {
          if (m.id === selectedMachineId) {
            if (m.containerImages && m.containerImages.length > 0) {
              const updatedContainers = m.containerImages.map(img => {
                if (img.id === activeContainerId) {
                  return { ...img, imageUrl: base64String };
                }
                return img;
              });
              return { ...m, containerImages: updatedContainers };
            } else {
              return { ...m, imageUrl: base64String };
            }
          }
          return m;
        });
        setMachines(updatedMachines);
        localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = async (base64String: string) => {
    if (!cameraActiveTarget) return;
    const { type, id, slotIndex } = cameraActiveTarget;
    
    if (type === 'machine') {
      const updatedMachines = machines.map(m => {
        if (m.id === selectedMachineId) {
          if (m.containerImages && m.containerImages.length > 0) {
            const updatedContainers = m.containerImages.map(img => {
              if (img.id === activeContainerId) {
                return { ...img, imageUrl: base64String };
              }
              return img;
            });
            return { ...m, containerImages: updatedContainers };
          } else {
            return { ...m, imageUrl: base64String };
          }
        }
        return m;
      });
      setMachines(updatedMachines);
      localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
    }
    
    else if (type === 'supply' && id) {
      const updatedMachines = machines.map(m => {
        if (m.id === selectedMachineId) {
          const updatedSupplies = (m.supplies || []).map(sup => {
            if (sup.id === id) {
              return { ...sup, imageUrl: base64String };
            }
            return sup;
          });
          return { ...m, supplies: updatedSupplies };
        }
        return m;
      });
      setMachines(updatedMachines);
      localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
    }
    
    else if (type === 'recap' && slotIndex !== undefined) {
      setIsCompressing(true);
      try {
        const compressed = await compressImage(base64String, 1000, 1000, 0.7);
        const currentForDate = productionRecaps[selectedDateStr] || { dateStr: selectedDateStr, notes: '', photos: [null, null, null] };
        const nextPhotos = [...currentForDate.photos];
        nextPhotos[slotIndex] = compressed;
        saveProductionRecap(selectedDateStr, { photos: nextPhotos });
      } catch (err) {
        console.error("Camera image compression error:", err);
      } finally {
        setIsCompressing(false);
      }
    }
    
    setCameraActiveTarget(null);
  };

  const handleResetImage = () => {
    if (window.confirm('Voulez-vous restaurer l\'image ou le schéma d\'usine pour cette configuration ?')) {
      const originalMachine = PACKAGING_MACHINES.find(m => m.id === selectedMachineId);
      const updatedMachines = machines.map(m => {
        if (m.id === selectedMachineId) {
          if (m.containerImages && m.containerImages.length > 0) {
            const originalContainer = originalMachine?.containerImages?.find(img => img.id === activeContainerId);
            const updatedContainers = m.containerImages.map(img => {
              if (img.id === activeContainerId) {
                return { ...img, imageUrl: originalContainer ? originalContainer.imageUrl : undefined };
              }
              return img;
            });
            return { ...m, containerImages: updatedContainers };
          } else {
            return { ...m, imageUrl: originalMachine ? originalMachine.imageUrl : undefined };
          }
        }
        return m;
      });
      setMachines(updatedMachines);
      localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
    }
  };

  const handleDeleteMachineImage = () => {
    const updatedMachines = machines.map(m => {
        if (m.id === selectedMachineId) {
          if (m.containerImages && m.containerImages.length > 0) {
            const updatedContainers = m.containerImages.map(img => {
              if (img.id === activeContainerId) {
                return { ...img, imageUrl: undefined };
              }
              return img;
            });
            return { ...m, containerImages: updatedContainers };
          } else {
            return { ...m, imageUrl: undefined };
          }
        }
        return m;
      });
      setMachines(updatedMachines);
      localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
  };

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabLabel, setEditingTabLabel] = useState<string>('');

  const saveTabLabel = (machineId: string, containerId: string, newLabel: string) => {
    if (!newLabel.trim()) return;
    const updatedMachines = machines.map(m => {
      if (m.id === machineId) {
        const updatedContainers = m.containerImages?.map(img => {
          if (img.id === containerId) {
            return { ...img, label: newLabel.trim() };
          }
          return img;
        }) || [];
        return { ...m, containerImages: updatedContainers };
      }
      return m;
    });
    setMachines(updatedMachines);
    localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
    setEditingTabId(null);
  };

  const handleSupplyImageUpload = (supplyId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    return;
  };

  const updateSupplyItem = (supplyId: string, field: 'name' | 'observation' | 'description', value: string) => {
    const updatedMachines = machines.map(m => {
      if (m.id === selectedMachineId) {
        const updatedSupplies = (m.supplies || []).map(sup => {
          if (sup.id === supplyId) {
            return { ...sup, [field]: value };
          }
          return sup;
        });
        return { ...m, supplies: updatedSupplies };
      }
      return m;
    });
    setMachines(updatedMachines);
    localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
  };

  const addSupplyItem = () => {
    const newSupplyId = 'sup_' + Date.now();
    const updatedMachines = machines.map(m => {
      if (m.id === selectedMachineId) {
        const currentSupplies = m.supplies || [];
        const updatedSupplies = [
          ...currentSupplies,
          { id: newSupplyId, name: 'Nouvelle Fourniture', description: 'Renseigner un descriptif...', observation: 'Renseigner une observation...' }
        ];
        return { ...m, supplies: updatedSupplies };
      }
      return m;
    });
    setMachines(updatedMachines);
    localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
  };

  const deleteSupplyItem = (supplyId: string) => {
    const updatedMachines = machines.map(m => {
      if (m.id === selectedMachineId) {
        const currentSupplies = m.supplies || [];
        const updatedSupplies = currentSupplies.filter(sup => sup.id !== supplyId);
        return { ...m, supplies: updatedSupplies };
      }
      return m;
    });
    setMachines(updatedMachines);
    localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
  };

  const resetSuppliesToDefault = () => {
    const originalMachine = PACKAGING_MACHINES.find(m => m.id === selectedMachineId);
    if (originalMachine) {
      const updatedMachines = machines.map(m => {
        if (m.id === selectedMachineId) {
          return { ...m, supplies: originalMachine.supplies ? originalMachine.supplies.map(s => ({ ...s })) : [] };
        }
        return m;
      });
      setMachines(updatedMachines);
      localStorage.setItem('bottle_machines_custom', JSON.stringify(updatedMachines));
    }
  };

  const selectedMachine = machines.find(m => m.id === selectedMachineId) || machines[0];

  // Map generic icon strings to Lucide Components
  const getMachineIcon = (iconName: string, className: string = "w-5 h-5") => {
    switch (iconName) {
      case 'Wind': return <Wind className={className} />;
      case 'Droplet': return <Droplet className={className} />;
      case 'Tag': return <Tag className={className} />;
      case 'Package': return <Package className={className} />;
      case 'Layers': return <Layers className={className} />;
      default: return <Settings className={className} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased">
      {/* Lateral Sliding Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/40 z-40 backdrop-blur-xs"
            />
            {/* Drawer Container */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 left-0 w-80 bg-slate-900 text-white shadow-2xl z-50 flex flex-col border-r border-slate-800"
            >
              {/* Drawer App Brand Header */}
              <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                    <Droplet className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight text-white uppercase">Exploitation</h2>
                    <p className="text-[10px] font-semibold text-blue-400 font-mono tracking-wider">PILOTAGE RESEAU</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-all"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Links */}
              <div className="flex-1 py-6 px-4 flex flex-col gap-2 overflow-y-auto">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-3 mb-2">Navigation</span>
                
                {/* Link 2: Operating Procedures */}
                <button
                  onClick={() => {
                    setActiveTab('procedures');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    activeTab === 'procedures'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 font-bold'
                      : 'text-slate-400 hover:bg-slate-850 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Modes Opératoires Machines</span>
                  <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold font-mono">
                    {machines.length}
                  </span>
                </button>

                {/* Link 3: Pilote (New!) */}
                <button
                  onClick={() => {
                    setActiveTab('pilote');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    activeTab === 'pilote'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 font-bold'
                      : 'text-slate-400 hover:bg-slate-850 hover:text-white'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Pilote Production (Calendrier)</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-550/15 text-emerald-400 border border-emerald-500/20">
                      Nouveau
                    </span>
                    {Object.keys(productionRecaps).length > 0 && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-blue-500/25 text-blue-400 rounded-full">
                        {Object.keys(productionRecaps).filter(k => {
                          const r = productionRecaps[k];
                          return r && (r.notes?.trim() || r.photos?.some(p => p !== null));
                        }).length}
                      </span>
                    )}
                  </span>
                </button>

                {/* Technical stats container inside drawer */}
                <div className="mt-8 pt-8 border-t border-slate-800 flex flex-col gap-4">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-3">Statut Système</span>
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-2.5 font-mono text-[10px] text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Poste Actif:</span>
                      <span className="text-white font-semibold">Embouteillage</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Données Locales:</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Autonome PWA
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Date Sélectionnée:</span>
                      <span className="text-white font-semibold">{selectedDateStr}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer Information */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/30 text-center text-[10px] text-slate-500 font-mono">
                Code Pilote v1.4 • Hors-ligne actif
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Top Professional Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs px-4 sm:px-6 py-3.5 sm:py-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-2.5 sm:space-x-3 w-full md:w-auto">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 -ml-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 cursor-pointer transition-all flex items-center justify-center shrink-0"
              title="Ouvrir le menu latéral"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-100 shrink-0">
              <Droplet className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current text-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-slate-900 truncate">
                Pilote et mode opératoire
              </h1>
              <p className="text-[10.5px] sm:text-xs text-slate-500 font-medium truncate">
                Pilote et mode opératoire
              </p>
            </div>
          </div>
          

        </div>
      </header>

      {/* Main Container */}
      <AnimatePresence mode="wait">
        {activeTab === 'calculator' ? (
          <motion.div
            key="calculator-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
                 className="flex-1 bg-slate-50/50"
          >
            <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-9 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
              
              {/* Left Side: Parameters Form (7 columns on lg) */}
              <div className="lg:col-span-7 flex flex-col gap-6 sm:gap-8">
                
                {/* STEP 1: Format Selection */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-100/80 text-blue-700 font-bold text-xs rounded-lg uppercase tracking-wider font-mono">01</span>
                      <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Type de Conditionnement</h2>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowRefEdit(!showRefEdit)}
                        className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer select-none ${
                          showRefEdit 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/10' 
                            : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50/50'
                        }`}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        ⚙️ Référentiel
                      </button>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono bg-slate-100 px-2.5 py-1 rounded">Référentiel Interne</span>
                    </div>
                  </div>

                  <AnimatePresence>
                    {showRefEdit && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-5"
                      >
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-4 shadow-3xs">
                          <div className="flex justify-between items-center border-b border-rose-100/60 pb-2">
                            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-widest flex items-center gap-1">
                              🛠️ Édition des Valeurs de Référence
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setConveyor75(3400);
                                setConveyor33(5200);
                                setPallet75(600);
                                setPallet33(1200);
                                setConveyorCustom(0);
                                setPalletCustom(1000);
                                // Sync if currently selected
                                if (formatId === '75cl') setCustomConveyor(3400);
                                if (formatId === '33cl') setCustomConveyor(5200);
                              }}
                              className="text-[10.5px] font-bold text-slate-500 hover:text-blue-600 underline cursor-pointer select-none transition-colors"
                            >
                              Réinitialiser valeurs d'usine
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Format 75 cl Configuration */}
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs flex flex-col gap-3">
                              <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider block border-b border-slate-100 pb-1.5">
                                Format 75 cl
                              </span>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10.5px] font-bold text-slate-500">Volume Transit (b.)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={conveyor75 === 0 ? '' : conveyor75.toLocaleString('fr-FR')}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\s/g, '');
                                    const v = parseInt(raw, 10);
                                    const val = isNaN(v) || v < 0 ? 0 : v;
                                    setConveyor75(val);
                                    if (formatId === '75cl') {
                                      setCustomConveyor(val);
                                    }
                                  }}
                                  className="font-mono text-xs bg-slate-50 border border-slate-250 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 text-center font-bold"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10.5px] font-bold text-slate-500">Palette par Défaut (b.)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={pallet75 === 0 ? '' : pallet75.toLocaleString('fr-FR')}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\s/g, '');
                                    const v = parseInt(raw, 10);
                                    setPallet75(isNaN(v) || v < 0 ? 0 : v);
                                  }}
                                  className="font-mono text-xs bg-slate-50 border border-slate-250 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 text-center font-bold"
                                />
                              </div>
                            </div>

                            {/* Format 33 cl Configuration */}
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs flex flex-col gap-3">
                              <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider block border-b border-slate-100 pb-1.5">
                                Format 33 cl
                              </span>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10.5px] font-bold text-slate-500">Volume Transit (b.)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={conveyor33 === 0 ? '' : conveyor33.toLocaleString('fr-FR')}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\s/g, '');
                                    const v = parseInt(raw, 10);
                                    const val = isNaN(v) || v < 0 ? 0 : v;
                                    setConveyor33(val);
                                    if (formatId === '33cl') {
                                      setCustomConveyor(val);
                                    }
                                  }}
                                  className="font-mono text-xs bg-slate-50 border border-slate-250 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 text-center font-bold"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10.5px] font-bold text-slate-500">Palette par Défaut (b.)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={pallet33 === 0 ? '' : pallet33.toLocaleString('fr-FR')}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\s/g, '');
                                    const v = parseInt(raw, 10);
                                    setPallet33(isNaN(v) || v < 0 ? 0 : v);
                                  }}
                                  className="font-mono text-xs bg-slate-50 border border-slate-250 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 text-center font-bold"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {currentFormats.map((fmt) => {
                      const isSelected = formatId === fmt.id;
                      return (
                        <button
                          key={fmt.id}
                          id={`format-btn-${fmt.id}`}
                          onClick={() => handleFormatChange(fmt.id)}
                          type="button"
                          className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[145px] select-none ${
                            isSelected 
                              ? 'border-blue-600 bg-blue-50/55 text-blue-950 shadow-sm ring-4 ring-blue-500/5' 
                              : fmt.id === '75cl' ? 'bg-indigo-50 border-indigo-300 text-indigo-900 hover:bg-indigo-100' :
                                fmt.id === '33cl' ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100' :
                                'border-slate-100 bg-slate-50/40 hover:border-slate-350 hover:bg-white text-slate-700 hover:shadow-xs'
                          }`}
                        >
                          {/* Card Content Top */}
                          <div className="w-full">
                            <div className="flex items-center justify-between mb-2">
                              {/* Sleek icon indicator or silhouette */}
                              <div className={`p-1.5 rounded-lg transition-transform duration-200 group-hover:scale-105 ${
                                isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200/80 text-slate-500'
                              }`}>
                                {fmt.id === '75cl' ? (
                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                    <div className="w-2.5 h-4 rounded-sm border border-current" />
                                  </div>
                                ) : fmt.id === '33cl' ? (
                                  <div className="flex flex-col items-center justify-center">
                                    <div className="w-1 h-1 rounded-full bg-current" />
                                    <div className="w-3 h-3 rounded-sm border border-current" />
                                  </div>
                                ) : (
                                  <Settings className="w-3.5 h-3.5" />
                                )}
                              </div>

                              {/* Small status light */}
                              {isSelected ? (
                                <span className="flex h-2 w-2 relative">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                                </span>
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              )}
                            </div>

                            <span className="text-[11px] font-bold tracking-tight block text-slate-500 group-hover:text-slate-800 transition-colors uppercase font-sans">
                              {fmt.id === 'custom' ? 'Spécifique' : fmt.label.replace('Format ', '')}
                            </span>
                          </div>

                          {/* Card Content Bottom */}
                          <div className="mt-4 pt-2 border-t border-slate-200/50 w-full flex flex-col gap-0.5">
                            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                              <span>TRANSIT:</span>
                              <span className={`font-mono font-bold ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                                {fmt.id === 'custom' ? 'Variable' : `${fmt.conveyorDefault.toLocaleString('fr-FR')} b.`}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                              <span>PALETTE:</span>
                              <span className={`font-mono font-bold ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                                {fmt.palletDefaultSize ? `${fmt.palletDefaultSize.toLocaleString('fr-FR')} b.` : 'Variable'}
                              </span>
                            </div>
                            <div className="text-[15px] font-extrabold font-mono tracking-tight text-slate-900 mt-1">
                              {fmt.id === 'custom' ? 'Custom' : fmt.volume}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* STEP 2: Main quantities inputs */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs flex flex-col gap-6">
                  
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 bg-blue-100/80 text-blue-700 font-bold text-xs rounded-lg uppercase tracking-wider font-mono">02</span>
                    <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Mesures Physiques & Paramètres</h2>
                  </div>

                  {/* Input 1: Target (Quantité à faire) */}
                  <div className="p-4 sm:p-5 bg-slate-50/50 rounded-2xl border-2 border-slate-100 flex flex-col gap-2.5 transition-colors hover:border-slate-200">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded bg-blue-600" />
                        <label className="text-[11.5px] font-bold text-slate-600 uppercase tracking-wider">
                          Consigne Cible de l'OF (Volume Requis)
                        </label>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        b.
                      </span>
                    </div>
                    
                    <input
                      type="text"
                      inputMode="numeric"
                      id="target-quantity-input"
                      value={targetQuantity === 0 ? '' : targetQuantity.toLocaleString('fr-FR')}
                      onChange={(e) => handleNumberInput(e.target.value, setTargetQuantity)}
                      className="w-full text-center font-mono text-xl sm:text-2xl font-black bg-white text-slate-900 border-2 border-slate-250 rounded-xl p-2.5 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-2xs"
                      placeholder="Saisir la cible..."
                    />
                  </div>

                  {/* Input 2: Conveyor (Quantité sur convoyeur) */}
                  <div className="p-4 sm:p-5 bg-slate-50/50 rounded-2xl border-2 border-slate-100 flex flex-col gap-2.5 transition-colors hover:border-slate-200">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded bg-orange-500" />
                        <span className="text-[11.5px] font-bold text-slate-600 uppercase tracking-wider">
                          Contenance du Convoyeur
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        b.
                      </span>
                    </div>

                    {formatId === 'custom' ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        id="conveyor-input"
                        value={customConveyor === 0 ? '' : customConveyor.toLocaleString('fr-FR')}
                        onChange={(e) => handleNumberInput(e.target.value, setCustomConveyor)}
                        className="w-full text-center font-mono text-xl sm:text-2xl font-black bg-white text-slate-900 border-2 border-slate-250 rounded-xl p-2.5 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-2xs"
                        placeholder="Transit convoyeur..."
                      />
                    ) : (
                      <div className="w-full text-center font-mono text-xl sm:text-2xl font-black bg-slate-100/50 text-slate-500 border-2 border-slate-200 rounded-xl p-2.5 select-none" title="Valeur fixe réglementaire pour ce format">
                        {conveyorQuantity.toLocaleString('fr-FR')}
                      </div>
                    )}
                  </div>

                  {/* Input 3: Palletizer (Quantité dans le palettiseur) */}
                  <div className="p-4 sm:p-5 bg-slate-50/50 rounded-2xl border-2 border-slate-100 flex flex-col gap-2.5 transition-colors hover:border-slate-200">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded bg-pink-500" />
                        <label className="text-[11.5px] font-bold text-slate-600 uppercase tracking-wide">
                          Dans le palettiseur (Soustrait)
                        </label>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        b.
                      </span>
                    </div>

                    {bottleFactor > 0 ? (
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {/* Saisie Bouteilles */}
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="palletizer-input" className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">
                              Quantité Bouteilles (b.)
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              id="palletizer-input"
                              value={palletizerQuantity === 0 ? '' : palletizerQuantity.toLocaleString('fr-FR')}
                              onChange={(e) => handleNumberInput(e.target.value, setPalletizerQuantity)}
                              className="w-full text-center font-mono text-lg font-black bg-white text-slate-900 border-2 border-slate-250 rounded-xl p-2.5 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-3xs transition-all"
                              placeholder="Bouteilles..."
                            />
                          </div>

                          {/* Saisie Cartons */}
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="palletizer-cartons-input" className="text-[10px] font-extrabold text-pink-600 uppercase tracking-widest block">
                              📦 Saisie Cartons (ct.)
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="numeric"
                                id="palletizer-cartons-input"
                                value={currentCartons === 0 ? '' : currentCartons.toLocaleString('fr-FR')}
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value.replace(/\s/g, ''), 10);
                                  const cartons = isNaN(parsed) || parsed < 0 ? 0 : parsed;
                                  setPalletizerQuantity(cartons * bottleFactor);
                                }}
                                className="w-full text-center font-mono text-lg font-black bg-white text-pink-750 border-2 border-pink-250 rounded-xl p-2.5 focus:border-pink-500 focus:outline-none focus:ring-4 focus:ring-pink-500/5 shadow-3xs transition-all"
                                placeholder={`${bottleFactor} b. / carton`}
                              />
                              {palletizerQuantity % bottleFactor > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" title={`Reste de ${palletizerQuantity % bottleFactor} bouteilles non emballées`}></span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {(() => {
                          const calc = getCartonsAndRemainder(palletizerQuantity);
                          if (!calc) return null;
                          return (
                            <div className="flex justify-between items-center bg-pink-50/70 border border-pink-150 rounded-xl px-3 py-1.5 mt-0.5 select-none text-[11px]">
                              <span className="font-bold text-pink-700 uppercase tracking-wider">
                                Résultat de Palettisation ({calc.bottlePerCarton} b./ct)
                              </span>
                              <span className="font-mono font-black text-pink-900 bg-white shadow-3xs border border-pink-200 px-2 py-0.5 rounded-lg">
                                {getCartonText(palletizerQuantity)}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        id="palletizer-input"
                        value={palletizerQuantity === 0 ? '' : palletizerQuantity.toLocaleString('fr-FR')}
                        onChange={(e) => handleNumberInput(e.target.value, setPalletizerQuantity)}
                        className="w-full text-center font-mono text-xl sm:text-2xl font-black bg-white text-slate-900 border-2 border-slate-250 rounded-xl p-2.5 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-2xs"
                        placeholder="Bouteilles restantes..."
                      />
                    )}
                  </div>

                  {/* Customization & Advanced Settings Toggle */}
                  <div className="border-t border-slate-150/65 pt-4">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-xs text-blue-600 font-bold hover:text-blue-800 inline-flex items-center gap-1.5 cursor-pointer hover:underline transition-colors select-none"
                    >
                      <Settings className={`w-3.5 h-3.5 transition-transform duration-300 ${showAdvanced ? 'rotate-90' : ''}`} />
                      {showAdvanced ? "Masquer la configuration de palette" : "Configurer la taille de palette (Avancé)"}
                    </button>

                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-3"
                        >
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-3">
                            {/* Palette Size configuration */}
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                                Capacité Palette (bouteilles par palette complète)
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={customPalletSize === 0 ? '' : customPalletSize}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    setCustomPalletSize(isNaN(v) || v < 0 ? 0 : v);
                                  }}
                                  className="w-full font-mono text-sm bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                                  placeholder={`Actuel par défaut : ${selectedFormat.palletDefaultSize} bouteilles`}
                                />
                                {customPalletSize > 0 && (
                                  <button
                                    onClick={() => setCustomPalletSize(0)}
                                    className="text-xs font-bold text-red-500 hover:text-red-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-red-50 transition-colors"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1.5 font-medium leading-relaxed">
                                Modifie le diviseur utilisé pour estimer l'équivalent palettes du rapport d'embouteillage.
                              </p>
                            </div>
                            
                            {/* Line speed configuration */}
                            <div className="mt-4 border-t border-slate-200 pt-4">
                              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                                Vitesse de la ligne (bouteilles par heure)
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={bottlesPerHour === 0 ? '' : bottlesPerHour}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  setBottlesPerHour(isNaN(v) || v < 0 ? 0 : v);
                                }}
                                className="w-full font-mono text-sm bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                                placeholder="3000"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Save Trigger Button */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={saveCalculation}
                    className="w-full py-4 px-6 bg-slate-900 border border-slate-800 hover:bg-slate-850 active:scale-[0.99] text-white rounded-2xl font-bold tracking-wide shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2 text-sm cursor-pointer group"
                  >
                    <History className="w-4 h-4 transition-transform group-hover:rotate-12 text-blue-400" />
                    Enregistrer dans l'historique d'exploitation
                  </button>
                  <p className="text-[11px] text-center text-slate-400 font-medium">
                    Conserve localement chaque calcul pour l'insérer d'un simple clic.
                  </p>
                </div>

              </div>

              {/* Right Side: Visual Result Display (5 columns on lg) */}
              <div className="lg:col-span-5 flex flex-col gap-6 sm:gap-8">
                
                {/* Main Calculation Card (Sleek telemetry OLED display) */}
                <div className="bg-[#0c1424] text-white rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[500px] border border-blue-950 ring-1 ring-slate-850">
                  {/* Grid overlay for tech look */}
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse at center, #3b82f6 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                  
                  {/* Background glowing droplet accent */}
                  <div className="absolute right-[-40px] bottom-[-40px] opacity-[0.04] text-blue-400 select-none pointer-events-none">
                    <Droplet className="w-64 h-64" />
                  </div>

                  {/* Header / Subhead */}
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8] bg-slate-900/90 px-3 py-1 rounded-lg border border-slate-800">
                        MONITEUR DE RELÈVE
                      </span>
                      <span className="text-[11px] font-mono font-extrabold text-blue-400 bg-blue-950/45 px-2.5 py-0.5 rounded border border-blue-900/30">
                        {selectedFormat.volume.toUpperCase()}
                      </span>
                    </div>

                    {/* Core subtraction formula breakdown visually */}
                    <div className="space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-850 backdrop-blur-xs">
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded bg-blue-500 shadow-sm" />
                          <span>Quantité Cible (C)</span>
                        </span>
                        <span className="font-mono text-white text-xs sm:text-sm font-bold bg-slate-950 px-2.5 py-0.5 rounded border border-slate-850">{targetQuantity.toLocaleString('fr-FR')}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded bg-orange-400 shadow-sm" />
                          <span>Sur Convoyeur (Cv)</span>
                        </span>
                        <span className="font-mono text-orange-400 text-xs sm:text-sm font-bold bg-slate-950 px-2.5 py-0.5 rounded border border-slate-850">-{conveyorQuantity.toLocaleString('fr-FR')}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded bg-pink-400 shadow-sm" />
                          <span>En Palettisation (P)</span>
                          {getCartonsAndRemainder(palletizerQuantity) && (
                            <span className="text-[10px] text-pink-400 font-mono font-bold bg-pink-500/10 px-1.5 py-0.5 rounded border border-pink-500/20">
                              {getCartonText(palletizerQuantity)}
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-pink-400 text-xs sm:text-sm font-bold bg-slate-950 px-2.5 py-0.5 rounded border border-slate-850">-{palletizerQuantity.toLocaleString('fr-FR')}</span>
                      </div>

                      <div className="h-px bg-slate-850 my-1" />

                      <div className="flex justify-between items-center text-xs text-slate-400 pt-0.5">
                        <span className="font-medium">Conditionnement intermédiaire (Cv + P)</span>
                        <span className="font-mono text-slate-200 bg-slate-950/60 px-2 py-0.5 rounded font-extrabold">{totalSubtracted.toLocaleString('fr-FR')} b.</span>
                      </div>
                    </div>
                  </div>

                  {/* Output Display Large Number with glowing vibe */}
                  <div className="my-6 relative z-10 flex flex-col items-center">
                    <p className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-widest text-center mb-1 font-mono">
                      VOLUME GLOBAL NET À LANCER
                    </p>
                    
                    <div className="flex flex-col items-center justify-center">
                      <motion.div
                        key={quantityToProduce}
                        initial={{ scale: 0.95, opacity: 0.8 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center"
                      >
                        <div className={`text-5xl sm:text-6xl font-mono font-black tracking-tighter select-all ${
                          targetCompleted 
                            ? 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400' 
                            : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400'
                        }`} style={{ textShadow: '0 0 25px rgba(59,130,246,0.12)' }}>
                          {quantityToProduce.toLocaleString('fr-FR')}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 lowercase tracking-wider block mt-1 uppercase font-mono">bouteilles d'eau nettes</span>
                      </motion.div>
                      
                      {targetCompleted ? (
                        <motion.div 
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-1.5 text-xs inline-flex items-center gap-1.5 font-bold"
                        >
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          Consigne complétée ! Stock OK
                        </motion.div>
                      ) : (
                        <div className="mt-4 text-[#94a3b8] text-[11px] block leading-relaxed text-center px-4 max-w-sm font-medium">
                          Produire <span className="font-mono text-white font-bold">{quantityToProduce.toLocaleString('fr-FR')}</span> bouteilles supplémentaires pour clôturer l'objectif.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Operational Stats: Estimations & Progress indicators */}
                  <div className="pt-4 border-t border-slate-850 relative z-10 space-y-4 bg-slate-900/40 p-3 sm:p-4 rounded-2xl border border-slate-850">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] font-mono">
                        <Layers3 className="w-4 h-4 text-slate-500" />
                        <span>Indicateurs de progression</span>
                      </span>
                      <span className="text-[11px] font-bold font-mono text-white bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                        Cible : {estimatedPalletsNeeded} Palettes
                      </span>
                    </div>
                    
                    {/* Progress loops deck (3 parallel indicators) */}
                    <div className="grid grid-cols-3 gap-2">
                      <CircularProgressRing
                        percent={Math.min(100, (totalSubtracted / Math.max(1, targetQuantity)) * 100)}
                        colorClass={targetCompleted ? "stroke-emerald-400" : "stroke-blue-400"}
                        label="Acquis global"
                        sublabel={`${totalSubtracted.toLocaleString('fr-FR')} b.`}
                      />
                      <CircularProgressRing
                        percent={Math.min(100, (conveyorQuantity / Math.max(1, targetQuantity)) * 100)}
                        colorClass="stroke-orange-400"
                        label="Convoyeur"
                        sublabel={`${conveyorQuantity.toLocaleString('fr-FR')} b.`}
                      />
                      <CircularProgressRing
                        percent={Math.min(100, (palletizerQuantity / Math.max(1, targetQuantity)) * 100)}
                        colorClass="stroke-pink-400"
                        label="Palettiseur"
                        sublabel={
                          <div className="flex flex-col items-center">
                            <span>{palletizerQuantity.toLocaleString('fr-FR')} b.</span>
                            {getCartonsAndRemainder(palletizerQuantity) && (
                              <span className="text-[9px] font-bold text-pink-400 block mt-0.5 whitespace-nowrap bg-pink-500/10 px-1 border border-pink-500/20 rounded">
                                {getCartonText(palletizerQuantity)}
                              </span>
                            )}
                          </div>
                        }
                      />
                    </div>

                    {/* Breakdown of complete pallets vs remainder */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-slate-850/60 pt-3">
                      <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-850">
                        <span className="text-slate-500 block mb-0.5">PALETTES RESTANTES</span>
                        <span className="text-white font-extrabold">{Math.floor(quantityToProduce / bottlesPerPallet)} unité(s)</span>
                      </div>
                      <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-850">
                        <span className="text-slate-500 block mb-0.5">TEMPS RESTANT (EST.)</span>
                        <span className="text-white font-extrabold">
                          {bottlesPerHour > 0 
                            ? `${(quantityToProduce / bottlesPerHour).toFixed(1)} h` 
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Proportion totale déduite : {((totalSubtracted / Math.max(1, targetQuantity)) * 100).toFixed(1)}%</span>
                      <span>Lot palette : {bottlesPerPallet} b.</span>
                    </div>
                  </div>

                </div>

                {/* Quick Informational Tips as beautiful industrial drafting sheet */}
                <div className="bg-gradient-to-tr from-slate-100 to-slate-50 rounded-3xl p-5 border border-slate-205/60 shadow-3xs relative overflow-hidden">
                  <div className="absolute right-[-10px] top-[-10px] opacity-[0.03]">
                    <Settings className="w-24 h-24 rotate-12" />
                  </div>
                  
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 inline-flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>Aide-Mémoire Procédural</span>
                  </h3>
                  
                  <p className="text-xs text-slate-600 leading-relaxed font-sans space-y-1 bg-white border border-slate-200/80 p-3 sm:p-3.5 rounded-xl">
                    <span className="block text-slate-500 mb-1">Formulation du calcul de relève à valider lors du changement de poste :</span>
                    <strong className="font-mono text-xs text-slate-800 block text-center py-1.5 bg-slate-50 border border-slate-150 rounded-md">
                      Production Nette = Cible OF - (Transit Convoyeur + Transit Palettiseur)
                    </strong>
                    <span className="block pt-1 text-[11px] text-slate-500">
                      Les volumes résiduels des convoyeurs sont calibrés automatiquement sur la base réglementaire du format en cours (soit <strong>75cl à 3400 b.</strong> et <strong>33cl à 5200 b.</strong>).
                    </span>
                  </p>
                </div>

              </div>

            </main>

            {/* History table list section */}
            <section className="bg-slate-100 border-t border-slate-200 py-8 px-4 sm:px-6">
              <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-2">
                    <History className="text-slate-700 w-5 h-5" />
                    <h2 className="text-base font-bold text-slate-900">
                      Historique des Calculations Récentes
                    </h2>
                    <span className="text-xs text-slate-500 bg-slate-200 px-2.5 py-0.5 rounded-full font-semibold font-mono">
                      {history.length}
                    </span>
                  </div>
                  
                  {history.length > 0 && (
                    <button
                      onClick={clearAllHistory}
                      className="text-xs text-red-650 hover:text-red-800 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Effacer tout l'historique
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="bg-white border border-dashed border-slate-350 rounded-xl p-8 text-center text-slate-500">
                    <ClipboardIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium">Aucun calcul n'a encore été enregistré.</p>
                    <p className="text-xs text-slate-400 mt-1">Saisissez des données et cliquez sur "Enregistrer" pour garder une trace d'embouteillage.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                          <th className="py-3 px-4 animate-fade-in">Heure</th>
                          <th className="py-3 px-4">Format</th>
                          <th className="py-3 px-4">Cible</th>
                          <th className="py-3 px-4" title="Convoyeurs">Convoyeur</th>
                          <th className="py-3 px-4" title="Palettiseur">Palettiseur</th>
                          <th className="py-3 px-4 font-bold text-slate-900 bg-blue-50/30">Production Nette</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                        <AnimatePresence initial={false}>
                          {history.map((log) => {
                            const isComplete = log.result.isCompleted;
                            return (
                              <motion.tr
                                key={log.id}
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onClick={() => loadFromLog(log)}
                                className="hover:bg-slate-50 cursor-pointer transition-colors group text-[12.5px]"
                                title="Cliquez pour restaurer ces paramètres dans le calculateur"
                              >
                                <td className="py-3.5 px-4 text-slate-500 text-xs font-medium flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  {log.timestamp}
                                </td>
                                <td className="py-3.5 px-4 font-sans font-bold text-slate-900">
                                  {log.result.formatLabel}
                                </td>
                                <td className="py-3.5 px-4">
                                  {log.result.targetQuantity.toLocaleString('fr-FR')}
                                </td>
                                <td className="py-3.5 px-4 text-orange-600">
                                  -{log.result.conveyorQuantity.toLocaleString('fr-FR')}
                                </td>
                                <td className="py-3.5 px-4 text-pink-600">
                                  -{log.result.palletizerQuantity.toLocaleString('fr-FR')}
                                </td>
                                <td className={`py-3.5 px-4 font-bold bg-blue-50/5 ${isComplete ? 'text-emerald-600 font-black' : 'text-blue-600'}`}>
                                  {isComplete ? (
                                    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-emerald-55 text-emerald-800 font-semibold font-sans">
                                      Complété (0)
                                    </span>
                                  ) : (
                                    `${log.result.quantityToProduce.toLocaleString('fr-FR')} b.`
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex justify-end items-center gap-2">
                                    <button
                                      onClick={() => loadFromLog(log)}
                                      className="text-[10px] text-blue-600 hover:underline font-sans cursor-pointer bg-slate-100 hover:bg-slate-200 py-1 px-2 rounded font-semibold"
                                    >
                                      Charger
                                    </button>
                                    <button
                                      onClick={(e) => deleteHistoryItem(log.id, e)}
                                      className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded cursor-pointer transition-colors"
                                      title="Supprimer de l'historique"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </motion.div>
        ) : activeTab === 'procedures' ? (
          <motion.div
            key="procedures-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8"
          >
            {/* Split layout: Machine lists on Left, Selection details on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
              
              {/* Left sidebar: list of machines */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 block m-0">
                      Machines (* {machines.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsAddingMachine(!isAddingMachine)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                        isAddingMachine 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white hover:bg-slate-50 text-blue-650 border-slate-200 shadow-3xs'
                      }`}
                      title="Ajouter une machine de conditionnement"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isAddingMachine && (
                    <div className="bg-blue-50/40 rounded-xl border-2 border-blue-200 p-3 mb-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">Nouvelle Machine</span>
                        <button 
                          type="button"
                          onClick={() => setIsAddingMachine(false)}
                          className="text-[10px] text-slate-500 hover:text-slate-800 font-bold hover:underline cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                      
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nom de la machine *</label>
                          <input 
                            type="text" 
                            value={newMachName}
                            onChange={(e) => setNewMachName(e.target.value)}
                            placeholder="ex: Cartonneuse, Fardeleuse"
                            className="w-full text-xs border border-slate-250 rounded-lg px-2.5 py-1.5 focus:border-blue-500 outline-none bg-white font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Code</label>
                          <input 
                            type="text" 
                            value={newMachCode}
                            onChange={(e) => setNewMachCode(e.target.value)}
                            placeholder="ex: CART-404"
                            className="w-full text-xs font-mono border border-slate-250 rounded-lg px-2.5 py-1.5 focus:border-blue-500 outline-none bg-white font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Icône</label>
                          <div className="grid grid-cols-6 gap-1 bg-white p-1 border border-slate-200 rounded-lg">
                            {['Wind', 'Droplet', 'Tag', 'Package', 'Layers', 'Settings'].map(ic => {
                              const icSelected = newMachIcon === ic;
                              return (
                                <button
                                  type="button"
                                  key={ic}
                                  onClick={() => setNewMachIcon(ic)}
                                  className={`p-1 rounded transition-all cursor-pointer flex justify-center items-center ${
                                    icSelected 
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                      : 'bg-white hover:bg-slate-100 text-slate-500 border-transparent'
                                  }`}
                                  title={ic}
                                >
                                  {getMachineIcon(ic, "w-3.5 h-3.5")}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Couleur de la fenêtre</label>
                          <div className="flex gap-2 bg-white p-1 border border-slate-200 rounded-lg">
                            {['blue', 'sky', 'amber', 'emerald', 'purple'].map(col => {
                              const colSelected = newMachColor === col;
                              const bgClass = col === 'blue' ? 'bg-blue-600' : col === 'sky' ? 'bg-sky-600' : col === 'amber' ? 'bg-amber-600' : col === 'emerald' ? 'bg-emerald-600' : 'bg-purple-600';
                              return (
                                <button
                                  type="button"
                                  key={col}
                                  onClick={() => setNewMachColor(col)}
                                  className={`w-6 h-6 rounded-full transition-all cursor-pointer ${bgClass} ${colSelected ? 'ring-2 ring-offset-1 ring-slate-400' : 'opacity-50'}`}
                                  title={col}
                                />
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Description / Fonction</label>
                          <textarea 
                            value={newMachDesc}
                            onChange={(e) => setNewMachDesc(e.target.value)}
                            placeholder="Saisissez une description rapide..."
                            rows={2}
                            className="w-full text-xs border border-slate-250 rounded-lg px-2.5 py-1.5 focus:border-blue-500 outline-none bg-white font-medium resize-none"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCreateMachine}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm text-center"
                      >
                        Enregistrer
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 max-h-[450px] overflow-y-auto pr-1">
                    {machines.map((machine) => {
                      const isSelected = selectedMachineId === machine.id;
                      const completedCount = checkedSteps[machine.id]?.length || 0;
                      const machineSteps = (machine.id === selectedMachineId && machine.containerSteps && activeContainerId && machine.containerSteps[activeContainerId])
                        ? machine.containerSteps[activeContainerId]
                        : (machine.mainSteps || []);
                      const totalStepsCount = machineSteps.length;
                      const allDone = completedCount === totalStepsCount && totalStepsCount > 0;
                      
                      const colorStyles: Record<string, string> = {
                        blue: 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100',
                        sky: 'bg-sky-50 border-sky-300 text-sky-900 hover:bg-sky-100',
                        amber: 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100',
                        emerald: 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100',
                        purple: 'bg-purple-50 border-purple-300 text-purple-900 hover:bg-purple-100'
                      };

                      return (
                        <div
                          key={machine.id}
                          onClick={() => {
                            setSelectedMachineId(machine.id);
                            setIsEditingTroubles(false);
                            setActiveMachineSection('mop');
                            if (machine.containerImages && machine.containerImages.length > 0) {
                              setActiveContainerId(machine.containerImages[0].id);
                            }
                          }}
                          className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer group/item ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                              : (machine.color && colorStyles[machine.color]) ? colorStyles[machine.color] :
                                machine.id === 'remplisseuse' ? 'bg-sky-50 border-sky-300 text-sky-900 hover:bg-sky-100' :
                                machine.id === 'etiqueteuse' ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100' :
                                machine.id === 'varioline' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100' :
                                machine.id === 'palettiseur' ? 'bg-purple-50 border-purple-300 text-purple-900 hover:bg-purple-100' :
                                machine.id === 'souffleuse' ? 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100' :
                                'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`p-1.5 rounded-lg shrink-0 ${
                              isSelected ? 'bg-blue-500/50 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {getMachineIcon(machine.icon, 'w-4 h-4')}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-mono opacity-80 block leading-tight font-bold">
                                {machine.code}
                              </span>
                              <span className="text-xs font-bold block truncate">
                                {machine.name}
                              </span>
                            </div>
                          </div>

                          {/* Progress indicator & Delete Action */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {totalStepsCount > 0 ? (
                              <div className="flex flex-col items-end shrink-0 select-none">
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                                  isSelected 
                                    ? 'bg-blue-700/80 text-white font-black' 
                                    : allDone 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {completedCount}/{totalStepsCount}
                                </span>
                              </div>
                            ) : null}

                            <div className="flex flex-col">
                                <button onClick={(e) => { e.stopPropagation(); moveMachine(machine.id, -1); }} className="text-[8px] p-0.5 hover:bg-slate-200 rounded">▲</button>
                                <button onClick={(e) => { e.stopPropagation(); moveMachine(machine.id, 1); }} className="text-[8px] p-0.5 hover:bg-slate-200 rounded">▼</button>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete({
                                  isOpen: true,
                                  action: () => handleDeleteMachine(machine.id),
                                  title: "Supprimer la machine ?",
                                  message: "Cette action est irréversible. Êtes-vous sûr de vouloir supprimer cette machine ?"
                                });
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                setConfirmDelete({
                                  isOpen: true,
                                  action: () => handleDeleteMachine(machine.id),
                                  title: "Supprimer la machine ?",
                                  message: "Cette action est irréversible. Êtes-vous sûr de vouloir supprimer cette machine ?"
                                });
                              }}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${
                                isSelected 
                                  ? 'text-blue-200 hover:text-red-300 hover:bg-blue-700/50' 
                                  : 'text-slate-400 hover:text-red-650 hover:bg-red-50'
                              }`}
                              title="Supprimer la machine"
                            >
                              <Trash2 className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {machines.length === 0 && (
                      <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs bg-slate-50/50">
                        Aucune machine disponible.
                      </div>
                    )}
                  </div>
                </div>

                {/* Operator advice box removed */}
              </div>

              {/* Right side: selected machine procedurial fiches */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {!selectedMachine ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center py-16">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 animate-bounce">
                      <Settings className="w-8 h-8" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2 font-mono">Aucune machine disponible</h3>
                    <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
                      La liste des machines est vide. Utilisez le bouton "+" dans le panneau latéral de gauche pour ajouter votre première machine de conditionnement.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddingMachine(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer text-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Ajouter une machine</span>
                    </button>
                  </div>
                ) : isEditingSelectedMachine ? (
                  <div className="bg-white rounded-2xl border-2 border-blue-500 p-6 shadow-md flex flex-col gap-5">
                    <div className="flex items-center justify-between border-b border-slate-150 pb-3">
                      <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-600 animate-spin" style={{ animationDuration: '6s' }} />
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Paramètres de la machine : {selectedMachine.name}</h2>
                      </div>
                      <span className="text-[10px] text-blue-600 font-mono font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">Configuration</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nom de la machine *</label>
                        <input 
                          type="text" 
                          value={editMachName}
                          onChange={(e) => setEditMachName(e.target.value)}
                          className="w-full text-xs font-bold border border-slate-250 rounded-lg px-3 py-2 outline-none focus:border-blue-600 bg-white"
                          placeholder="Nom (e.g. Souffleuse, Cartonneuse)"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Code</label>
                        <input 
                          type="text" 
                          value={editMachCode}
                          onChange={(e) => setEditMachCode(e.target.value)}
                          className="w-full text-xs font-mono border border-slate-250 rounded-lg px-3 py-2 outline-none focus:border-blue-600 bg-white"
                          placeholder="Code (e.g. SBO-101)"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Icône de la machine</label>
                        <div className="grid grid-cols-6 gap-1 bg-slate-50 p-1 border border-slate-200 rounded-lg">
                          {['Wind', 'Droplet', 'Tag', 'Package', 'Layers', 'Settings'].map(ic => {
                            const isSel = editMachIcon === ic;
                            return (
                              <button
                                type="button"
                                key={ic}
                                onClick={() => setEditMachIcon(ic)}
                                className={`p-1.5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${
                                  isSel 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                    : 'bg-white hover:bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                                title={ic}
                              >
                                {getMachineIcon(ic, "w-4 h-4")}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-sans">Description / Rôle</label>
                        <textarea 
                          value={editMachDesc}
                          onChange={(e) => setEditMachDesc(e.target.value)}
                          rows={2}
                          className="w-full text-xs border border-slate-250 rounded-lg p-2 outline-none focus:border-blue-600 bg-white resize-none font-medium text-slate-750"
                          placeholder="Décrire le rôle de l'équipement..."
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Instructions de Préparation</label>
                          {selectedMachine.containerImages && selectedMachine.containerImages.length > 0 && activeContainerId && (
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-150 rounded px-1.5 py-0.5">
                                Format cible : {selectedMachine.containerImages.find(c => c.id === activeContainerId)?.label || activeContainerId}
                              </span>
                              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={!editForContainerFormat}
                                  onChange={(e) => {
                                    const nextVal = !e.target.checked;
                                    setEditForContainerFormat(nextVal);
                                    const steps = nextVal 
                                      ? (selectedMachine.containerSteps?.[activeContainerId] || selectedMachine.mainSteps || [])
                                      : (selectedMachine.mainSteps || []);
                                    setEditMachSteps(steps.map(s => ({ ...s })));
                                  }}
                                  className="rounded border-slate-350 text-blue-600 focus:ring-blue-500/10 w-3 h-3 cursor-pointer"
                                />
                                <span>Éditer plutôt les étapes générales</span>
                              </label>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditMachSteps([
                              ...editMachSteps,
                              { num: editMachSteps.length + 1, title: 'Nouvelle consigne d\'exploitation', description: 'Renseignez ici la consigne de préparation.' }
                            ]);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-3xs font-sans self-start sm:self-auto"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Ajouter une étape</span>
                        </button>
                      </div>
                      
                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                        {editMachSteps.map((step, idx) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex gap-3 items-start relative group">
                            <div className="bg-slate-200 text-slate-750 font-mono text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1">
                              {idx + 1}
                            </div>
                            <div className="flex-1 space-y-2">
                              <input 
                                type="text"
                                value={step.title}
                                onChange={(e) => {
                                  const updated = [...editMachSteps];
                                  updated[idx] = { ...step, title: e.target.value };
                                  setEditMachSteps(updated);
                                }}
                                className="w-full text-xs font-bold border border-slate-250 rounded-lg px-2.5 py-1 bg-white focus:border-blue-500 outline-none"
                                placeholder="Titre de la directive"
                              />
                              <textarea 
                                value={step.description}
                                onChange={(e) => {
                                  const updated = [...editMachSteps];
                                  updated[idx] = { ...step, description: e.target.value };
                                  setEditMachSteps(updated);
                                }}
                                rows={2}
                                className="w-full text-xs border border-slate-250 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-500 outline-none resize-none"
                                placeholder="Consigne d'exploitation..."
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = editMachSteps.filter((_, sidx) => sidx !== idx);
                                setEditMachSteps(updated);
                              }}
                              className="text-red-500 hover:text-red-750 p-1.5 rounded-lg hover:bg-red-50 mt-1 cursor-pointer transition-all shrink-0"
                              title="Retirer cette étape"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {editMachSteps.length === 0 && (
                          <div className="text-center py-6 border border-dashed border-slate-250 rounded-xl bg-slate-50/40 text-slate-400 text-xs font-semibold">
                            Aucune étape opérationnelle. Ajoutez des directives pour guider les opérateurs.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingSelectedMachine(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSelectedMachine}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md shadow-blue-100"
                      >
                        Sauvegarder les paramètres
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col gap-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                          {getMachineIcon(selectedMachine.icon, 'w-6 h-6')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-bold">
                              Code: {selectedMachine.code}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-400">
                              Machine de conditionnement
                            </span>
                          </div>
                          <h2 className="text-xl font-bold text-slate-900 mt-1">
                            Mode Opératoire : {selectedMachine.name}
                          </h2>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleExportStepsHTML}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-2xs shadow-indigo-100 hover:shadow-xs cursor-pointer"
                        title="Exporter les étapes de préparation sous forme de page HTML imprimable"
                      >
                        <Camera className="w-3.5 h-3.5 text-indigo-100" />
                        <span>Exporter HTML Étapes</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleStartEditingSelectedMachine}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 hover:text-slate-950 rounded-xl text-xs font-black cursor-pointer transition-colors flex items-center gap-1.5 shadow-3xs"
                      >
                        <Pencil className="w-3.5 h-3.5 text-blue-600" />
                        <span>Paramétrer la machine</span>
                      </button>
                    </div>

                  {/* Tabs Selector for Machine details */}
                  <div className="flex border-b border-slate-150 -mt-2 pb-1 gap-1 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveMachineSection('mop')}
                      className={`pb-2 px-3 sm:px-4 text-xs font-bold font-sans transition-all border-b-2 cursor-pointer flex items-center gap-1.5 sm:gap-2 ${
                        activeMachineSection === 'mop'
                          ? 'border-blue-600 text-blue-700 font-extrabold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Mode Opératoire & Diagnostic</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMachineSection('supplies')}
                      className={`pb-2 px-3 sm:px-4 text-xs font-bold font-sans transition-all border-b-2 cursor-pointer flex items-center gap-1.5 sm:gap-2 ${
                        activeMachineSection === 'supplies'
                          ? 'border-blue-600 text-blue-700 font-extrabold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Fournitures</span>
                      <span className="bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5 text-[9px] font-mono border border-slate-250 font-bold">
                        {selectedMachine.supplies?.length || 0}
                      </span>
                    </button>
                  </div>

                  {activeMachineSection === 'mop' ? (
                    <div ref={mopRef} className="flex flex-col gap-2">
                      {/* Schema / Photo of the machine (Replacing description + photo grid) */}
                      <div className="flex flex-col gap-2">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Schéma ou Photo de la machine</p>
                    
                    <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl flex flex-col gap-3">
                      {/* Container types format dropdown selector if available */}
                      {selectedMachine.containerImages && selectedMachine.containerImages.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-100 rounded-xl border border-slate-200 shadow-3xs">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              Format cible :
                            </span>
                            <select
                              id="format-select-dropdown-schema"
                              value={activeContainerId}
                              onChange={(e) => setActiveContainerId(e.target.value)}
                              className="text-xs font-extrabold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 cursor-pointer shadow-3xs"
                            >
                              {selectedMachine.containerImages.map((img) => (
                                <option key={img.id} value={img.id}>
                                  {img.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Format rename interface */}
                          <div className="flex items-center justify-end">
                            {editingTabId === activeContainerId ? (
                              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                <input
                                  type="text"
                                  value={editingTabLabel}
                                  onChange={(e) => setEditingTabLabel(e.target.value)}
                                  className="flex-1 sm:w-44 text-xs font-sans border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-semibold"
                                  placeholder="Nom du format..."
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      saveTabLabel(selectedMachine.id, activeContainerId, editingTabLabel);
                                    } else if (e.key === 'Escape') {
                                      setEditingTabId(null);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => saveTabLabel(selectedMachine.id, activeContainerId, editingTabLabel)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shrink-0"
                                >
                                  Valider
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTabId(null)}
                                  className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-650 text-xs font-bold rounded-lg cursor-pointer transition-all shrink-0"
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTabId(activeContainerId);
                                  setEditingTabLabel(selectedMachine.containerImages?.find(img => img.id === activeContainerId)?.label || '');
                                }}
                                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-white hover:bg-slate-50 border border-slate-250 px-2.5 py-1.5 rounded-lg shadow-3xs inline-flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <Pencil className="w-2.5 h-2.5 text-blue-500" />
                                Renommer ce format
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Render selected image */}
                      {(() => {
                        const activeImgUrl = selectedMachine.containerImages && selectedMachine.containerImages.length > 0
                          ? (selectedMachine.containerImages.find(img => img.id === activeContainerId)?.imageUrl || selectedMachine.imageUrl)
                          : selectedMachine.imageUrl;

                        return activeImgUrl ? (
                          <div className="relative group overflow-hidden rounded-lg border border-slate-200 bg-white h-[200px] flex items-center justify-center transition-all shadow-3xs cursor-pointer">
                            <img
                              src={activeImgUrl}
                              alt={selectedMachine.name}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-102 p-2"
                            />
                            <div
                              onClick={() => {
                                setZoomImage(activeImgUrl || null);
                                setZoomScale(1.1);
                                setZoomRotation(0);
                              }}
                              className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-zoom-in gap-1.5 text-xs font-bold"
                            >
                              <Maximize2 className="w-4 h-4 text-white drop-shadow-sm" />
                              <span>Agrandir</span>
                            </div>
                          </div>
                        ) : (
                          <div className="border border-dashed border-slate-200 rounded-lg h-[200px] flex flex-col items-center justify-center bg-white text-slate-400 p-4 text-center">
                            <span className="text-xs leading-normal text-slate-400 font-medium">Aucun schéma</span>
                            <div className="flex gap-2 mt-2.5">
                              <button
                                type="button"
                                onClick={() => setCameraActiveTarget({ type: 'machine' })}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 hover:scale-101 border-none text-xs font-bold text-white rounded-lg cursor-pointer shadow-3xs transition-all inline-flex items-center gap-1.5"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Prendre photo</span>
                              </button>
                              <label className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-650 rounded-lg cursor-pointer shadow-3xs transition-all inline-flex items-center gap-1.5">
                                <Upload className="w-3.5 h-3.5 text-slate-500" />
                                <span>Importer</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleImageUpload}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Bottom action controls */}
                      {(() => {
                        const hasActiveImgUrl = selectedMachine.containerImages && selectedMachine.containerImages.length > 0
                          ? !!(selectedMachine.containerImages.find(img => img.id === activeContainerId)?.imageUrl)
                          : !!selectedMachine.imageUrl;

                        if (hasActiveImgUrl) {
                          return (
                            <div className="flex justify-between items-center text-xs mt-1 pt-2 border-t border-slate-100">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setCameraActiveTarget({ type: 'machine' })}
                                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-bold inline-flex items-center gap-1"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>Prendre photo</span>
                                </button>
                                <span className="text-slate-250 select-none">|</span>
                                <label className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-bold inline-flex items-center gap-1">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>Importer</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                  />
                                </label>
                              </div>

                              <div className="flex gap-2 items-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDelete({
                                      isOpen: true,
                                      action: () => handleDeleteMachineImage(),
                                      title: "Supprimer la photo ?",
                                      message: "Êtes-vous sûr de vouloir supprimer cette photo ?"
                                    });
                                  }}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    setConfirmDelete({
                                      isOpen: true,
                                      action: () => handleDeleteMachineImage(),
                                      title: "Supprimer la photo ?",
                                      message: "Êtes-vous sûr de vouloir supprimer cette photo ?"
                                    });
                                  }}
                                  className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors cursor-pointer flex items-center justify-center min-w-[44px] min-h-[44px]"
                                  title="Supprimer la photo"
                                >
                                  <Trash2 className="w-8 h-8" />
                                </button>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  {/* STEP-BY-STEP INTERACTIVE CHECKLIST */}
                  {(() => {
                    const currentFormatSteps = (selectedMachine.containerSteps && activeContainerId && selectedMachine.containerSteps[activeContainerId])
                      ? selectedMachine.containerSteps[activeContainerId]
                      : selectedMachine.mainSteps;

                    const hasSteps = currentFormatSteps && currentFormatSteps.length > 0;
                    if (!hasSteps) return null;

                    return (
                      <div className="bg-slate-50/40 border border-slate-150 rounded-2xl p-4.5 flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Étapes de Préparation à Cocher
                              </p>
                              {selectedMachine.containerImages && selectedMachine.containerImages.length > 0 && activeContainerId && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                                  Format : {selectedMachine.containerImages.find(img => img.id === activeContainerId)?.label}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Cochez chaque consigne une fois effectuée
                            </p>
                          </div>

                          <div className="flex gap-3 shrink-0">
                            <button
                              onClick={() => handleStartEditingSelectedMachine()}
                              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
                            >
                              Modifier les étapes
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {currentFormatSteps.map((step) => {
                            const isChecked = (checkedSteps[selectedMachine.id] || []).includes(step.num);
                            return (
                              <div
                                key={step.num}
                                onClick={() => toggleStep(selectedMachine.id, step.num)}
                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                                  isChecked
                                    ? 'bg-emerald-50/50 border-emerald-250 text-slate-700'
                                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800 shadow-2xs'
                                }`}
                              >
                                <div className="mt-0.5 shrink-0">
                                  {isChecked ? (
                                    <CheckSquare className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                                  ) : (
                                    <div className="w-5 h-5 border-2 border-slate-300 rounded hover:border-blue-500 transition-all" />
                                  )}
                                </div>
                                
                                <div className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-400">Étape {step.num} :</span>
                                    <span className={`font-bold ${isChecked ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                      {step.title}
                                    </span>
                                  </div>
                                  <p className={`mt-1 leading-relaxed whitespace-pre-line ${isChecked ? 'text-slate-400 italic' : 'text-slate-600'}`}>
                                    {step.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* TROUBLESHOOTING (Pannes et dépannage) */}
                   <div>
                     <div className="flex items-center justify-between gap-4 mb-3 border-b border-slate-100 pb-2">
                       <div className="flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4 text-red-500" />
                         <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                           Guide Diagnostique & Résolution Anomalies Courantes
                         </p>
                       </div>
                       
                       {!isEditingTroubles && (
                         <button
                           onClick={startEditingTroubles}
                           className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-all shrink-0"
                         >
                           <Pencil className="w-3 h-3 text-blue-600" />
                           Modifier
                         </button>
                       )}
                     </div>

                     {isEditingTroubles ? (
                       <div className="space-y-4 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                         {editingTroublesList.map((item, idx) => (
                           <div key={idx} className="relative bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs flex flex-col gap-2.5">
                             <div className="flex items-center justify-between">
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">PANNE #{idx + 1}</span>
                               <button
                                 type="button"
                                 onClick={() => removeTroubleItem(idx)}
                                 className="text-slate-400 hover:text-red-650 transition-colors p-1 rounded hover:bg-slate-100 cursor-pointer"
                                 title="Supprimer cette panne"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </div>

                             <div className="flex flex-col gap-1 text-xs">
                               <span className="font-bold text-slate-700">Description Anomalie / Panne :</span>
                               <input
                                 type="text"
                                 value={item.issue}
                                 onChange={(e) => handleTroubleChange(idx, 'issue', e.target.value)}
                                 placeholder="ex: Panne d'acheminement..."
                                 className="w-full text-xs font-sans border border-slate-200 rounded p-2 bg-slate-50 hover:bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-semibold"
                               />
                             </div>

                             <div className="flex flex-col gap-1 text-xs">
                               <span className="font-bold text-slate-700">Procédure de Résolution / Solution :</span>
                               <textarea
                                 rows={2}
                                 value={item.solution}
                                 onChange={(e) => handleTroubleChange(idx, 'solution', e.target.value)}
                                 placeholder="ex: Redémarrer la cellule ou nettoyer le capteur..."
                                 className="w-full text-xs font-sans border border-slate-200 rounded p-2 bg-slate-50 hover:bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all leading-normal"
                               />
                             </div>
                           </div>
                         ))}

                         {editingTroublesList.length === 0 && (
                           <p className="text-center py-6 text-slate-400 text-xs italic bg-white border border-dashed border-slate-250 rounded-lg">
                             Aucune panne enregistrée. Cliquez sur le bouton "+ Ajouter" ci-dessous.
                           </p>
                         )}

                         {/* Actions Panel */}
                         <div className="flex flex-col sm:flex-row items-center gap-2 justify-between pt-2">
                           <button
                             type="button"
                             onClick={addTroubleItem}
                             className="w-full sm:w-auto px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 rounded-lg text-xs font-bold transition-all inline-flex items-center justify-center gap-1 cursor-pointer border border-blue-100"
                           >
                             <Plus className="w-3.5 h-3.5" />
                             Ajouter une Anomalie
                           </button>

                           <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                             <button
                               type="button"
                               onClick={resetTroublesToDefault}
                               className="px-2.5 py-1.5 hover:bg-slate-150 border border-slate-200 text-slate-500 hover:text-slate-700 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-all"
                               title="Restaurer la liste d'usine initiale"
                             >
                               Réinitialiser
                             </button>

                             <button
                               type="button"
                               onClick={() => setIsEditingTroubles(false)}
                               className="px-2.5 py-1.5 hover:bg-slate-150 border border-slate-200 text-slate-650 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                             >
                               Annuler
                             </button>

                             <button
                               type="button"
                               onClick={saveTroubles}
                               className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
                             >
                               Enregistrer
                             </button>
                           </div>
                         </div>
                       </div>
                     ) : (
                       <div className="space-y-3">
                         {selectedMachine.troubleshooting.length === 0 ? (
                           <div className="border border-dashed border-slate-250 rounded-xl p-6 text-center text-slate-400 bg-white">
                             <p className="text-xs italic">Aucun guide de dépannage configuré pour cette machine actuellement.</p>
                             <button
                               onClick={startEditingTroubles}
                               className="mt-2 text-xs font-bold text-blue-600 hover:underline bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded inline-flex items-center gap-1 cursor-pointer"
                             >
                               <Plus className="w-3 h-3" /> Configurer une anomalie
                             </button>
                           </div>
                         ) : (
                           selectedMachine.troubleshooting.map((trouble, idx) => (
                             <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-white hover:bg-slate-50/50 transition-all flex flex-col gap-2">
                               <div className="flex items-start gap-2">
                                 <span className="text-xs bg-red-105 text-red-800 px-2 py-0.5 rounded font-bold font-mono">PANNE</span>
                                 <span className="text-xs font-bold text-slate-900">{trouble.issue}</span>
                               </div>
                               <div className="flex items-start gap-2 mt-1 pl-1 text-[12.5px] border-l-2 border-emerald-500">
                                 <span className="text-xs font-semibold text-emerald-800 uppercase font-sans shrink-0">SOLUTION:</span>
                                 <p className="text-slate-600 leading-normal">{trouble.solution}</p>
                               </div>
                             </div>
                           ))
                         )}
                       </div>
                     )}
                   </div>
                  </div>
                 ) : (
                   <div className="flex flex-col gap-5 animate-fade-in">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3 font-sans">
                       <div>
                         <h3 className="text-sm font-bold text-slate-800">Gestion des Fournitures & Consommables</h3>
                         <p className="text-xs text-slate-500 mt-0.5 font-medium">Associez des photos et listez les observations sur les fournitures de cette machine.</p>
                       </div>
                       
                       <div className="flex gap-2 shrink-0">
                         <button
                           type="button"
                           onClick={resetSuppliesToDefault}
                           className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-3xs animate-fade-in"
                           title="Restaurer la liste d'usine initiale des fournitures"
                         >
                           <RotateCcw className="w-3.5 h-3.5" />
                           Configuration Usine
                         </button>

                         <button
                           type="button"
                           onClick={addSupplyItem}
                           className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-3xs hover:shadow-xs"
                         >
                           <Plus className="w-3.5 h-3.5" />
                           Ajouter une fourniture
                         </button>
                       </div>
                     </div>

                     {/* Supplies grid list */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {(!selectedMachine.supplies || selectedMachine.supplies.length === 0) ? (
                         <div className="col-span-1 md:col-span-2 border border-dashed border-slate-250 rounded-xl p-8 text-center bg-slate-50/50 text-slate-400">
                           <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                           <p className="text-xs font-medium">Aucune fourniture ou consommable enregistré pour cette machine.</p>
                           <button
                             type="button"
                             onClick={addSupplyItem}
                             className="mt-3 text-xs bg-white text-blue-650 border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-bold shadow-3xs transition-all inline-flex items-center gap-1 cursor-pointer"
                           >
                             <Plus className="w-3.5 h-3.5" /> Ajouter la première fourniture
                           </button>
                         </div>
                       ) : (
                         selectedMachine.supplies.map((sup) => (
                           <div 
                             key={sup.id} 
                             className="border border-slate-200 rounded-xl bg-white p-4 hover:shadow-xs transition-all flex flex-col gap-3 relative group"
                           >
                             {/* Card header */}
                             <div className="flex items-center justify-between gap-2.5">
                               {/* Editable Supply Name */}
                               <input
                                 type="text"
                                 value={sup.name}
                                 onChange={(e) => updateSupplyItem(sup.id, 'name', e.target.value)}
                                 className="text-xs font-bold font-sans text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white border-b border-transparent focus:border-blue-500 hover:border-slate-200 px-1 py-0.5 rounded focus:outline-none flex-1 transition-colors font-semibold"
                                 placeholder="Nom de la fourniture (ex: Bouchons)"
                               />
                               
                               <button
                                 type="button"
                                 onClick={() => deleteSupplyItem(sup.id)}
                                 className="text-slate-400 hover:text-red-650 p-1.5 rounded hover:bg-slate-100 opacity-60 hover:opacity-100 transition-all cursor-pointer"
                                 title="Supprimer cette fourniture"
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                             </div>

                             {/* Descriptif / Rôle area */}
                             <div className="flex flex-col gap-1 text-xs">
                               <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider font-mono">Descriptif / Rôle de la fourniture :</span>
                               <textarea
                                 rows={2}
                                 value={sup.description || ''}
                                 onChange={(e) => updateSupplyItem(sup.id, 'description', e.target.value)}
                                 placeholder="Entrez une description, rôle, dimensions ou caractéristiques de la fourniture..."
                                 className="w-full text-xs font-sans border border-slate-200 rounded p-1.5 bg-slate-50 hover:bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all leading-normal text-slate-700"
                               ></textarea>
                             </div>

                             {/* Observation / Comment area */}
                             <div className="flex flex-col gap-1 text-xs">
                               <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider font-mono">Observations & Consignes :</span>
                               <textarea
                                 rows={2}
                                 value={sup.observation || ''}
                                 onChange={(e) => updateSupplyItem(sup.id, 'observation', e.target.value)}
                                 placeholder="Entrez des commentaires, références, consignes spécifiques..."
                                 className="w-full text-xs font-sans border border-slate-200 rounded p-1.5 bg-slate-50 hover:bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all leading-normal text-slate-700"
                               ></textarea>
                            </div>
                          </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  </div>)}

              </div>

            </div>
          </motion.div>
        ) : (
          <motion.div
            key="pilote-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8"
          >
            {/* Split layout: Calendar on Left, Selection details on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
              
              {/* Left sidebar: Monthly grid Calendar */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  {/* Calendar Navigation header */}
                  <div className="flex items-center justify-between mb-5 select-none">
                    <button
                      onClick={handlePrevMonth}
                      className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 text-slate-600 transition-all cursor-pointer flex items-center justify-center shrink-0"
                      title="Mois précédent"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-sm font-bold text-slate-800 tracking-wide font-sans capitalize">
                      {MONTH_NAMES_FR[calendarMonth]} {calendarYear}
                    </h3>
                    <button
                      onClick={handleNextMonth}
                      className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 text-slate-600 transition-all cursor-pointer flex items-center justify-center shrink-0"
                      title="Mois suivant"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Days of week titles */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((lbl, idx) => (
                      <div key={idx} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono text-center py-1">
                        {lbl}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid cells */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {(() => {
                      const cells: React.ReactNode[] = [];
                      const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                      const firstDayIndexRaw = new Date(calendarYear, calendarMonth, 1).getDay();
                      const firstDayIndex = firstDayIndexRaw === 0 ? 6 : firstDayIndexRaw - 1;

                      // Fill blanks of preceding month
                      for (let i = 0; i < firstDayIndex; i++) {
                        cells.push(<div key={`blank-${i}`} className="aspect-square" />);
                      }

                      // Fill days
                      const todayObj = new Date();
                      const isSameMonthYear = todayObj.getFullYear() === calendarYear && todayObj.getMonth() === calendarMonth;
                      const realTodayDay = todayObj.getDate();

                      for (let d = 1; d <= totalDays; d++) {
                        const dStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isSelected = selectedDateStr === dStr;
                        const isToday = isSameMonthYear && realTodayDay === d;
                        
                        const recap = productionRecaps[dStr];
                        const photoCount = recap?.photos ? recap.photos.filter(p => p !== null).length : 0;
                        const hasNotes = recap?.notes?.trim().length > 0;
                        const hasSavedData = photoCount > 0 || hasNotes;

                        cells.push(
                          <button
                            key={`day-${d}`}
                            onClick={() => setSelectedDateStr(dStr)}
                            className={`aspect-square rounded-xl text-xs font-semibold relative flex flex-col items-center justify-between p-1.5 transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100 font-bold scale-102 z-10'
                                : isToday
                                  ? 'bg-blue-50/60 text-blue-600 border-blue-200 hover:bg-blue-50 font-bold'
                                  : 'bg-slate-50/50 hover:bg-slate-100 text-slate-755 border-slate-100'
                            }`}
                          >
                            <span>{d}</span>
                            
                            {/* Recap markers */}
                            {hasSavedData && (
                              <div className="flex items-center gap-0.5 mt-auto">
                                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                                {photoCount > 0 && (
                                  <span className={`text-[8px] font-bold font-mono px-0.5 rounded ${
                                    isSelected ? 'text-blue-100 animate-none' : 'text-slate-500'
                                  }`}>
                                    {photoCount}
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                  
                  {/* Calendar Legends */}
                  <div className="mt-5 pt-4 border-t border-slate-150 flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-md bg-blue-600 shadow-xs" />
                      <span>Date active</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-md bg-blue-50 border border-blue-200" />
                      <span>Aujourd'hui</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[8px] text-slate-400">📸</span>
                      </div>
                      <span>Récapitulatif enregistré</span>
                    </div>
                  </div>
                </div>

                {/* Historique récent */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}>
                    <h3 className="text-sm font-bold text-slate-800">Historique des Saisies</h3>
                    {isHistoryExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                  {isHistoryExpanded && (
                    <div className="space-y-4">
                      {/* Export/Import Controls */}
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleExportData} className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-lg transition-colors">
                          <FileDown className="w-4 h-4" />
                          Exporter
                        </button>
                        <label className="flex items-center justify-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2.5 rounded-lg cursor-pointer transition-colors">
                          <Upload className="w-4 h-4" />
                          Importer
                          <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                        </label>
                      </div>

                      <div className="space-y-2">
                        {Object.keys(productionRecaps)
                          .sort((a, b) => b.localeCompare(a))
                          .filter((dStr) => {
                            const recap = productionRecaps[dStr];
                            const photoCount = recap?.photos ? recap.photos.filter((p) => p !== null).length : 0;
                            const hasNotes = recap?.notes?.trim().length > 0;
                            return photoCount > 0 || hasNotes;
                          })
                          .slice(0, 5)
                          .map((dStr) => (
                            <button
                              key={dStr}
                              onClick={() => setSelectedDateStr(dStr)}
                              className="flex w-full items-center justify-between text-xs p-3 rounded-lg border border-slate-100 hover:bg-slate-50 text-slate-700 hover:text-blue-600 transition-colors"
                            >
                              <span className="font-mono font-medium">{dStr}</span>
                              <span className="text-[10px] font-semibold bg-slate-100 px-2 py-0.5 rounded">Voir →</span>
                            </button>
                          ))}
                        {Object.keys(productionRecaps).filter((dStr) => {
                          const recap = productionRecaps[dStr];
                          const photoCount = recap?.photos ? recap.photos.filter((p) => p !== null).length : 0;
                          const hasNotes = recap?.notes?.trim().length > 0;
                          return photoCount > 0 || hasNotes;
                        }).length === 0 && (
                          <p className="text-xs text-slate-400 italic">Aucune donnée saisie.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Info Card */}
                <div className="bg-blue-50/50 rounded-2xl border border-blue-100 p-4 flex gap-3">
                  <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800 leading-relaxed">
                    <p className="font-bold">Astuce de numérisation :</p>
                    <p className="mt-0.5">Cliquez sur une date libre pour prendre en photo un ticket, un tableau blanc ou un registre de relève. Vous pouvez zoomer à deux doigts sur mobile pour relire vos notes de production.</p>
                  </div>
                </div>
              </div>

              {/* Right Side: Chosen date details editor sheet */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                
                {/* Panel recap */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col gap-5">
                  
                  {/* Title & subtitle with sub-tab controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-blue-600 font-mono">
                          Pilote de Production
                        </h3>
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-sans capitalize mt-0.5">
                          {(() => {
                            try {
                              const d = new Date(selectedDateStr);
                              if (isNaN(d.getTime())) return selectedDateStr;
                              return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            } catch {
                              return selectedDateStr;
                            }
                          })()}
                        </h2>
                      </div>
                    </div>

                    {/* Sub-tabs segment switcher */}
                    <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0 border border-slate-155">
                      <button
                        type="button"
                        onClick={() => setPiloteSubTab('recap')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                          piloteSubTab === 'recap'
                            ? 'bg-white text-blue-600 shadow-3xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        📝 Rapport de Shift
                      </button>

                    </div>
                  </div>

                  {piloteSubTab === 'recap' && (
                    <>
                      {/* Recap report action hub */}
                      <div className="flex items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-150">
                        <div className="text-xs font-bold text-slate-600 font-sans">
                          Actions du rapport
                        </div>
                        <div className="flex items-center gap-2">
                          {productionRecaps[selectedDateStr]?.photos?.some(p => p !== null) && (
                            <button
                              id="export-photos-html-btn"
                              onClick={handleExportPhotosHTML}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-2xs shadow-indigo-100 hover:shadow-xs cursor-pointer"
                              title="Exporter toutes les photos de ce shift sous forme d'une page HTML d'impression autonome"
                            >
                              <Camera className="w-3.5 h-3.5 text-indigo-100" />
                              <span>Exporter HTML Photos</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Report Observations Area */}
                      <div className="flex flex-col gap-1.5 text-left">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          Observations, Incidents & Consignes de Relève :
                        </label>
                        <textarea
                          rows={4}
                          value={productionRecaps[selectedDateStr]?.notes || ''}
                          onChange={(e) => handleRecapNotesChange(e.target.value)}
                          placeholder="Décrivez les rendements, temps d'arrêt, pannes machines ou consignes spécifiques pour l'équipe suivante..."
                          className="w-full text-xs font-sans border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all leading-normal text-slate-755 placeholder-slate-400 min-h-[100px]"
                        />
                      </div>

                      {/* Photo attachments grid (Exactly 3 slots) */}
                      <div className="flex flex-col gap-3 mt-1 text-left">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-2">
                          <Camera className="w-4 h-4 text-slate-400" />
                          Photos du récapitulatif (Exactement 3) :
                        </label>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {[0, 1, 2].map((slotIndex) => {
                            const image64 = productionRecaps[selectedDateStr]?.photos?.[slotIndex] || null;
                            
                            return (
                              <div key={slotIndex} className="flex flex-col gap-1">
                                {image64 ? (
                                  <div className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-3xs bg-slate-950 flex items-center justify-center">
                                    <img
                                      src={image64}
                                      alt={`Récapitulatif ${slotIndex + 1}`}
                                      className="w-full h-full object-cover select-none"
                                      referrerPolicy="no-referrer"
                                    />
                                    
                                    {/* Overlay hover/mobile actions wrapper */}
                                    <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3 text-center">
                                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">Photo {slotIndex + 1}</span>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <button
                                          onClick={() => {
                                            setZoomImage(image64);
                                            setZoomScale(1.1);
                                            setZoomRotation(0);
                                          }}
                                          className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all cursor-pointer text-[10px] font-semibold flex items-center gap-1 border border-white/5"
                                          title="Agrandir l'image"
                                        >
                                          <Maximize2 className="w-3 h-3" />
                                          <span>Zoomer</span>
                                        </button>
                                        <button
                                          onClick={() => handleRecapImageDelete(slotIndex)}
                                          className="p-1.5 bg-red-650 hover:bg-red-600 text-white rounded-lg transition-all cursor-pointer text-[10px] font-semibold border border-red-500/10"
                                          title="Supprimer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Persistent bottom strip for instant tactile trigger on phones */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-slate-900/90 py-1 px-2 flex items-center justify-between border-t border-slate-800 z-10 sm:hidden">
                                      <span className="text-[8px] font-bold text-slate-400 font-mono">Photo {slotIndex + 1}</span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            setZoomImage(image64);
                                            setZoomScale(1.1);
                                            setZoomRotation(0);
                                          }}
                                          className="p-1 bg-white/5 hover:bg-white/15 text-blue-400 rounded transition-all"
                                        >
                                          <Maximize2 className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleRecapImageDelete(slotIndex)}
                                          className="p-1 bg-red-950/40 text-red-500 rounded transition-all"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <label className={`relative flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 bg-slate-50 rounded-xl aspect-square transition-all text-center select-none ${isCompressing ? 'cursor-wait bg-blue-50/10' : 'cursor-pointer'}`}>
                                    {isCompressing ? (
                                      <>
                                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-1.5" />
                                        <span className="text-[11px] font-bold text-blue-600">Optimisation...</span>
                                        <span className="text-[9px] text-slate-400 font-medium uppercase font-mono tracking-wider mt-0.5">Compression photo</span>
                                      </>
                                    ) : (
                                      <>
                                        <Camera className="w-6 h-6 text-slate-400 mb-1.5" />
                                        <span className="text-[11px] font-bold text-slate-700">Prendre / Charger</span>
                                        <span className="text-[9px] text-slate-400 font-medium uppercase font-mono tracking-wider mt-0.5">Photo {slotIndex + 1}</span>
                                      </>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      disabled={isCompressing}
                                      onChange={(e) => handleRecapImageUpload(slotIndex, e)}
                                      className="hidden"
                                    />
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Summary progress foot */}
                      <div className="mt-2 text-[10px] text-slate-400 font-medium font-mono flex items-center justify-between bg-slate-50/80 px-4 py-2.5 rounded-xl border border-slate-100 text-left">
                        <span>ID Relève : recaps-{selectedDateStr}</span>
                        <span className="text-slate-655 font-bold uppercase flex items-center gap-1">
                          📄 Remplissage : {
                            (() => {
                              const r = productionRecaps[selectedDateStr];
                              const ph = r?.photos ? r.photos.filter(p => p !== null).length : 0;
                              const nt = r?.notes?.trim().length > 0 ? 1 : 0;
                              return `${ph}/3 photos • Rapport : ${nt ? 'Rempli' : 'Vide'}`;
                            })()
                          }
                        </span>
                      </div>
                    </>
                  )}

                  {piloteSubTab === 'templates' && (
                    <div className="flex flex-col gap-6 text-left">
                      {/* Section intro info */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs text-slate-600 flex items-start gap-2.5">
                        <FileText className="w-4.5 h-4.5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-800">Éditeur autonome de Fiches PDF</p>
                          <p className="mt-0.5 leading-normal text-slate-500">Rédigez et téléchargez des fiches techniques au format A4. Tout s'exécute localement dans votre téléphone.</p>
                        </div>
                      </div>

                      {/* Template Selection */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider block m-0">
                          📂 Modèle de Document
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: 'procedure', label: '🧹 Nettoyage', desc: 'Fiche nettoyage' },
                            { key: 'production', label: '📊 Production', desc: 'Rapport prod' },
                            { key: 'securite', label: '🛡️ Sécurité', desc: 'Consignes HSE' },
                            { key: 'incident', label: '⚠️ Incident', desc: 'Rapport arrêt' },
                          ].map((tpl) => (
                            <button
                              key={tpl.key}
                              type="button"
                              onClick={() => appliquerTemplateLocal(tpl.key)}
                              className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                                selectedTemplate === tpl.key
                                  ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs'
                                  : 'bg-slate-50 border-slate-150 hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <span className="text-xs font-bold">{tpl.label}</span>
                              <span className="text-[9px] text-slate-400 font-semibold">{tpl.desc}</span>
                            </button>
                          ))}
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => appliquerTemplateLocal('custom')}
                          className={`w-full py-2.5 rounded-xl border text-center transition-all cursor-pointer text-xs font-bold ${
                            selectedTemplate === 'custom'
                              ? 'bg-blue-50 border-blue-500 text-blue-900'
                              : 'bg-slate-50 border-slate-150 hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          ✏️ Créer un document personnalisé à partir de zéro
                        </button>
                      </div>

                      {/* Document Metadata Form */}
                      <div className="space-y-4 border-t border-slate-100 pt-4">
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider block m-0">
                          ✍️ En-tête de la Fiche
                        </h3>

                        <div className="space-y-1.5">
                          <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">Titre principal</label>
                          <input
                            type="text"
                            value={localPdfTitle}
                            onChange={(e) => setLocalPdfTitle(e.target.value)}
                            placeholder="Ex: Procédure de consigne du palettiseur"
                            className="w-full text-xs border border-slate-200 bg-slate-50 rounded-xl px-3.5 py-2.5 text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all font-semibold"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">Auteur / Rédacteur</label>
                            <input
                              type="text"
                              value={localPdfAuthor}
                              onChange={(e) => setLocalPdfAuthor(e.target.value)}
                              placeholder="Ex: F. Florand"
                              className="w-full text-xs border border-slate-200 bg-slate-50 rounded-xl px-3.5 py-2.5 text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">Date</label>
                            <input
                              type="text"
                              value={localPdfDate}
                              onChange={(e) => setLocalPdfDate(e.target.value)}
                              placeholder="Ex: 1 juillet 2026"
                              className="w-full text-xs border border-slate-200 bg-slate-50 rounded-xl px-3.5 py-2.5 text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Paragraph Editor Section */}
                      <div className="space-y-4 border-t border-slate-100 pt-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider block m-0">
                            📝 Paragraphes de contenu
                          </h3>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                            {localPdfParagraphs.length} total
                          </span>
                        </div>

                        <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                          {localPdfParagraphs.map((paragraph, index) => (
                            <div key={index} className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-2 relative group">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono font-bold text-slate-400">
                                  Paragraphe #{index + 1}
                                </span>
                                {localPdfParagraphs.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...localPdfParagraphs];
                                      next.splice(index, 1);
                                      setLocalPdfParagraphs(next);
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-all cursor-pointer"
                                    title="Supprimer ce paragraphe"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              <textarea
                                rows={3}
                                value={paragraph}
                                onChange={(e) => {
                                  const next = [...localPdfParagraphs];
                                  next[index] = e.target.value;
                                  setLocalPdfParagraphs(next);
                                }}
                                placeholder="Saisissez le texte de ce paragraphe..."
                                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all leading-normal"
                              />
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => setLocalPdfParagraphs([...localPdfParagraphs, ""])}
                          className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 text-slate-500 hover:text-blue-600 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Ajouter un paragraphe</span>
                        </button>

                        {localPdfError && (
                          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium leading-relaxed">
                            ⚠️ {localPdfError}
                          </div>
                        )}
                      </div>

                      {/* Preview and print sheet */}
                      <div className="border-t border-slate-150 pt-5 space-y-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-xs text-slate-500 font-bold">
                            Aperçu du document d'impression (A4)
                          </span>
                          
                          <button
                            onClick={genererPdfDepuisEditeurLocal}
                            className="px-5 py-2.5 bg-blue-650 hover:bg-blue-750 text-white rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/10 cursor-pointer hover:scale-102 active:scale-98"
                          >
                            <Printer className="w-4 h-4 text-blue-100" />
                            <span>Exporter le PDF (Format APK)</span>
                          </button>
                        </div>

                        {/* A4 Sheet Mockup Container */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 relative min-h-[450px] flex flex-col font-sans border-t-8 border-t-blue-600 transition-all text-left">
                          {/* Decorative stamp */}
                          <div className="absolute top-6 right-6 opacity-5 select-none pointer-events-none border-4 border-slate-900 rounded-xl px-2 py-1 transform rotate-12 font-mono font-bold text-xs uppercase tracking-widest text-slate-900">
                            LOCAL APP
                          </div>

                          {/* Document Sheet Header */}
                          <div className="pb-4 mb-5 border-b border-slate-200 shrink-0">
                            <h4 className="text-base sm:text-lg font-black text-slate-800 leading-tight">
                              {localPdfTitle || "Nouveau Document Technique"}
                            </h4>
                            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold italic mt-1.5">
                              <p className="flex items-center gap-1">
                                <span>👤</span>
                                <span>Par {localPdfAuthor || "Non spécifié"}</span>
                              </p>
                              <p className="flex items-center gap-1">
                                <span>📅</span>
                                <span>Date : {localPdfDate}</span>
                              </p>
                            </div>
                          </div>

                          {/* Document Sheet Body paragraphs */}
                          <div className="flex-1 space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                            {localPdfParagraphs.filter(p => p.trim() !== '').map((paragraph, index) => (
                              <p key={index} className="indent-4 font-normal text-slate-800">
                                {paragraph}
                              </p>
                            ))}
                            {localPdfParagraphs.filter(p => p.trim() !== '').length === 0 && (
                              <p className="text-slate-400 italic text-center py-10">
                                Aucun contenu saisi. Remplissez les paragraphes dans l'éditeur ci-dessus.
                              </p>
                            )}
                          </div>

                          {/* Document Sheet Footer */}
                          <div className="pt-4 mt-6 border-t border-slate-100 shrink-0 text-center">
                            <p className="text-[9px] text-slate-400 font-mono">
                              Document technique édité et généré localement • Format d'exportation A4 Standard
                            </p>
                          </div>
                        </div>

                        <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl text-[11px] text-blue-700 font-medium leading-relaxed">
                          💡 <strong>Fonctionnement 100% hors-ligne :</strong> Cet éditeur s'exécute directement dans le processeur de votre téléphone. Aucune connexion internet n'est sollicitée. Le PDF est créé instantanément et vous est proposé au partage local.
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Immersive Photo Zoom Modal Lightbox / MOP Scheme viewer */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDoubleClick={() => setZoomImage(null)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 select-none touch-none"
          >
            {/* Dark glass floating header bar */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-4 bg-slate-900/85 backdrop-blur-md px-5 py-3 rounded-xl border border-slate-800 max-w-2xl mx-auto w-full z-10 shadow-lg">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-mono">Schéma Technique & MOP Agrandis</p>
                <h4 className="text-xs sm:text-sm font-bold text-white truncate">{selectedMachine.name}</h4>
              </div>

              {/* Close Button at top */}
              <button
                onClick={() => setZoomImage(null)}
                className="p-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all border border-white/10 shrink-0"
              >
                <X className="w-4 h-4" />
                <span>Fermer</span>
              </button>
            </div>

            {/* Interactive Drag & Zoom Workspace Area */}
            <div className="relative flex items-center justify-center w-full h-full max-h-[75vh] mt-12 overflow-hidden touch-none">
              <motion.img
                key={zoomImage}
                src={zoomImage}
                alt={selectedMachine.name}
                referrerPolicy="no-referrer"
                drag
                dragMomentum={false}
                dragElastic={0.1}
                style={{ 
                  scale: zoomScale, 
                  rotate: `${zoomRotation}deg`
                }}
                className="max-h-[70vh] max-w-[90vw] object-contain rounded-lg shadow-2xl cursor-grab active:cursor-grabbing select-none transition-transform duration-100 ease-out"
              />
            </div>

            {/* Floating Control Hub */}
            <div className="mt-4 flex items-center justify-center gap-1 bg-slate-900/90 backdrop-blur-md p-2 rounded-full border border-slate-800 shadow-2xl z-10">
              <button
                type="button"
                onClick={() => setZoomScale(s => Math.max(s - 0.25, 0.5))}
                className="p-2.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Zoom arrière"
              >
                <ZoomOut className="w-5 h-5" />
              </button>

              <span className="text-xs font-bold font-mono text-slate-300 min-w-[55px] text-center select-none">
                {Math.round(zoomScale * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoomScale(s => Math.min(s + 0.25, 4))}
                className="p-2.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Zoom avant"
              >
                <ZoomIn className="w-5 h-5" />
              </button>

              <div className="w-px h-5 bg-slate-800 mx-1" />

              <button
                type="button"
                onClick={() => setZoomRotation(r => (r + 90) % 360)}
                className="p-2.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                title="Faire pivoter de 90°"
              >
                <RotateCw className="w-5 h-5" />
                {zoomRotation !== 0 && (
                  <span className="text-[10px] font-bold text-blue-400 font-mono -ml-0.5">{zoomRotation}°</span>
                )}
              </button>

              <div className="w-px h-5 bg-slate-800 mx-1" />

              <button
                type="button"
                onClick={() => {
                  setZoomScale(1.1);
                  setZoomRotation(0);
                }}
                className="px-4 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/15 rounded-full transition-all cursor-pointer"
              >
                Réinitialiser
              </button>
            </div>
            
            {/* Help instructions underneath */}
            <p className="mt-3.5 text-[10px] text-slate-500 font-semibold tracking-wider uppercase text-center">
              💡 Glissez l'image pour la déplacer • Double-cliquez n'importe où pour quitter
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={cameraActiveTarget !== null}
        onClose={() => setCameraActiveTarget(null)}
        onCapture={handleCameraCapture}
        title={
          cameraActiveTarget?.type === 'recap'
            ? `Photo ${cameraActiveTarget.slotIndex !== undefined ? cameraActiveTarget.slotIndex + 1 : 1} - Rapport de Relève`
            : cameraActiveTarget?.type === 'supply'
            ? "Photo de Contrôle - Fournitures"
            : "Photo / Schéma de la Machine"
        }
      />

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-500 py-6 border-t border-slate-800 text-center text-xs mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} - Système de Pilotage d'Embouteillage. Tous droits réservés.</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Application Client Locale Sécurisée</span>
          </div>
        </div>
      </footer>
      {confirmDelete.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900">{confirmDelete.title}</h3>
            <p className="text-slate-600">{confirmDelete.message}</p>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setConfirmDelete({ ...confirmDelete, isOpen: false })} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800">Annuler</button>
              <button 
                onClick={() => { 
                  confirmDelete.action(); 
                  setConfirmDelete({ isOpen: false, action: () => {}, title: '', message: '' });
                }} 
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Popup de succès global */}
      {showSaveSuccess && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium">Enregistré avec succès !</span>
        </div>
      )}

      {/* Toast de succès pour l'impression */}
      {showPrintSuccessToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3.5 rounded-full shadow-xl z-50 flex items-center gap-2.5 animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-100" />
          <span className="text-sm font-bold">Impression lancée avec succès !</span>
        </div>
      )}

      {/* Android-style Print Preview Modal */}
      {showAndroidPrintPreview && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-[#f1f3f4] text-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[88vh]">
            
            {/* Android Print Spooler - Header */}
            <div className="bg-white px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                {/* Close Button */}
                <button 
                  onClick={() => setShowAndroidPrintPreview(false)}
                  className="p-2 hover:bg-slate-100 text-slate-600 rounded-full transition-all cursor-pointer shrink-0"
                  title="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Printer Selector */}
                <div className="flex-1 min-w-0 text-left">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider font-sans">
                    Imprimante sélectionnée
                  </span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={androidPrinter}
                      onChange={(e) => setAndroidPrinter(e.target.value)}
                      className="text-base font-extrabold text-slate-900 bg-transparent border-none outline-none focus:ring-0 p-0 pr-6 cursor-pointer font-sans appearance-none"
                    >
                      <option value="pdf">Enregistrer au format PDF</option>
                      <option value="system">Service d'impression système (Android)</option>
                      <option value="drive">Enregistrer dans Google Drive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Android circular FAB Print Button */}
              <div className="flex items-center gap-3 justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setAndroidExpandedOptions(!androidExpandedOptions)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-full text-slate-600 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                  title="Plus d'options d'impression"
                >
                  <span>Options</span>
                  {androidExpandedOptions ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                <button
                  onClick={() => {
                    const selectedCount = Object.values(androidSelectedPages).filter(Boolean).length;
                    if (selectedCount === 0) {
                      alert("Veuillez sélectionner au moins une page à imprimer.");
                      return;
                    }
                    setShowAndroidPrintPreview(false);
                    setShowPrintSuccessToast(true);
                    setTimeout(() => {
                      window.focus();
                      window.print();
                    }, 250);
                  }}
                  className="w-14 h-14 bg-amber-500 hover:bg-amber-600 active:scale-90 text-slate-950 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all cursor-pointer border-4 border-white shrink-0"
                  title="Lancer l'impression"
                >
                  <Printer className="w-6 h-6 stroke-[2.5] text-slate-900 animate-pulse" />
                </button>
              </div>
            </div>

            {/* Android Print Spooler Options Sub-panel */}
            <div className={`bg-white border-b border-slate-200 transition-all duration-300 overflow-hidden text-left ${androidExpandedOptions ? 'max-h-[350px] p-5' : 'max-h-0'}`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-sans text-xs">
                
                {/* Copies Options */}
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-bold">Nombre de copies</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={androidCopies <= 1}
                      onClick={() => setAndroidCopies(prev => Math.max(1, prev - 1))}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-extrabold text-slate-800">{androidCopies}</span>
                    <button
                      type="button"
                      onClick={() => setAndroidCopies(prev => prev + 1)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Color option */}
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-bold">Couleur</label>
                  <select
                    value={androidColor}
                    onChange={(e) => setAndroidColor(e.target.value as 'color' | 'mono')}
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="color">Couleur</option>
                    <option value="mono">Noir et blanc (Monochrome)</option>
                  </select>
                </div>

                {/* Orientation option */}
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-bold">Orientation</label>
                  <select
                    value={androidOrientation}
                    onChange={(e) => setAndroidOrientation(e.target.value as 'portrait' | 'landscape')}
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Paysage</option>
                  </select>
                </div>

                {/* Paper Size Option */}
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-bold">Taille du papier</label>
                  <select
                    value={androidPaperSize}
                    onChange={(e) => setAndroidPaperSize(e.target.value as 'A4' | 'Letter')}
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="A4">A4 (210 x 297 mm)</option>
                    <option value="Letter">Letter (216 x 279 mm)</option>
                  </select>
                </div>

              </div>
              
              <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
                * Note : L'application force le saut de page automatique pour garantir <strong className="text-slate-700">1 photo par page</strong>.
              </div>
            </div>

            {/* Quick status line if options collapsed */}
            {!androidExpandedOptions && (
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 text-left text-[11px] text-slate-500 font-bold flex gap-3 flex-wrap">
                <span>Format : {androidPaperSize}</span>
                <span>•</span>
                <span>Mode : {androidColor === 'color' ? 'Couleur' : 'Noir & blanc'}</span>
                <span>•</span>
                <span>Copies : {androidCopies}</span>
                <span>•</span>
                <span>Orientation : {androidOrientation === 'portrait' ? 'Portrait' : 'Paysage'}</span>
              </div>
            )}

            {/* Android Print Spooler Pages Preview */}
            <div className="flex-1 overflow-y-auto bg-[#dfe2e6] p-6 flex flex-col items-center">
              
              <div className="w-full max-w-2xl flex flex-col gap-1.5 text-left mb-4">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Sélectionnez les pages à inclure
                </h4>
                <p className="text-[10px] text-slate-500 font-semibold leading-normal">
                  Cochez ou décochez les cases ci-dessous pour inclure ou exclure chaque photo du lot final.
                </p>
              </div>

              <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 justify-items-center">
                {(() => {
                  const recap = productionRecaps[selectedDateStr];
                  const photos = recap?.photos ? recap.photos.filter((p): p is string => p !== null) : [];
                  if (photos.length === 0) {
                    return <p className="text-slate-500 text-xs italic py-10 col-span-full">Aucune photo enregistrée sur cette fiche.</p>;
                  }

                  let formattedDate = selectedDateStr;
                  try {
                    const d = new Date(selectedDateStr);
                    if (!isNaN(d.getTime())) {
                      formattedDate = d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    }
                  } catch (e) {
                    console.error(e);
                  }
                  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

                  return photos.map((imgSrc, idx) => {
                    const isPageSelected = androidSelectedPages[idx] !== false;
                    return (
                      <div 
                        key={idx} 
                        className={`bg-white rounded-lg p-4 shadow-md w-full max-w-[220px] sm:max-w-[240px] border flex flex-col aspect-[1/1.414] transition-all duration-300 relative text-left ${
                          isPageSelected ? 'border-blue-500 ring-2 ring-blue-500/20 opacity-100' : 'border-slate-350 opacity-60'
                        }`}
                      >
                        {/* Android-style checkbox */}
                        <button
                          type="button"
                          onClick={() => {
                            setAndroidSelectedPages(prev => ({
                              ...prev,
                              [idx]: !isPageSelected
                            }));
                          }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer z-10"
                        >
                          {isPageSelected ? (
                            <CheckCircle className="w-6 h-6 text-blue-600 bg-white rounded-full fill-white" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-slate-400 bg-white/80" />
                          )}
                        </button>

                        {/* Document Header Representation */}
                        <div className="text-center pb-2 mb-2 border-b border-slate-100 shrink-0">
                          <h4 className="text-[9px] font-extrabold text-slate-800 uppercase tracking-wide leading-none">
                            Fiche de Production - Photo {idx + 1}
                          </h4>
                          <p className="text-[7px] text-slate-400 font-bold mt-0.5">
                            {capitalizedDate}
                          </p>
                        </div>

                        {/* Photo preview frame */}
                        <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden flex items-center justify-center p-1.5">
                          <img 
                            src={imgSrc} 
                            alt={`Aperçu Page ${idx + 1}`} 
                            className="max-h-full max-w-full object-contain rounded shadow-3xs"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Page status bottom */}
                        <div className="text-center pt-2 mt-2 border-t border-slate-100 shrink-0 flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-500">
                            Page {idx + 1}
                          </span>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${isPageSelected ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            {isPageSelected ? 'INCLUS' : 'EXCLU'}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Android Print Spooler Footer Actions */}
            <div className="bg-white px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500 font-bold">
                Total à imprimer : {Object.values(androidSelectedPages).filter(Boolean).length} page(s)
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowAndroidPrintPreview(false)}
                  className="px-5 py-2.5 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  onClick={() => {
                    const selectedCount = Object.values(androidSelectedPages).filter(Boolean).length;
                    if (selectedCount === 0) {
                      alert("Veuillez sélectionner au moins une page à imprimer.");
                      return;
                    }
                    setShowAndroidPrintPreview(false);
                    setShowPrintSuccessToast(true);
                    setTimeout(() => {
                      window.focus();
                      window.print();
                    }, 250);
                  }}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-2 shadow-md hover:shadow-lg cursor-pointer animate-pulse"
                >
                  <Printer className="w-4 h-4 text-blue-100" />
                  <span>Confirmer</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Printable section hidden on screen, visible only during print */}
      <div id="production-print-section">
        {(() => {
          const recap = productionRecaps[selectedDateStr];
          const photos = recap?.photos ? recap.photos.filter((p): p is string => p !== null) : [];
          const selectedPhotos = photos.filter((_, idx) => androidSelectedPages[idx] !== false);
          
          let formattedDate = selectedDateStr;
          try {
            const d = new Date(selectedDateStr);
            if (!isNaN(d.getTime())) {
              formattedDate = d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            }
          } catch (e) {
            console.error(e);
          }
          const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

          return selectedPhotos.map((imgSrc, idx) => (
            <div key={idx} className="print-photo-page">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                  Fiche de Production - Photo {idx + 1} / {selectedPhotos.length}
                </h1>
                <p style={{ fontSize: '14px', color: '#64748b', margin: '0', fontWeight: 'bold' }}>
                  {capitalizedDate}
                </p>
              </div>
              
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'hidden' }}>
                <img 
                  src={imgSrc} 
                  alt={`Fiche Production Photo ${idx + 1}`} 
                  className="print-photo-img" 
                  referrerPolicy="no-referrer"
                />
              </div>

              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                Document imprimé via le Pilote de Production • Code Relève : recaps-{selectedDateStr} • Page {idx + 1} sur {selectedPhotos.length}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}

// Simple internal icon to avoid mock imports
function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24" 
      strokeWidth={1.5} 
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-1.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V12.75A2.25 2.25 0 0 1 18 15h-2.25m-7.5-6v.81c0 .539.111 1.064.325 1.546l.625 1.406a4.5 4.5 0 0 0 1.25 1.72l1.625 1.625a4.5 4.5 0 0 0 3.322 1.343H18" />
    </svg>
  );
}
