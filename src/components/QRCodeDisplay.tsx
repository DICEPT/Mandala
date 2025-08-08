import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface Props {
  value: string;
}

export default function QRCodeDisplay({ value }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${value}_QR.png`;
    link.click();
  };

  return (
    <div style={{ display: "flex", textAlign: "center" }}>
      <QRCodeCanvas
        value={value}
        size={50}
        includeMargin
        ref={canvasRef}
      />
      <br />
      <button onClick={handleDownload}>QR 다운로드</button>
    </div>
  );
}
