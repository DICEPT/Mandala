import { useEffect, useState } from "react";
import { Product, PriceHistory, StockRecord } from "../types/Product";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface ProductWithId extends Product {
  id: string;
}
interface ProductModalProps {
  product: ProductWithId;
  onClose: () => void;
  onUpdated: () => void;
}

export default function ProductModal({
  product,
  onClose,
  onUpdated,
}: ProductModalProps) {
  const [editedName, setEditedName] = useState(product.상품명 ?? "");
  const [editedCost, setEditedCost] = useState(
    product.원가이력?.at(-1)?.금액 ?? 0
  );
  const [editedUnitPrice, setEditedUnitPrice] = useState(
    product.단가이력?.at(-1)?.금액 ?? 0
  );
  const [editedSalePrice, setEditedSalePrice] = useState(
    product.판매가이력?.at(-1)?.금액 ?? 0
  );
  const [editedInQty, setEditedInQty] = useState(0);
  const [editedOutQty, setEditedOutQty] = useState(0);
  const [newImage, setNewImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editedBrand, setEditedBrand] = useState(product.브랜드 ?? "");

  // 퍼센트 입력(원가→단가, 단가→판매가)
  const [costMarkupPct, setCostMarkupPct] = useState<number>(0);
  const [unitMarkupPct, setUnitMarkupPct] = useState<number>(0);

  // ====== 공통 유틸 ======
  const formatKRW = (n: number) =>
    new Intl.NumberFormat("ko-KR").format(Math.max(0, Math.round(n)));
  const calcFromPct = (base: number, pct: number) =>
    Math.max(0, Math.round(base * (1 + (pct || 0) / 100)));

  // ▶ 마진% 정의: 가격 기준 총이익률(= (가격-원가)/가격 * 100)
  const marginPct = (cost: number, price: number) => {
    if (!price || price <= 0) return 0;
    const pct = ((price - (cost || 0)) / price) * 100;
    return Math.round(pct * 10) / 10;
  };

  // 라벨 스타일 매핑 (다크모드 지원)
  const labelBadgeStyle = (label: string) => {
    if (label.includes("적음"))
      return "bg-blue-950/80 text-blue-300 border-blue-800";
    if (label.includes("보통"))
      return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
    if (label.includes("높음"))
      return "bg-rose-950/80 text-rose-300 border-rose-800";
    return "bg-slate-800 text-slate-300 border-slate-700";
  };

  const labelByRange = (pct: number, low: number, high: number) => {
    if (pct < low) return "마진 적음";
    if (pct > high) return "마진 높음";
    return "마진 보통";
  };

  // 기준 범위
  const PRODUCER = { low: 40, high: 60 };
  const SUPPLIER = { low: 50, high: 80 };

  // 실시간 예상가
  const expectedUnitPrice = calcFromPct(editedCost, costMarkupPct);
  const expectedSalePrice = calcFromPct(editedUnitPrice, unitMarkupPct);

  // 실시간 마진% & 라벨
  const unitMargin = marginPct(editedCost, editedUnitPrice);
  const unitLabel = labelByRange(unitMargin, PRODUCER.low, PRODUCER.high);

  const saleMargin = marginPct(editedCost, editedSalePrice);
  const saleLabel = labelByRange(saleMargin, SUPPLIER.low, SUPPLIER.high);

  // 예상값에 대한 마진 라벨
  const expectedUnitMargin = marginPct(editedCost, expectedUnitPrice);
  const expectedUnitLabel = labelByRange(
    expectedUnitMargin,
    PRODUCER.low,
    PRODUCER.high
  );

  const expectedSaleMargin = marginPct(editedCost, expectedSalePrice);
  const expectedSaleLabel = labelByRange(
    expectedSaleMargin,
    SUPPLIER.low,
    SUPPLIER.high
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const getStockCount = (p: ProductWithId): number => {
    const totalIn = p.입고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    const totalOut = p.출고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    return totalIn - totalOut;
  };

  const getKSTTimestamp = (): string => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().replace("T", " ").substring(0, 19);
  };

  const handleUpdate = async () => {
    const prevCost = product.원가이력?.at(-1)?.금액;
    const prevUnit = product.단가이력?.at(-1)?.금액;
    const prevSale = product.판매가이력?.at(-1)?.금액;
    const today = getKSTTimestamp();
    const updates: Partial<Product> = {};

    if (editedName !== product.상품명) updates.상품명 = editedName;

    const normalizedBrand = (editedBrand ?? "").trim();
    if ((product.브랜드 ?? "") !== normalizedBrand)
      updates.브랜드 = normalizedBrand;

    if (editedCost !== prevCost) {
      const newCost: PriceHistory = { 날짜: today, 금액: editedCost };
      updates.원가이력 = [...(product.원가이력 ?? []), newCost];
    }
    if (editedUnitPrice !== prevUnit) {
      const newUnit: PriceHistory = { 날짜: today, 금액: editedUnitPrice };
      updates.단가이력 = [...(product.단가이력 ?? []), newUnit];
    }
    if (editedSalePrice !== prevSale) {
      const newSale: PriceHistory = { 날짜: today, 금액: editedSalePrice };
      updates.판매가이력 = [...(product.판매가이력 ?? []), newSale];
    }
    if (editedInQty > 0) {
      const newIn: StockRecord = { 날짜: today, 수량: editedInQty };
      updates.입고기록 = [...(product.입고기록 ?? []), newIn];
    }
    if (editedOutQty > 0) {
      const newOut: StockRecord = { 날짜: today, 수량: editedOutQty };
      updates.출고기록 = [...(product.출고기록 ?? []), newOut];
    }
    if (newImage) {
      const safeFileName = `${Date.now()}_${encodeURIComponent(newImage.name)}`;
      const imageRef = ref(storage, `productImages/${safeFileName}`);
      await uploadBytes(imageRef, newImage);
      const imageUrl = await getDownloadURL(imageRef);
      updates.사진이력 = [
        ...(product.사진이력 ?? []),
        { 날짜: today, 경로: imageUrl },
      ];
    }

    if (Object.keys(updates).length === 0) return;

    try {
      setIsUpdating(true);
      await updateDoc(doc(db, "products", product.id), updates);
      alert("수정이 완료되었습니다.");
      onUpdated();
      onClose();
    } catch (err) {
      console.error("수정 실패:", err);
      alert("수정 중 오류가 발생했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  const inputStyle =
    "w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition";

  return (
<div
      className="fixed inset-0 flex justify-center items-center z-50 p-4"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)", // 반투명 검은색 배경
        backdropFilter: "blur(10px)",            // 표준 CSS 블러
        WebkitBackdropFilter: "blur(4px)",      // Safari 브라우저 지원
      }}
    >
      <div className="bg-black border border-slate-800 text-slate-100 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
        {/* 모달 헤더 */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h2 className="text-lg font-bold text-slate-100">상품 상세 정보 수정</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl font-bold p-1 rounded-lg transition"
          >
            ✕
          </button>
        </div>

        {/* 상단: 이미지 & 기본 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div className="flex flex-col items-center justify-center">
            {(previewUrl || product.사진이력?.at(-1)?.경로) ? (
              <img
                src={previewUrl || product.사진이력?.at(-1)?.경로}
                alt="상품 이미지"
                className="w-32 h-32 object-cover rounded-lg border border-slate-800 bg-slate-900"
              />
            ) : (
              <div className="w-32 h-32 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center text-xs text-slate-600">
                이미지 없음
              </div>
            )}
          </div>

          <div className="md:col-span-2 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                상품명
              </label>
              <input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                브랜드
              </label>
              <input
                value={editedBrand}
                onChange={(e) => setEditedBrand(e.target.value)}
                placeholder="#조계사 #템플스테이 형식 가능"
                className={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                이미지 수정
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 가격 & 마진 설정 계산기 Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-2">
            가격 및 마진 설정
          </h3>

          {/* 원가 입력 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              원가 (원)
            </label>
            <input
              type="number"
              min={0}
              value={editedCost}
              onChange={(e) => setEditedCost(Number(e.target.value) || 0)}
              className={inputStyle}
            />
          </div>

          {/* 원가 → 단가 마진 계산 */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="text-xs text-slate-400 shrink-0">원가 마진(%)</span>
                <input
                  type="number"
                  step="0.1"
                  value={costMarkupPct}
                  onChange={(e) => setCostMarkupPct(Number(e.target.value) || 0)}
                  placeholder="예: 30"
                  className={`${inputStyle} w-24`}
                />
              </div>

              <button
                type="button"
                onClick={() => setEditedUnitPrice(expectedUnitPrice)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg font-medium transition shrink-0"
              >
                단가에 적용
              </button>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>예상 단가: <strong className="text-slate-200">{formatKRW(expectedUnitPrice)}원</strong></span>
              <span>(마진 {expectedUnitMargin}%)</span>
              <span className={`border text-[10px] font-bold px-2 py-0.5 rounded-full ${labelBadgeStyle(expectedUnitLabel)}`}>
                {expectedUnitLabel}
              </span>
            </div>
          </div>

          {/* 단가 입력 & 마진 진단 */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-400">
              단가 (원)
            </label>
            <input
              type="number"
              min={0}
              value={editedUnitPrice}
              onChange={(e) => setEditedUnitPrice(Number(e.target.value) || 0)}
              className={inputStyle}
            />
            <div className="text-xs text-slate-400 flex items-center gap-2 pt-1">
              <span>현재 단가 마진: <strong className="text-slate-200">{unitMargin}%</strong></span>
              <span className={`border text-[10px] font-bold px-2 py-0.5 rounded-full ${labelBadgeStyle(unitLabel)}`}>
                {unitLabel}
              </span>
              <span className="text-slate-500 text-[11px]">
                (생산자 기준: {PRODUCER.low}~{PRODUCER.high}%)
              </span>
            </div>
          </div>

          {/* 단가 → 판매가 마진 계산 */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="text-xs text-slate-400 shrink-0">단가 마진(%)</span>
                <input
                  type="number"
                  step="0.1"
                  value={unitMarkupPct}
                  onChange={(e) => setUnitMarkupPct(Number(e.target.value) || 0)}
                  placeholder="예: 20"
                  className={`${inputStyle} w-24`}
                />
              </div>

              <button
                type="button"
                onClick={() => setEditedSalePrice(expectedSalePrice)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg font-medium transition shrink-0"
              >
                판매가에 적용
              </button>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>예상 판매가: <strong className="text-slate-200">{formatKRW(expectedSalePrice)}원</strong></span>
              <span>(마진 {expectedSaleMargin}%)</span>
              <span className={`border text-[10px] font-bold px-2 py-0.5 rounded-full ${labelBadgeStyle(expectedSaleLabel)}`}>
                {expectedSaleLabel}
              </span>
            </div>
          </div>

          {/* 판매가 입력 & 마진 진단 */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-400">
              판매가 (원)
            </label>
            <input
              type="number"
              min={0}
              value={editedSalePrice}
              onChange={(e) => setEditedSalePrice(Number(e.target.value) || 0)}
              className={inputStyle}
            />
            <div className="text-xs text-slate-400 flex items-center gap-2 pt-1">
              <span>현재 판매가 마진: <strong className="text-slate-200">{saleMargin}%</strong></span>
              <span className={`border text-[10px] font-bold px-2 py-0.5 rounded-full ${labelBadgeStyle(saleLabel)}`}>
                {saleLabel}
              </span>
              <span className="text-slate-500 text-[11px]">
                (납품업체 기준: {SUPPLIER.low}~{SUPPLIER.high}%)
              </span>
            </div>
          </div>
        </div>

        {/* 입출고 & 재고 현황 Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-2">
            입출고 관리 및 현황
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                입고 수량 추가
              </label>
              <input
                type="number"
                min={0}
                value={editedInQty}
                onChange={(e) => setEditedInQty(Number(e.target.value) || 0)}
                className={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                출고 수량 추가
              </label>
              <input
                type="number"
                min={0}
                value={editedOutQty}
                onChange={(e) => setEditedOutQty(Number(e.target.value) || 0)}
                className={inputStyle}
              />
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-400">
            <div>
              최근 입고: <strong className="text-slate-200">{product.입고기록?.at(-1)?.수량 ?? 0}개</strong>
            </div>
            <div>
              최근 입고일: <strong className="text-slate-200">{product.입고기록?.at(-1)?.날짜 ?? "-"}</strong>
            </div>
            <div>
              최근 출고: <strong className="text-slate-200">{product.출고기록?.at(-1)?.수량 ?? 0}개</strong>
            </div>
            <div>
              최근 출고일: <strong className="text-slate-200">{product.출고기록?.at(-1)?.날짜 ?? "-"}</strong>
            </div>
            <div className="col-span-2 md:col-span-1">
              현재 재고: <strong className="text-blue-400 font-bold">{getStockCount(product)}개</strong>
            </div>
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isUpdating}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {isUpdating ? "수정 중..." : "수정하기"}
          </button>
        </div>
      </div>
    </div>
  );
}