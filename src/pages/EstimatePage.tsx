import { useState, useEffect } from "react";
import printJS from "print-js";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Product } from "../types/Product";

interface EstimateItem {
  no: number;
  productId: string;
  name: string;
  size: string;
  qty: number;
  price: number;
  amount: number;
  note: string;
}

interface Estimate {
  createdAt: Timestamp;
  items: EstimateItem[];
  total: number;
}

export default function EstimatePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<EstimateItem[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const snapshot = await getDocs(collection(db, "products"));
      const data = snapshot.docs.map((doc) => {
        const raw = doc.data() as Omit<Product, "id">;
        return { id: doc.id, ...raw };
      });

      setProducts(data);
    };
    fetchProducts();
  }, []);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
      no: prev.length + 1,
      productId: "",
      name: "",
      size: "",
      qty: 1,
      price: 0,
      amount: 0,
      note: "",
      },
    ]);
  };

  const handleChange = <K extends keyof EstimateItem>(
    index: number,
    key: K,
    value: EstimateItem[K]
  ) => {
    const updatedItems = [...items];
    const item = { ...updatedItems[index] };

if (key === "productId") {
  const product = products.find((p) => p.상품번호 === value);
  if (product) {
    const nameParts = [
      product.상품명?.trim(),
      product.상품_카테고리2?.trim(),
      product.알사이즈 ? `${product.알사이즈}` : null,
    ].filter(Boolean);

    item.productId = product.상품번호 ?? "";
    item.name = nameParts.join("_");
    item.size = product.알사이즈 ?? "";
    item.price = product.단가이력?.[product.단가이력.length - 1]?.금액 || 0;
    item.amount = item.qty * item.price;
  }
} else {
      item[key] = value;
      if (key === "qty" || key === "price") {
        item.amount = item.qty * item.price;
      }
    }

    updatedItems[index] = item;
    setItems(updatedItems);
  };

  const handleSaveEstimate = async () => {
    if (items.length === 0) return alert("견적 항목이 없습니다.");

    const data: Estimate = {
      createdAt: serverTimestamp() as Timestamp,
      items,
      total: items.reduce((sum, item) => sum + item.amount, 0),
    };

    await addDoc(collection(db, "estimates"), data);
    alert("견적서 저장 완료");
    setItems([]);
  };

  const handlePrint = () => {
    printJS({ printable: "estimate-print", type: "html", targetStyles: ["*"] });
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-4 print:hidden">
        <button
          onClick={handleAddItem}
          className="bg-green-600 text-white px-3 py-2 rounded"
        >
          항목 추가
        </button>
        <button
          onClick={handleSaveEstimate}
          className="bg-yellow-600 text-white px-3 py-2 rounded"
        >
          저장
        </button>
        <button
          onClick={handlePrint}
          className="bg-blue-600 text-white px-3 py-2 rounded"
        >
          인쇄
        </button>
      </div>

      <div id="estimate-print" className="p-10 text-sm">
        <div className="text-center text-xl font-bold mb-4">입고명세서</div>

        <table className="w-full border border-black border-collapse mb-4">
          <thead>
            <tr className="bg-gray-100 text-black">
              <th className="border border-black px-2 py-1">NO</th>
              <th className="border border-black px-2 py-1">상품번호</th>
              <th className="border border-black px-2 py-1">상품명</th>
              <th className="border border-black px-2 py-1">수량</th>
              <th className="border border-black px-2 py-1">단가</th>
              <th className="border border-black px-2 py-1">공급가액</th>
              <th className="border border-black px-2 py-1">비고</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td className="border border-black px-2 py-1 text-center">
                  {i + 1}
                </td>
                <td className="border border-black px-2 py-1">
                  <select
                    value={item.productId}
                    onChange={(e) =>
                      handleChange(i, "productId", e.target.value)
                    }
                    className="w-full"
                  >
                    <option value="">선택</option>
                    {products.map((p) => (
                      <option key={p.상품번호} value={p.상품번호}>
                        {p.상품번호} - {p.상품명}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border border-black px-2 py-1">
                  {/* <input
                    value={item.size}
                    onChange={(e) => handleChange(i, "size", e.target.value)}
                    className="w-full"
                  /> */}
                  {item.name}
                </td>
                <td className="border border-black px-2 py-1">
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) =>
                      handleChange(i, "qty", Number(e.target.value))
                    }
                    className="w-full text-right"
                  />
                </td>
                <td className="border border-black px-2 py-1 text-right">
                  {item.price.toLocaleString()}
                </td>
                <td className="border border-black px-2 py-1 text-right">
                  {item.amount.toLocaleString()}
                </td>
                <td className="border border-black px-2 py-1">
                  <input
                    value={item.note}
                    onChange={(e) => handleChange(i, "note", e.target.value)}
                    className="w-full"
                  />
                </td>
              </tr>
            ))}
            {[...Array(Math.max(0, 15 - items.length))].map((_, idx) => (
              <tr key={`empty-${idx}`}>
                <td className="border border-black px-2 py-1">
                  {items.length + idx + 1}
                </td>
                <td className="border border-black px-2 py-1" colSpan={6}></td>
              </tr>
            ))}
            <tr>
              <td
                className="border border-black px-2 py-1 text-center"
                colSpan={5}
              >
                합계
              </td>
              <td className="border border-black px-2 py-1 text-right font-bold">
                {items
                  .reduce((sum, item) => sum + item.amount, 0)
                  .toLocaleString()}
              </td>
              <td className="border border-black px-2 py-1"></td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6">
          담당자: 김홍준 | H.P: 010-4272-6763 | 전화: 02-446-2901 | FAX:
          0303-0303-2990
        </div>
      </div>
    </div>
  );
}
