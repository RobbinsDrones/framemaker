import React, { useState, useEffect, useRef, useTransition } from 'react';
import JSZip from 'jszip';
import {
  Upload,
  Camera,
  FolderOpen,
  Image as ImageIcon,
  Download,
  Share2,
  Trash2,
  Sparkles,
  Eye,
  Sliders,
  Check,
  RefreshCw,
  X,
  FileArchive,
  Layers,
  ZoomIn,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info
} from 'lucide-react';

import {
  FrameSettings,
  FRAME_STYLES,
  MAT_PRESETS,
  ASPECT_RATIOS,
  RESOLUTION_PRESETS,
  renderFramedPhoto,
  canvasToBlob,
  loadImage,
  isLightColor
} from './utils/frameProcessor';
import { OfflineIndicator } from './components/OfflineIndicator';

interface SelectedFileItem {
  id: string;
  name: string;
  url: string;
  size: number;
  width?: number;
  height?: number;
  file?: File;
  processedBlob?: Blob;
  processedUrl?: string;
  processedWidth?: number;
  processedHeight?: number;
  status: 'idle' | 'processing' | 'done' | 'error';
  errorMsg?: string;
}

export default function App() {
  // Application State
  const [files, setFiles] = useState<SelectedFileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('Ready');
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'controls' | 'preview' | 'queue'>('controls');

  // Cancel ref for batch
  const cancelBatchRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Frame Settings State
  const [settings, setSettings] = useState<FrameSettings>({
    style: 1, // 1 to 6
    matColor: '#FFFFFF',
    marginPct: 10,
    caption: '',
    fontFamily: 'sans-serif',
    aspectChoice: 0, // Original
    doSharpen: true,
    resLimit: 0, // 4K UHD
    exportFormat: 'image/jpeg',
    exportQuality: 0.92,
  });

  // Live Preview Canvas State
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [previewDim, setPreviewDim] = useState<{ w: number; h: number } | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // Active file helper
  const activeFile = files.find((f) => f.id === activeFileId) || files[0] || null;

  // Update Margin Preset when Style Changes (Matching PowerShell styleDefaults: 1=10, 2=10, 3=6, 4=8, 5=6, 6=5)
  const handleStyleChange = (styleId: number) => {
    const defaultMargin = FRAME_STYLES.find((s) => s.id === styleId)?.defaultMargin || 10;
    setSettings((prev) => ({
      ...prev,
      style: styleId,
      marginPct: defaultMargin,
    }));
  };

  // Live Preview Rendering Trigger
  useEffect(() => {
    let isCancelled = false;

    async function updatePreview() {
      if (!activeFile) {
        setPreviewDim(null);
        return;
      }

      setIsRenderingPreview(true);
      try {
        const canvas = await renderFramedPhoto(activeFile.url, settings, true);
        if (isCancelled) return;

        if (previewCanvasRef.current) {
          const displayCtx = previewCanvasRef.current.getContext('2d');
          if (displayCtx) {
            previewCanvasRef.current.width = canvas.width;
            previewCanvasRef.current.height = canvas.height;
            displayCtx.drawImage(canvas, 0, 0);
            setPreviewDim({ w: canvas.width, h: canvas.height });
          }
        }
      } catch (err) {
        console.error('Preview render error:', err);
      } finally {
        if (!isCancelled) setIsRenderingPreview(false);
      }
    }

    const timer = setTimeout(updatePreview, 60);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeFile, settings]);

  // Handle Local Image Uploads
  const handleFilesAdded = (uploadedFiles: FileList | File[]) => {
    const newItems: SelectedFileItem[] = [];

    Array.from(uploadedFiles).forEach((file, i) => {
      if (!file.type.startsWith('image/')) return;

      const objUrl = URL.createObjectURL(file);
      const id = `upload-${Date.now()}-${i}`;
      newItems.push({
        id,
        name: file.name,
        url: objUrl,
        size: file.size,
        file,
        status: 'idle',
      });
    });

    if (newItems.length > 0) {
      setFiles((prev) => [...newItems, ...prev]);
      setActiveFileId(newItems[0].id);
      setStatusText(`Added ${newItems.length} photo(s)`);
      if (window.innerWidth < 768) {
        setMobileTab('preview');
      }
    }
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  // Remove File
  const handleRemoveFile = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFiles((prev) => {
      const remaining = prev.filter((f) => f.id !== id);
      if (activeFileId === id && remaining.length > 0) {
        setActiveFileId(remaining[0].id);
      }
      return remaining;
    });
  };

  // Clear All
  const handleClearAll = () => {
    setFiles([]);
    setActiveFileId(null);
    setPreviewDim(null);
    setStatusText('Ready');
  };

// Batch Processing Engine
  const runBatchProcessing = async () => {
    if (files.length === 0) return;

    setIsProcessingBatch(true);
    cancelBatchRef.current = false;
    setBatchProgress(0);
    setStatusText(`Starting batch framing of ${files.length} photos...`);

    let completedCount = 0;
    const updatedFiles = [...files];

    for (let i = 0; i < updatedFiles.length; i++) {
      if (cancelBatchRef.current) {
        setStatusText(`Batch cancelled. ${completedCount} photo(s) processed.`);
        break;
      }

      const item = updatedFiles[i];
      item.status = 'processing';
      setFiles([...updatedFiles]);
      setStatusText(`Framing (${i + 1}/${updatedFiles.length}): ${item.name}`);
      setBatchProgress(Math.round(((i + 1) / updatedFiles.length) * 100));

      try {
        const fullCanvas = await renderFramedPhoto(item.url, settings, false);
        const blob = await canvasToBlob(fullCanvas, settings.exportFormat, settings.exportQuality);
        const processedUrl = URL.createObjectURL(blob);

        item.processedBlob = blob;
        item.processedUrl = processedUrl;
        item.processedWidth = fullCanvas.width;
        item.processedHeight = fullCanvas.height;
        item.status = 'done';
        completedCount++;
      } catch (err) {
        console.error(`Failed to process ${item.name}:`, err);
        item.status = 'error';
        item.errorMsg = String(err);
      }

      setFiles([...updatedFiles]);
    }

    setIsProcessingBatch(false);
    if (!cancelBatchRef.current) {
      setStatusText(`Complete! ${completedCount} photo(s) framed and ready.`);

      // Automatically trigger save/download upon completion
      if (completedCount > 0) {
        if (updatedFiles.length === 1 && updatedFiles[0].processedBlob) {
          // Single photo auto-download
          const link = document.createElement('a');
          link.download = `framed-${updatedFiles[0].name}`;
          link.href = updatedFiles[0].processedUrl || URL.createObjectURL(updatedFiles[0].processedBlob);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else if (updatedFiles.length > 1) {
          // Multi-photo batch auto-download as ZIP
          handleDownloadZip(); 
        }
      }
    }
  };
  // Single File Download
  const downloadSinglePhoto = async (item: SelectedFileItem) => {
    try {
      let blob = item.processedBlob;
      if (!blob) {
        setStatusText(`Generating full resolution for ${item.name}...`);
        const canvas = await renderFramedPhoto(item.url, settings, false);
        blob = await canvasToBlob(canvas, settings.exportFormat, settings.exportQuality);
      }

      const ext = settings.exportFormat === 'image/png' ? 'png' : settings.exportFormat === 'image/webp' ? 'webp' : 'jpg';
      const cleanName = item.name.replace(/\.[^/.]+$/, '');
      const downloadName = `${cleanName}_framed.${ext}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusText(`Downloaded ${downloadName}`);
    } catch (err) {
      console.error('Download error:', err);
      setStatusText(`Error downloading: ${err}`);
    }
  };

  // Download All as ZIP (For mobile and desktop)
  const downloadAllAsZip = async () => {
    if (files.length === 0) return;

    setStatusText('Packaging all framed photos into ZIP archive...');
    const zip = new JSZip();
    const ext = settings.exportFormat === 'image/png' ? 'png' : settings.exportFormat === 'image/webp' ? 'webp' : 'jpg';

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      let blob = item.processedBlob;
      if (!blob) {
        const canvas = await renderFramedPhoto(item.url, settings, false);
        blob = await canvasToBlob(canvas, settings.exportFormat, settings.exportQuality);
      }
      const cleanName = item.name.replace(/\.[^/.]+$/, '');
      zip.file(`${cleanName}_framed.${ext}`, blob);
    }

    const zipContent = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipContent);
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = `framed_photos_batch_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(zipUrl);
    setStatusText('ZIP archive downloaded successfully!');
  };

  // Android Native Web Share API (Share directly to WhatsApp, Instagram, Google Photos, Files)
  const shareCurrentPhoto = async () => {
    if (!activeFile) return;

    try {
      let blob = activeFile.processedBlob;
      if (!blob) {
        setStatusText(`Rendering image for sharing...`);
        const canvas = await renderFramedPhoto(activeFile.url, settings, false);
        blob = await canvasToBlob(canvas, settings.exportFormat, settings.exportQuality);
      }

      const ext = settings.exportFormat === 'image/png' ? 'png' : settings.exportFormat === 'image/webp' ? 'webp' : 'jpg';
      const cleanName = activeFile.name.replace(/\.[^/.]+$/, '');
      const shareFile = new File([blob], `${cleanName}_framed.${ext}`, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
        await navigator.share({
          title: 'Framed Photo',
          text: settings.caption || '...',
          files: [shareFile],
        });
        setStatusText('Shared successfully via Android!');
      } else if (navigator.share) {
        await navigator.share({
          title: 'Framed Photo',
          text: '...',
          url: window.location.href,
        });
      } else {
        downloadSinglePhoto(activeFile);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Share error:', err);
        setStatusText('Sharing cancelled or not supported; downloaded instead.');
      }
    }
  };

  const processedCount = files.filter((f) => f.status === 'done').length;

  return (
    <div className="min-h-screen bg-[#121214] text-[#F4F4F5] flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Offline Toast */}
      <OfflineIndicator />

      {/* Top Header */}
      <header className="border-b border-zinc-800 bg-[#161619] sticky top-0 z-40 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Logo & App Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-900/40 border border-blue-400/30">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white uppercase">
                  Photo Frame Batch Processor
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 border border-blue-500/40 text-blue-400">
                  Pro v2.2
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span>WPF &amp; Web Parity</span>
                <span className="text-zinc-600">•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Client Hardware-Accelerated
                </span>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* Mobile Tab Switcher (Visible on small screens) */}
      <div className="md:hidden flex border-b border-zinc-800 bg-[#161619] px-3 pt-2 text-xs font-semibold">
        <button
          onClick={() => setMobileTab('controls')}
          className={`flex-1 pb-2.5 text-center border-b-2 flex items-center justify-center gap-1.5 ${
            mobileTab === 'controls'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-400'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Settings &amp; Files
        </button>
        <button
          onClick={() => setMobileTab('preview')}
          className={`flex-1 pb-2.5 text-center border-b-2 flex items-center justify-center gap-1.5 ${
            mobileTab === 'preview'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-400'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Live Preview
        </button>
        <button
          onClick={() => setMobileTab('queue')}
          className={`flex-1 pb-2.5 text-center border-b-2 flex items-center justify-center gap-1.5 ${
            mobileTab === 'queue'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-400'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Queue ({files.length})
        </button>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-3 sm:p-5 flex-1 flex flex-col gap-4">
        
        {/* Two-Column Workspace on Desktop, Tabbed on Mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
          
          {/* LEFT COLUMN: Controls & Upload (7 cols on Desktop) */}
          <div className={`lg:col-span-7 flex flex-col gap-4 ${mobileTab !== 'controls' ? 'hidden md:flex' : 'flex'}`}>
            
            {/* Drag & Drop Upload Zone (Matching WPF style) */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-4 sm:p-6 text-center transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-950/20 scale-[0.99]'
                  : 'border-zinc-700 hover:border-zinc-500 bg-[#18181B]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/tiff"
                className="hidden"
                onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
              />

              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <FolderOpen className="w-6 h-6" />
                </div>
                
                <h3 className="text-sm font-bold text-zinc-100">
                  Drag &amp; Drop Photos or Folders Here
                </h3>
                <p className="text-xs text-zinc-400">
                  {files.length > 0
                    ? `${files.length} photo(s) in queue (JPG, PNG, WEBP, TIFF)`
                    : 'No files selected • High resolution camera prints supported'}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 cursor-pointer shadow-sm transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-400" />
                    Select Photos Manually
                  </button>

                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 cursor-pointer shadow-sm transition sm:hidden"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    Snap Photo
                  </button>
                </div>
              </div>
            </div>

            {/* Thumbnail Strip / Active Photo Selector */}
            {files.length > 0 && (
              <div className="p-3 bg-[#18181B] border border-zinc-800 rounded-xl">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                    Queue ({files.length} files) — Tap to preview:
                  </span>
                  <button
                    onClick={handleClearAll}
                    className="text-zinc-500 hover:text-rose-400 flex items-center gap-1 text-[11px] transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear All
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {files.map((file) => {
                    const isActive = file.id === (activeFile?.id ?? '');
                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          setActiveFileId(file.id);
                          if (window.innerWidth < 768) setMobileTab('preview');
                        }}
                        className={`group relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 cursor-pointer transition ${
                          isActive
                            ? 'border-blue-500 ring-2 ring-blue-500/30'
                            : 'border-zinc-800 hover:border-zinc-600 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={(e) => handleRemoveFile(file.id, e)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-zinc-300 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
                          title="Remove from batch"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {file.status === 'done' && (
                          <div className="absolute bottom-1 right-1 p-0.5 rounded-full bg-emerald-600 text-white shadow">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/75 px-1 py-0.5 text-[9px] text-zinc-300 truncate">
                          {file.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Options Panel (Matching PowerShell Controls Panel) */}
            <div className="bg-[#18181B] border border-zinc-800 rounded-xl p-4 sm:p-5 space-y-4">
              
              {/* 1. Frame Style Selection */}
              <div>
                <label className="text-xs font-bold text-zinc-200 tracking-wide block mb-1.5 uppercase">
                  Select Frame Style:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FRAME_STYLES.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => handleStyleChange(st.id)}
                      className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer flex flex-col gap-0.5 ${
                        settings.style === st.id
                          ? 'border-blue-500 bg-blue-950/30 text-white font-semibold'
                          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{st.name}</span>
                        {settings.style === st.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-normal">{st.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-zinc-800/80 my-2" />

              {/* 2. Mat Shade & Margin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Mat Shade */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                    Mat Shade:
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {MAT_PRESETS.map((color) => {
                      const isSelected = settings.matColor.toUpperCase() === color.hex.toUpperCase();
                      return (
                        <button
                          key={color.hex}
                          onClick={() => setSettings((prev) => ({ ...prev, matColor: color.hex }))}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                          className={`w-6 h-6 rounded-md border transition cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 ring-2 ring-blue-500/50 scale-110'
                              : 'border-zinc-600 hover:border-zinc-400'
                          }`}
                        />
                      );
                    })}

                    {/* Custom Hex Color input */}
                    <div className="flex items-center border border-zinc-700 rounded-md bg-zinc-900 overflow-hidden pl-1 ml-1">
                      <input
                        type="color"
                        value={settings.matColor}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, matColor: e.target.value.toUpperCase() }))
                        }
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                      <input
                        type="text"
                        value={settings.matColor}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, matColor: e.target.value }))
                        }
                        className="w-16 bg-transparent text-[11px] text-zinc-100 font-mono px-1 py-1 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Mat Margin Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-zinc-400">Mat Margin:</span>
                    <span className="text-blue-400 font-bold">{settings.marginPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="25"
                    step="1"
                    value={settings.marginPct}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, marginPct: Number(e.target.value) }))
                    }
                    className="w-full accent-blue-600 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                    <span>2% (Thin)</span>
                    <span>10% (Classic)</span>
                    <span>25% (Museum)</span>
                  </div>
                </div>
              </div>

              {/* 3. Title / Signature & Aspect Ratio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Caption / Signature */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">
                    Bottom Mat Title / Signature:
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. PARIS • 2026 or Signature"
                      value={settings.caption}
                      onChange={(e) => setSettings((prev) => ({ ...prev, caption: e.target.value }))}
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-hidden focus:border-blue-500"
                    />
                    <select
                      value={settings.fontFamily}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, fontFamily: e.target.value }))
                      }
                      className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="sans-serif">Clean Sans</option>
                      <option value="serif">Classic Serif</option>
                      <option value="monospace">Mono</option>
                      <option value="cursive">Signature</option>
                    </select>
                  </div>
                </div>

                {/* Target Canvas Ratio */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">
                    Target Canvas Ratio:
                  </label>
                  <select
                    value={settings.aspectChoice}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, aspectChoice: Number(e.target.value) }))
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-blue-500"
                  >
                    {ASPECT_RATIOS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Sharpening & Resolution Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.doSharpen}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, doSharpen: e.target.checked }))
                    }
                    className="w-4 h-4 rounded-sm bg-zinc-900 border-zinc-700 text-blue-600 accent-blue-600 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">
                      Web-Sharp Filter
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Edge micro-contrast algorithm (-unsharp)
                    </span>
                  </div>
                </label>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">
                    Max Resolution:
                  </label>
                  <select
                    value={settings.resLimit}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, resLimit: Number(e.target.value) }))
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-blue-500"
                  >
                    {RESOLUTION_PRESETS.map((res) => (
                      <option key={res.id} value={res.id}>
                        {res.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: Live Preview Pane (5 cols on Desktop) */}
          <div className={`lg:col-span-5 flex flex-col gap-4 ${mobileTab !== 'preview' ? 'hidden md:flex' : 'flex'}`}>
            
            <div className="bg-[#18181B] border border-zinc-800 rounded-xl p-4 sm:p-5 flex-1 flex flex-col">
              
              {/* Preview Header */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Live Preview
                  </span>
                  {isRenderingPreview && (
                    <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                  )}
                </div>

                {previewDim && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                    {previewDim.w} &times; {previewDim.h} px
                  </span>
                )}
              </div>

              {/* Canvas Preview Container */}
              <div className="flex-1 min-h-[340px] sm:min-h-[420px] bg-[#0A0A0C] border border-zinc-900 rounded-lg relative overflow-hidden flex items-center justify-center p-3">
                
                {activeFile ? (
                  <div className="relative max-w-full max-h-full flex items-center justify-center shadow-2xl">
                    {/* Rendered Frame Canvas */}
                    <canvas
                      ref={previewCanvasRef}
                      className="max-h-[380px] sm:max-h-[460px] w-auto h-auto max-w-full object-contain rounded-xs shadow-lg transition-transform"
                    />

                    {/* Quick overlay controls */}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 hover:opacity-100">
                      <button
                        onClick={shareCurrentPhoto}
                        className="p-1.5 rounded-md bg-black/60 hover:bg-black/90 text-white backdrop-blur-xs transition"
                        title="Share this photo via Android"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => activeFile && downloadSinglePhoto(activeFile)}
                        className="p-1.5 rounded-md bg-black/60 hover:bg-black/90 text-white backdrop-blur-xs transition"
                        title="Download this photo"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 text-zinc-500 text-xs">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <span>No photo selected for preview</span>
                  </div>
                )}

              </div>

              {/* Preview Footer / Status */}
              <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
                <span className="truncate pr-2">
                  {activeFile ? `Previewing: ${activeFile.name}` : 'Ready'}
                </span>
                <span className="text-zinc-500 shrink-0">Updates live</span>
              </div>

            </div>

          </div>

          {/* MOBILE TAB 3: Queue List (Visible when mobile queue tab is chosen) */}
          <div className={`lg:hidden flex-col gap-4 ${mobileTab === 'queue' ? 'flex' : 'hidden'}`}>
            <div className="bg-[#18181B] border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-white uppercase">Batch Queue ({files.length})</h3>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-2">
                {files.map((file, idx) => (
                  <div
                    key={file.id}
                    onClick={() => {
                      setActiveFileId(file.id);
                      setMobileTab('preview');
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer ${
                      activeFile?.id === file.id
                        ? 'border-blue-500 bg-blue-950/20'
                        : 'border-zinc-800 bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                      <div className="truncate">
                        <span className="text-xs text-white block truncate">{file.name}</span>
                        <span className="text-[10px] text-zinc-500">
                          {file.status === 'done' ? (
                            <span className="text-emerald-400">Framed &bull; Ready</span>
                          ) : (
                            'Pending frame'
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadSinglePhoto(file);
                        }}
                        className="p-1.5 rounded text-zinc-400 hover:text-white"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleRemoveFile(file.id, e)}
                        className="p-1.5 rounded text-zinc-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Action Panel & Progress Bar (Matching PowerShell buttons & status bar) */}
        <div className="bg-[#18181B] border border-zinc-800 rounded-xl p-4 sm:p-5 space-y-3 shadow-lg">
          
          {/* Action Button Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Primary Process Button */}
            <button
              onClick={runBatchProcessing}
              disabled={isProcessingBatch || files.length === 0}
              className={`flex-1 min-w-[200px] h-11 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md ${
                isProcessingBatch || files.length === 0
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 active:scale-98 text-white'
              }`}
            >
              {isProcessingBatch ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Batch...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Apply Frame &amp; Export Batch ({files.length})</span>
                </>
              )}
            </button>

            {/* Cancel Button */}
            <button
              onClick={() => {
                cancelBatchRef.current = true;
                setStatusText('Cancelling batch after current item...');
              }}
              disabled={!isProcessingBatch}
              className={`h-11 px-4 rounded-lg font-semibold text-xs transition ${
                isProcessingBatch
                  ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                  : 'bg-zinc-800/80 text-zinc-600 cursor-not-allowed'
              }`}
            >
              Cancel
            </button>

            {/* Download ZIP Button */}
            <button
              onClick={downloadAllAsZip}
              disabled={files.length === 0}
              className="h-11 px-4 rounded-lg font-semibold text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-2 transition cursor-pointer"
              title="Download all framed photos as a .zip file"
            >
              <FileArchive className="w-4 h-4 text-amber-400" />
              <span>Download ZIP</span>
            </button>

            {/* Web Share Button */}
            <button
              onClick={shareCurrentPhoto}
              disabled={!activeFile}
              className="h-11 px-4 rounded-lg font-semibold text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-2 transition cursor-pointer"
              title="Share photo directly to other apps"
            >
              <Share2 className="w-4 h-4 text-emerald-400" />
              <span>Share Photo</span>
            </button>

            {/* Clear All */}
            <button
              onClick={handleClearAll}
              disabled={files.length === 0 || isProcessingBatch}
              className="h-11 px-4 rounded-lg font-semibold text-xs bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer"
            >
              Clear All
            </button>

          </div>

          {/* Progress Bar & Status Text */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${batchProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span className="flex items-center gap-1.5">
                {isProcessingBatch && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                )}
                <span>{statusText}</span>
              </span>
              <span>{batchProgress}%</span>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
