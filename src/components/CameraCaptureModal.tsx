import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCw, Check, RotateCcw, X, AlertTriangle, Upload } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Data: string) => void;
  title: string;
}

export default function CameraCaptureModal({ isOpen, onClose, onCapture, title }: CameraCaptureModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true); // Mirrored mirror view is natural for users

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async (deviceId?: string) => {
    setIsStartingCamera(true);
    setCameraError('');
    setCapturedImage(null);

    // Stop existing stream tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("L'appareil photo n'est pas pris en charge par ce navigateur ou cet environnement (requiert HTTPS).");
      setIsStartingCamera(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { facingMode: 'environment' } // Default to back camera for product inspection
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // Enumerate available devices for camera flipping
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoInputs);

      // Auto mirror off if it looks like a back/external camera
      const activeTrack = newStream.getVideoTracks()[0];
      if (activeTrack) {
        const label = activeTrack.label.toLowerCase();
        // If back camera is detected, turn off mirroring
        if (label.includes('back') || label.includes('rear') || label.includes('environ')) {
          setIsMirrored(false);
        }
        
        const settings = activeTrack.getSettings();
        if (settings.deviceId) {
          setSelectedDeviceId(settings.deviceId);
        }
      }
    } catch (err: any) {
      console.error("Camera connection error:", err);
      // Try fallback with user facing if environment failed on desktop
      if (!deviceId) {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setStream(fallbackStream);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          setDevices(allDevices.filter(d => d.kind === 'videoinput'));
          
          const activeTrack = fallbackStream.getVideoTracks()[0];
          if (activeTrack) {
            const settings = activeTrack.getSettings();
            if (settings.deviceId) {
              setSelectedDeviceId(settings.deviceId);
            }
          }
          return;
        } catch (innerErr) {
          console.error("Fallback camera error:", innerErr);
        }
      }

      setCameraError(
        "Accès à l'appareil photo refusé ou indisponible. Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur."
      );
    } finally {
      setIsStartingCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCapturedImage(null);
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    startCamera(deviceId);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Handle mirroring if enabled
        if (isMirrored) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        
        ctx.drawImage(video, 0, 0, width, height);
        
        // Reset scale/transform
        if (isMirrored) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const toggleMirror = () => {
    setIsMirrored(!isMirrored);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 select-none bg-slate-900/80 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600 animate-pulse" />
            <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-widest leading-none">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col justify-center items-center bg-slate-950 text-white min-h-[320px] relative">
          
          {cameraError ? (
            <div className="flex flex-col items-center justify-center text-center p-4 max-w-sm gap-4">
              <AlertTriangle className="w-12 h-12 text-amber-500 animate-bounce" />
              <div>
                <p className="text-sm font-bold text-slate-200 mb-1">
                  Accès caméra indisponible
                </p>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  {cameraError}
                </p>
              </div>
              
              {/* Fallback Photo Upload Area */}
              <div className="border-t border-slate-800 pt-4 mt-2 w-full flex flex-col items-center gap-3">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Alternative : Charger un fichier
                </p>
                <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 hover:scale-101 border-none text-xs font-bold text-white rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span>Choisir depuis l'appareil</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          onCapture(reader.result as string);
                          onClose();
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : capturedImage ? (
            /* Review captured image */
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <div className="relative rounded-2xl overflow-hidden border-2 border-green-500 shadow-md max-h-[45vh] bg-black flex items-center justify-center">
                <img
                  src={capturedImage}
                  alt="Review capture"
                  className="max-h-[45vh] object-contain max-w-full"
                />
                <span className="absolute top-3 left-3 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                  Photo Capturée
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Voulez-vous utiliser cette photo ?
              </p>
            </div>
          ) : (
            /* Camera Live Feed */
            <div className="w-full h-full flex flex-col items-center justify-center relative">
              {isStartingCamera && (
                <div className="absolute inset-0 z-10 bg-slate-950/90 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="text-xs font-bold text-slate-400">Initialisation de la caméra...</span>
                </div>
              )}
              
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black w-full min-h-[220px] max-h-[50vh] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-[50vh] object-cover rounded-2xl"
                  style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
                />
                <span className="absolute top-3 left-3 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shadow">
                  Direct Caméra
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 text-xs">
          
          {/* Leftside selectors/options */}
          {!cameraError && !capturedImage && (
            <div className="flex items-center gap-2 flex-1 max-w-[50%]">
              {devices.length > 1 && (
                <div className="relative flex-1">
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className="w-full bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-lg py-1 px-2.5 font-bold outline-none leading-tight appearance-none text-[10px] uppercase tracking-wider"
                  >
                    {devices.map((device, idx) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        📷 Caméra {idx + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={toggleMirror}
                className="text-[10px] font-extrabold text-slate-500 hover:text-blue-600 uppercase tracking-widest shrink-0 hover:underline select-none cursor-pointer"
                title="Inverser le sens de l'affichage miroir"
              >
                {isMirrored ? "Miroir : Actif" : "Miroir : Inactif"}
              </button>
            </div>
          )}

          {/* Spacer if left items are absent */}
          {(cameraError || capturedImage) && <div className="flex-1" />}

          {/* Right action controls */}
          <div className="flex items-center gap-2">
            {capturedImage ? (
              <>
                <button
                  type="button"
                  onClick={() => setCapturedImage(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reprendre</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Valider</span>
                </button>
              </>
            ) : !cameraError ? (
              <button
                type="button"
                disabled={isStartingCamera}
                onClick={capturePhoto}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 hover:scale-102 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Prendre la photo</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
