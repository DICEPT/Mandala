// src/pages/EstimatePage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Product } from "../types/Product"; // 🔹 Product 타입 import
import ProductImage from "../components/ProductImage";

interface OrderItem {
  id: string;
  product: Product; // 🔹 any 대신 구체적인 Product 타입 지정
  orderQty: number;
  price: number;
}

interface SavedOrderRecord {
  orderNumber: string;
  orderDate: string; // YYYY-MM-DD
  orderTime: string; // HH:MM:SS
  createdAtTimestamp: string; // YYYY-MM-DD HH:MM:SS
  items: OrderItem[];
  totalQuantity: number;
  totalPrice: number;
}

export default function EstimatePage() {
  const navigate = useNavigate();
  const [orderList, setOrderList] = useState<OrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 과거 발주 모달 관련 상태
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyOrders, setHistoryOrders] = useState<SavedOrderRecord[]>([]);
  const [selectedHistoryOrder, setSelectedHistoryOrder] =
    useState<SavedOrderRecord | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // 1. 주문서 장바구니 불러오기
  useEffect(() => {
    const saved = localStorage.getItem("orderList");
    if (saved) {
      try {
        setOrderList(JSON.parse(saved));
      } catch (e) {
        console.error("주문 목록 로딩 실패", e);
      }
    }
  }, []);

  // 한국 시간(KST) 문자열 생성 유틸
  const getKSTDetails = () => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(kst.getUTCDate()).padStart(2, "0");
    const hh = String(kst.getUTCHours()).padStart(2, "0");
    const mm = String(kst.getUTCMinutes()).padStart(2, "0");
    const ss = String(kst.getUTCSeconds()).padStart(2, "0");

    const orderNumber = `ORD_${y}${m}${d}_${hh}${mm}${ss}`;
    const orderDate = `${y}-${m}-${d}`;
    const orderTime = `${hh}:${mm}:${ss}`;
    const fullDateTime = `${orderDate} ${orderTime}`;

    return { orderNumber, orderDate, orderTime, fullDateTime };
  };

  // 2. 수량 변경 핸들러
  const handleQuantityChange = (id: string, qty: number) => {
    if (qty < 1) return;
    const updated = orderList.map((item) =>
      item.id === id ? { ...item, orderQty: qty } : item
    );
    setOrderList(updated);
    localStorage.setItem("orderList", JSON.stringify(updated));
  };

  // 3. 단가 수정 핸들러
  const handlePriceChange = (id: string, price: number) => {
    if (price < 0) return;
    const updated = orderList.map((item) =>
      item.id === id ? { ...item, price } : item
    );
    setOrderList(updated);
    localStorage.setItem("orderList", JSON.stringify(updated));
  };

  // 4. 단일 품목 삭제
  const handleRemoveItem = (id: string) => {
    const updated = orderList.filter((item) => item.id !== id);
    setOrderList(updated);
    localStorage.setItem("orderList", JSON.stringify(updated));
  };

  // 5. 전체 비우기
  const handleClearAll = () => {
    if (window.confirm("주문서를 모두 비우시겠습니까?")) {
      setOrderList([]);
      localStorage.removeItem("orderList");
    }
  };

  // 6. 인쇄 핸들러
  const handlePrint = () => {
    if (orderList.length === 0) {
      alert("인쇄할 상품이 없습니다.");
      return;
    }
    window.print();
  };

  // 총 합계 계산
  const totalQuantity = orderList.reduce(
    (sum, item) => sum + (item.orderQty || 0),
    0
  );
  const totalPrice = orderList.reduce(
    (sum, item) => sum + (item.orderQty || 0) * (item.price || 0),
    0
  );

  // 7. Firestore에 발주 저장
  const handleOrderSubmit = async () => {
    if (orderList.length === 0) {
      alert("발주할 상품이 없습니다.");
      return;
    }

    const { orderNumber, orderDate, orderTime, fullDateTime } = getKSTDetails();

    const isConfirmed = window.confirm(
      `총 ${orderList.length}종 (${totalQuantity}개) 상품을 발주 등록하시겠습니까?\n주문번호: ${orderNumber}`
    );
    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      const orderData = {
        orderNumber,
        orderDate,
        orderTime,
        createdAtTimestamp: fullDateTime,
        createdAt: serverTimestamp(),
        items: orderList,
        totalQuantity,
        totalPrice,
      };

      await setDoc(doc(db, "orders", orderNumber), orderData);

      alert(`발주가 성공적으로 접수되었습니다!\n주문번호: ${orderNumber}`);

      setOrderList([]);
      localStorage.removeItem("orderList");
    } catch (error) {
      console.error("발주 등록 오류:", error);
      alert("발주 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 8. 과거 발주 내역 불러오기
  const fetchOrderHistory = async () => {
    setIsLoadingHistory(true);
    setShowHistoryModal(true);
    try {
      const q = query(collection(db, "orders"), orderBy("createdAtTimestamp", "desc"));
      const querySnapshot = await getDocs(q);

      const list: SavedOrderRecord[] = querySnapshot.docs.map((docSnap) => ({
        ...(docSnap.data() as SavedOrderRecord),
      }));

      setHistoryOrders(list);
      if (list.length > 0) {
        setSelectedHistoryOrder(list[0]);
      } else {
        setSelectedHistoryOrder(null);
      }
    } catch (error) {
      console.error("과거 발주 목록 로딩 실패:", error);
      alert("과거 발주 내역을 가져오지 못했습니다.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const todayStr = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <>
      {/* 인쇄 스타일 */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 15mm;
          }
        }
      `}</style>

      <div
        id="print-area"
        className="max-w-5xl mx-auto p-6 bg-slate-950 text-slate-100 min-h-screen print:min-h-0"
      >
        {/* 인쇄용 상단 헤더 */}
        <div className="hidden print:block mb-6 border-b-2 border-black pb-3">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-black">주 문 서 (견 적 서)</h1>
              <p className="text-sm text-gray-600 mt-1">발행일자: {todayStr}</p>
            </div>
            <div className="text-right text-xs text-gray-700 leading-relaxed">
              <p className="font-semibold">담당자 확인: ________________ (인)</p>
            </div>
          </div>
        </div>

        {/* 상단 액션 바 */}
        <div className="no-print flex flex-wrap justify-between items-center gap-4 mb-6 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">주문서 (견적서)</h1>
            <p className="text-sm text-slate-400 mt-1">
              수량을 조절하고 즉시 발주하거나 과거 발주 목록을 열람할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchOrderHistory}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow"
            >
              📜 과거 발주 내역
            </button>

            <button
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow"
            >
              🖨️ 인쇄
            </button>

            <button
              onClick={() => navigate(-1)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-3.5 py-2 rounded-lg transition"
            >
              ← 상품 추가
            </button>

            {orderList.length > 0 && (
              <button
                onClick={handleClearAll}
                className="bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 text-sm px-3 py-2 rounded-lg transition"
              >
                비우기
              </button>
            )}
          </div>
        </div>

        {orderList.length === 0 ? (
          <div className="no-print bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-3">
            <p className="text-lg">주문서에 담긴 상품이 없습니다.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
              >
                상품 목록으로 가기
              </button>
              <button
                onClick={fetchOrderHistory}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold px-4 py-2 rounded-lg transition"
              >
                과거 발주 내역 열람
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 상품 테이블 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg print:border print:border-black print:rounded-none print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm print:text-xs">
                  <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 text-xs print:bg-gray-100 print:text-black print:border-b-2 print:border-black">
                    <tr>
                      <th className="py-3 px-4 print:py-2">상품 정보</th>
                      <th className="py-3 px-4 w-32 print:py-2 print:w-28 text-right">단가 (원)</th>
                      <th className="py-3 px-4 w-36 text-center print:py-2 print:w-20">주문 수량</th>
                      <th className="py-3 px-4 w-36 text-right print:py-2 print:w-28">합계 금액</th>
                      <th className="no-print py-3 px-4 w-16 text-center">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 print:divide-y print:divide-gray-300">
                    {orderList.map((item) => {
                      const imagePath = item.product.사진이력?.at(-1)?.경로;
                      const itemTotal = (item.price || 0) * (item.orderQty || 0);

                      return (
                        <tr key={item.id} className="hover:bg-slate-850/50 transition print:hover:bg-transparent">
                          <td className="py-3 px-4 print:py-2">
                            <div className="flex items-center gap-3">
                              <div className="w-14 h-14 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0 print:w-10 print:h-10 print:border-gray-300">
                                {imagePath ? (
                                  <ProductImage path={imagePath} />
                                ) : (
                                  <span className="text-[10px] text-slate-600 print:text-gray-400">No Image</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-100 text-sm truncate print:text-black print:text-xs">
                                  {[item.product.상품번호, item.product.상품명]
                                    .filter(Boolean)
                                    .join(" - ")}
                                </p>
                                <p className="text-xs text-slate-400 print:text-gray-600">
                                  {item.product.카테고리1 || "-"} / {item.product.카테고리2 || "-"} /{" "}
                                  <span className="text-blue-400 print:text-black">{item.product.브랜드 || "-"}</span>
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* 단가 */}
                          <td className="py-3 px-4 print:py-2 text-right">
                            <span className="hidden print:inline-block font-mono text-black">
                              {Number(item.price).toLocaleString()}원
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={item.price}
                              onChange={(e) => handlePriceChange(item.id, Number(e.target.value))}
                              className="no-print w-28 bg-slate-800 border border-slate-700 text-slate-100 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                            />
                          </td>

                          {/* 주문 수량 */}
                          <td className="py-3 px-4 print:py-2 text-center">
                            <span className="hidden print:inline-block font-bold text-black">
                              {item.orderQty}
                            </span>
                            <div className="no-print flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleQuantityChange(item.id, item.orderQty - 1)}
                                className="w-7 h-7 bg-slate-800 border border-slate-700 text-slate-200 rounded hover:bg-slate-700 font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.orderQty}
                                onChange={(e) =>
                                  handleQuantityChange(item.id, Math.max(1, Number(e.target.value)))
                                }
                                className="w-16 bg-slate-800 border border-slate-700 text-slate-100 text-center rounded px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => handleQuantityChange(item.id, item.orderQty + 1)}
                                className="w-7 h-7 bg-slate-800 border border-slate-700 text-slate-200 rounded hover:bg-slate-700 font-bold"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* 소계 */}
                          <td className="py-3 px-4 text-right font-bold text-slate-100 print:text-black print:py-2 font-mono">
                            {itemTotal.toLocaleString()}원
                          </td>

                          {/* 삭제 버튼 */}
                          <td className="no-print py-3 px-4 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 정산 요약 및 발주하기 바 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 print:border-t-2 print:border-black print:border-b-0 print:border-x-0 print:rounded-none print:p-3 print:bg-transparent">
              <div className="text-sm text-slate-400 space-y-1 print:text-black">
                <div>
                  총 품목 수: <strong className="text-slate-200 print:text-black">{orderList.length}</strong>종
                </div>
                <div>
                  총 주문 수량: <strong className="text-slate-200 print:text-black">{totalQuantity}</strong>개
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-xs text-slate-400 print:text-gray-700 block">최종 주문 합계</span>
                  <span className="text-2xl font-extrabold text-blue-400 print:text-black font-mono">
                    {totalPrice.toLocaleString()}원
                  </span>
                </div>

                <button
                  onClick={handleOrderSubmit}
                  disabled={isSubmitting || orderList.length === 0}
                  className="no-print bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-7 py-3 rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "발주 등록 중..." : "🚀 발주하기"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 과거 발주 내역 모달 */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                📜 과거 발주 내역
              </h2>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
              {isLoadingHistory ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                  발주 기록을 불러오는 중입니다...
                </div>
              ) : historyOrders.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                  과거 발주 내역이 존재하지 않습니다.
                </div>
              ) : (
                <>
                  <div className="w-full md:w-80 border-r border-slate-800 overflow-y-auto divide-y divide-slate-800/60 bg-slate-950/30 shrink-0">
                    {historyOrders.map((order) => {
                      const isSelected = selectedHistoryOrder?.orderNumber === order.orderNumber;
                      return (
                        <div
                          key={order.orderNumber}
                          onClick={() => setSelectedHistoryOrder(order)}
                          className={`p-3.5 cursor-pointer transition ${
                            isSelected
                              ? "bg-blue-600/20 border-l-4 border-blue-500"
                              : "hover:bg-slate-800/40"
                          }`}
                        >
                          <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-300">
                            <span>{order.orderNumber}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex justify-between">
                            <span>{order.orderDate} {order.orderTime}</span>
                            <span className="text-slate-300 font-semibold">{order.totalQuantity}개</span>
                          </div>
                          <div className="text-right text-xs font-bold text-emerald-400 mt-1">
                            {order.totalPrice?.toLocaleString()}원
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex-1 p-5 overflow-y-auto space-y-4">
                    {selectedHistoryOrder ? (
                      <>
                        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-1 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs">주문번호</span>
                            <span className="font-mono font-bold text-blue-400">
                              {selectedHistoryOrder.orderNumber}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs">발주 일시</span>
                            <span className="text-slate-200">
                              {selectedHistoryOrder.orderDate} {selectedHistoryOrder.orderTime}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                            <span className="text-slate-400 text-xs">총 발주 수량 / 금액</span>
                            <span className="font-bold text-slate-100">
                              {selectedHistoryOrder.totalQuantity}개 /{" "}
                              <span className="text-emerald-400">
                                {selectedHistoryOrder.totalPrice?.toLocaleString()}원
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            발주 품목 ({selectedHistoryOrder.items.length}종)
                          </h4>
                          <div className="space-y-2">
                            {selectedHistoryOrder.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex justify-between items-center text-xs"
                              >
                                <div className="min-w-0 pr-3">
                                  <p className="font-semibold text-slate-200 truncate">
                                    {[item.product?.상품번호, item.product?.상품명]
                                      .filter(Boolean)
                                      .join(" - ")}
                                  </p>
                                  <p className="text-slate-500 mt-0.5">
                                    {item.product?.브랜드 || "브랜드 없음"}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-slate-300 font-semibold">
                                    수량: <strong className="text-blue-400">{item.orderQty}</strong>개
                                  </p>
                                  <p className="text-slate-400 mt-0.5">
                                    단가 {item.price?.toLocaleString()}원 (
                                    <strong className="text-slate-200">
                                      {(item.price * item.orderQty).toLocaleString()}원
                                    </strong>
                                    )
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                        좌측 목록에서 주문을 선택하세요.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-4 py-2 rounded-lg transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}