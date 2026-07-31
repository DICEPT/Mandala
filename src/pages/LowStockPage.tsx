import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Product } from "../types/Product";

type ProductWithId = Product & { id: string };

export default function LowStockPage() {
  const [products, setProducts] = useState<ProductWithId[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, "products"));
        const productList: ProductWithId[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ProductWithId[];

        setProducts(productList);
      } catch (error) {
        console.error("상품 불러오기 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // 재고 수량 계산
  const getStockCount = (product: ProductWithId): number => {
    const totalIn =
      product.입고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    const totalOut =
      product.출고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    return totalIn - totalOut;
  };

  // 구간별 필터링
  const outOfStock = products.filter((p) => getStockCount(p) === 0);
  const criticalStock = products.filter((p) => {
    const stock = getStockCount(p);
    return stock >= 10 && stock <= 30;
  });
  const warningStock = products.filter((p) => {
    const stock = getStockCount(p);
    return stock > 30 && stock <= 50;
  });

  // 카드리스트 렌더링 헬퍼 컴포넌트
  const renderProductCard = (
    p: ProductWithId,
    badgeColor: string,
    stockTextColor: string
  ) => {
    const stock = getStockCount(p);
    const imageUrl = p.사진이력?.at(-1)?.경로;

    return (
      <div
        key={p.id}
        className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition shadow-sm"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={p.상품명}
            className="w-14 h-14 object-cover rounded-lg border border-slate-800 bg-slate-950 shrink-0"
          />
        ) : (
<div className="w-14 h-14 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center text-slate-600 shrink-0 text-center" style={{fontSize: '8px'}}>
  NO IMG
</div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-semibold text-slate-400 truncate">
              {p.상품번호 || "번호없음"}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}
            >
              {stock === 0 ? "품절" : `${stock}개`}
            </span>
          </div>
          <h4 className="text-xs font-semibold text-slate-100 truncate">
            {p.상품명}
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            재고: <strong className={stockTextColor}>{stock}개</strong>
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 text-slate-400 text-sm">
        재고 현황 데이터를 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-slate-950 text-slate-100 min-h-screen">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-100">📦 재고 부족 현황 및 주문 필요 리스트</h1>
          <p className="text-xs text-slate-400 mt-1">
            구간별 재고 수량을 확인하여 적시에 발주를 진행하세요.
          </p>
        </div>
      </div>

      {/* 3열 대시보드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* 1열: 재고 0개 (품절) */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-rose-900/50 flex flex-col h-full">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-rose-900/40">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <h2 className="text-sm font-bold text-rose-300">1. 재고 0개 (품절)</h2>
            </div>
            <span className="text-xs font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-800">
              {outOfStock.length}건
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[70vh] pr-1">
            {outOfStock.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                품절된 상품이 없습니다. 🎉
              </div>
            ) : (
              outOfStock.map((p) =>
                renderProductCard(
                  p,
                  "bg-rose-950/80 text-rose-300 border-rose-800",
                  "text-rose-400"
                )
              )
            )}
          </div>
        </div>

        {/* 2열: 재고 10개 이상 ~ 30개 이하 (주문 시급) */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-amber-900/50 flex flex-col h-full">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-900/40">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <h2 className="text-sm font-bold text-amber-300">2. 재고 10개 ~ 30개</h2>
            </div>
            <span className="text-xs font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800">
              {criticalStock.length}건
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[70vh] pr-1">
            {criticalStock.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                해당 구간 상품이 없습니다.
              </div>
            ) : (
              criticalStock.map((p) =>
                renderProductCard(
                  p,
                  "bg-amber-950/80 text-amber-300 border-amber-800",
                  "text-amber-400"
                )
              )
            )}
          </div>
        </div>

        {/* 3열: 재고 30개 초과 ~ 50개 이하 (재고 주의) */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-blue-900/50 flex flex-col h-full md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-900/40">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h2 className="text-sm font-bold text-blue-300">3. 재고 31개 ~ 50개</h2>
            </div>
            <span className="text-xs font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-800">
              {warningStock.length}건
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[70vh] pr-1">
            {warningStock.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                해당 구간 상품이 없습니다.
              </div>
            ) : (
              warningStock.map((p) =>
                renderProductCard(
                  p,
                  "bg-blue-950/80 text-blue-300 border-blue-800",
                  "text-blue-400"
                )
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
}