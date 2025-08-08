import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Product } from "../types/Product";

type ProductWithId = Product & { id: string };

export default function LowStockPage() {
  const [lowStockProducts, setLowStockProducts] = useState<ProductWithId[]>([]);
  const threshold = 50; // 50 이하면 '주문필요 리스트'에 표시

  useEffect(() => {
    const fetchProducts = async () => {
      const snapshot = await getDocs(collection(db, "products"));
      const products: ProductWithId[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProductWithId[];

      const filtered = products.filter((product) => {
        const stock = getStockCount(product);
        return stock <= threshold;
      });

      setLowStockProducts(filtered);
    };

    fetchProducts();
  }, []);

  const getStockCount = (product: ProductWithId): number => {
    const totalIn =
      product.입고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    const totalOut =
      product.출고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    return totalIn - totalOut;
  };

  const getStockStatus = (stock: number): string => {
    if (stock === 0) return "없음";
    if (stock <= 20) return "주문필요";
    return "보통";
  };

  return (
    <div>
      <h2>📦 주문필요 리스트</h2>
      <ul style={{ padding: 0, listStyle: "none" }}>
        {lowStockProducts.map((p) => {
          const stock = getStockCount(p);
          const status = getStockStatus(stock);

          return (
            <li
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "8px 0",
                borderBottom: "1px solid #ddd",
              }}
            >
              {p.사진이력?.[0]?.경로 && (
                <img src={p.사진이력[0].경로} alt="상품 이미지" width={80} />
              )}
              <div>
                {p.상품번호} : <strong>{p.상품명}</strong>
                <br />
                재고: {stock}개 → <strong>{status}</strong>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
