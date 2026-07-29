import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Product } from "../types/Product";

interface ProductWithId extends Product {
  id: string;
  deletedAt?: string;
}

interface StockEntry {
  id: string;
  상품번호: string;
  상품명?: string;
  구분: "입고" | "출고";
  수량: number;
  날짜: string;
  상태?: "삭제됨";
  삭제시간?: string;
}

export default function StockHistoryPage() {
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productSnap, deletedSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "deleteList")),
        ]);

        const products = productSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ProductWithId[];

        const deletedProducts = deletedSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ProductWithId[];

        const allEntries: StockEntry[] = [];

        const processProduct = (product: ProductWithId, isDeleted = false) => {
          product.입고기록?.forEach((rec, index) => {
            allEntries.push({
              id: `${product.id}-in-${index}-${isDeleted ? "deleted" : "active"}`,
              상품번호: product.상품번호,
              상품명: product.상품명,
              구분: "입고",
              수량: rec.수량,
              날짜: rec.날짜,
              상태: isDeleted ? "삭제됨" : undefined,
              삭제시간: isDeleted ? product.deletedAt : undefined,
            });
          });

          product.출고기록?.forEach((rec, index) => {
            allEntries.push({
              id: `${product.id}-out-${index}-${
                isDeleted ? "deleted" : "active"
              }`,
              상품번호: product.상품번호,
              상품명: product.상품명,
              구분: "출고",
              수량: rec.수량,
              날짜: rec.날짜,
              상태: isDeleted ? "삭제됨" : undefined,
              삭제시간: isDeleted ? product.deletedAt : undefined,
            });
          });
        };

        products.forEach((p) => processProduct(p, false));
        deletedProducts.forEach((p) => processProduct(p, true));

        setEntries(allEntries);
      } catch (error) {
        console.error("입출고 이력 불러오기 오류:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 정렬 및 검색 처리
  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          e.상품번호?.toLowerCase().includes(term) ||
          e.상품명?.toLowerCase().includes(term)
      );
    }

    return result.sort((a, b) =>
      sortOrder === "asc"
        ? a.날짜.localeCompare(b.날짜)
        : b.날짜.localeCompare(a.날짜)
    );
  }, [entries, sortOrder, searchTerm]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-slate-950 text-slate-100 min-h-screen">
      {/* 타이틀 영역 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-100">📋 상품 입출고 이력</h1>
          <p className="text-xs text-slate-400 mt-1">
            전체 상품의 입고 및 출고 이력을 실시간으로 확인합니다.
          </p>
        </div>

        {/* 제어바: 검색 & 정렬 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="상품명 또는 번호 검색..."
            className="bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 transition"
          />
          <button
            onClick={toggleSortOrder}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shrink-0"
          >
            <span>날짜</span>
            <span className="text-blue-400 font-bold">
              {sortOrder === "asc" ? "오름차순 ↑" : "내림차순 ↓"}
            </span>
          </button>
        </div>
      </div>

      {/* 테이블 영역 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 w-28">구분</th>
                <th className="py-3 px-4 w-32">상품번호</th>
                <th className="py-3 px-4">상품명</th>
                <th className="py-3 px-4 w-28 text-right">수량</th>
                <th className="py-3 px-4 w-44 text-right">날짜</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    이력 데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : filteredAndSortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    조회된 입출고 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredAndSortedEntries.map((entry) => {
                  const isDeleted = entry.상태 === "삭제됨";
                  const isIn = entry.구분 === "입고";

                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-800/40 transition ${
                        isDeleted ? "bg-rose-950/10 text-slate-500" : "text-slate-200"
                      }`}
                    >
                      {/* 구분 배지 */}
                      <td className="py-2.5 px-4 font-medium">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            isIn
                              ? "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                              : "bg-rose-950/80 text-rose-300 border-rose-800"
                          }`}
                        >
                          {entry.구분}
                        </span>
                      </td>

                      {/* 상품번호 */}
                      <td className="py-2.5 px-4 font-semibold text-slate-300">
                        <span className={isDeleted ? "line-through opacity-70" : ""}>
                          {entry.상품번호 || "-"}
                        </span>
                        {isDeleted && (
                          <span className="ml-1.5 text-[10px] text-rose-400 font-normal">
                            (삭제됨)
                          </span>
                        )}
                      </td>

                      {/* 상품명 */}
                      <td className="py-2.5 px-4 font-medium">
                        <span className={isDeleted ? "line-through opacity-70" : ""}>
                          {entry.상품명 || "이름 없음"}
                        </span>
                      </td>

                      {/* 수량 */}
                      <td className="py-2.5 px-4 text-right font-bold">
                        <span className={isIn ? "text-emerald-400" : "text-rose-400"}>
                          {isIn ? `+${entry.수량}` : `-${entry.수량}`}
                        </span>
                      </td>

                      {/* 날짜 */}
                      <td className="py-2.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                        {entry.날짜}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}