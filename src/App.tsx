import { useState } from 'react';
import QRScanner from './components/QRScanner';

interface Product {
  code: string;
  name: string;
  stock: number;
}

function App() {
  const [scannedCode, setScannedCode] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductStock, setNewProductStock] = useState(1);

  const handleScan = (code: string) => {
    setScannedCode(code);
  };

  const handleRegister = () => {
    if (!scannedCode || !newProductName) return alert('모든 값을 입력해주세요.');
    const newProduct: Product = {
      code: scannedCode,
      name: newProductName,
      stock: newProductStock,
    };
    setProducts((prev) => [...prev, newProduct]);
    setScannedCode('');
    setNewProductName('');
    setNewProductStock(1);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">QR 재고 관리 시스템</h1>

      <div className="border p-4 rounded">
        <h2 className="font-semibold mb-2">📷 QR 바코드 스캔</h2>
        <QRScanner onScan={handleScan} />
        <p className="mt-2">스캔된 코드: {scannedCode}</p>
      </div>

      <div className="border p-4 rounded">
        <h2 className="font-semibold mb-2">📝 상품 등록</h2>
        <input
          type="text"
          placeholder="상품명"
          value={newProductName}
          onChange={(e) => setNewProductName(e.target.value)}
          className="border px-2 py-1 mr-2"
        />
        <input
          type="number"
          min={1}
          value={newProductStock}
          onChange={(e) => setNewProductStock(Number(e.target.value))}
          className="border px-2 py-1 mr-2 w-20"
        />
        <button onClick={handleRegister} className="bg-blue-500 text-white px-4 py-1 rounded">
          등록
        </button>
      </div>

      <div className="border p-4 rounded">
        <h2 className="font-semibold mb-2">📦 등록된 상품</h2>
        <ul className="space-y-1">
          {products.map((item, idx) => (
            <li key={idx} className="border p-2 rounded">
              <strong>{item.name}</strong> (코드: {item.code}, 수량: {item.stock})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
