import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

/**
 * 바코드/QR 스캐너 모달
 *
 * Props:
 *   isOpen   - 모달 열림 여부
 *   onClose  - 닫기 콜백
 *   onScan   - (decodedText) => void — 코드 스캔 성공 시 호출
 *   title    - 모달 제목 (기본 '바코드 스캔')
 */
const BarcodeScannerModal = ({ isOpen, onClose, onScan, title = '바코드 / QR 스캔' }) => {
    const scannerRef = useRef(null);
    const html5QrCodeRef = useRef(null);
    const [error, setError] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [lastScanned, setLastScanned] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;

        const start = async () => {
            try {
                setError('');
                setLastScanned('');

                // 카메라 목록 조회
                const cameras = await Html5Qrcode.getCameras();
                if (!cameras || cameras.length === 0) {
                    setError('사용 가능한 카메라가 없습니다.');
                    return;
                }

                if (cancelled) return;

                // 후방(environment) 카메라 우선 선택
                const rearCamera = cameras.find(c =>
                    /back|rear|environment|후방/i.test(c.label || '')
                ) || cameras[cameras.length - 1];

                const html5QrCode = new Html5Qrcode('barcode-scanner-region');
                html5QrCodeRef.current = html5QrCode;

                await html5QrCode.start(
                    rearCamera.id,
                    {
                        fps: 10,
                        qrbox: { width: 280, height: 180 },
                        aspectRatio: 1.5
                    },
                    (decodedText) => {
                        // 중복 스캔 방지 — 같은 코드 연속 스캔 시 1초 무시
                        if (decodedText === lastScanned) return;
                        setLastScanned(decodedText);
                        if (onScan) onScan(decodedText);
                    },
                    () => { /* 무시 — 매 프레임 호출됨 */ }
                );

                setIsScanning(true);
            } catch (err) {
                console.error('카메라 시작 실패:', err);
                setError(err?.message || '카메라를 시작할 수 없습니다. 권한을 확인하세요.');
            }
        };

        // 모달 DOM 렌더링 후 시작 (약간 지연)
        const timer = setTimeout(start, 300);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            if (html5QrCodeRef.current) {
                html5QrCodeRef.current.stop().then(() => {
                    html5QrCodeRef.current?.clear();
                    html5QrCodeRef.current = null;
                }).catch(() => { html5QrCodeRef.current = null; });
            }
            setIsScanning(false);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="scanner-overlay" onClick={onClose}>
            <div className="scanner-modal" onClick={(e) => e.stopPropagation()}>
                <div className="scanner-header">
                    <h3><Camera size={18} /> {title}</h3>
                    <button className="close-btn" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="scanner-body">
                    {error ? (
                        <div className="error-box">
                            <AlertCircle size={32} color="#dc2626" />
                            <p>{error}</p>
                            <p className="hint">HTTPS 환경에서만 카메라 사용이 가능합니다. (배포 사이트는 OK)</p>
                        </div>
                    ) : (
                        <>
                            <div id="barcode-scanner-region" ref={scannerRef} className="scanner-region" />
                            <p className="hint">
                                {isScanning ? '바코드/QR을 카메라에 비춰주세요' : '카메라 준비 중...'}
                            </p>
                            {lastScanned && (
                                <div className="last-scanned">
                                    스캔됨: <strong>{lastScanned}</strong>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <style>{`
                .scanner-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
                .scanner-modal { background: white; border-radius: 14px; width: 100%; max-width: 480px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
                .scanner-header { padding: 1rem 1.25rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                .scanner-header h3 { margin: 0; font-size: 1rem; display: flex; align-items: center; gap: 6px; }
                .close-btn { background: transparent; border: none; cursor: pointer; padding: 0.25rem; color: #64748b; }

                .scanner-body { padding: 1rem; }
                .scanner-region { width: 100%; max-width: 400px; margin: 0 auto; border-radius: 10px; overflow: hidden; background: #000; min-height: 240px; }
                .scanner-region video { width: 100% !important; height: auto !important; }

                .hint { text-align: center; color: #64748b; font-size: 0.85rem; margin: 0.85rem 0 0; }
                .last-scanned { background: #ecfdf5; color: #065f46; padding: 0.65rem 0.85rem; margin-top: 0.75rem; border-radius: 8px; text-align: center; font-size: 0.9rem; border: 1px solid #a7f3d0; }

                .error-box { padding: 2rem; text-align: center; }
                .error-box p { margin: 0.5rem 0 0; color: #475569; font-size: 0.9rem; }
                .error-box .hint { font-size: 0.8rem; color: #94a3b8; margin-top: 0.75rem; }
            `}</style>
        </div>
    );
};

export default BarcodeScannerModal;
