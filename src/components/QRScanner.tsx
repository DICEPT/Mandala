// src/components/QRScanner.tsx
import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const QRScanner = ({ onScan }: { onScan: (text: string) => void }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      (text: string) => {
        onScan(text);
        scanner.clear(); // 스캔하면 정지
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err: any) => {
        console.warn('스캔 오류:', err);
      }
    );

    return () => {
      scanner.clear().catch(() => {}); // unmount cleanup
    };
  }, [onScan]);

  return <div id="reader" className="w-full max-w-md mx-auto" />;
};

export default QRScanner;
