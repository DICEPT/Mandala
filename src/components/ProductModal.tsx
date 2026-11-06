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

  // 🔹 입고/출고 이력 배열 자체를 상태로 관리 (추가/삭제 실시간 반영)
  const [inHistory, setInHistory] = useState<StockRecord[]>(
    product.입고기록 ?? []
  );
  const [outHistory, setOutHistory] = useState<StockRecord[]>(
    product.출고기록 ?? []
  );

  // 간편 빠른 수량 추가용 상태
  const [editedInQty, setEditedInQty] = useState(0);
  const [editedOutQty, setEditedOutQty] = useState(0);

  // 🔹 상세 내역 직접 추가 폼용 상태
  const [historyTab, setHistoryTab] = useState<"입고" | "출고">("입고");
  const [customDate, setCustomDate] = useState<string>(() => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().substring(0, 10); // YYYY-MM-DD
  });
  const [customQty, setCustomQty] = useState<number>(0);

  const [newImage, setNewImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editedBrand, setEditedBrand] = useState(product.브랜드 ?? "");

  // 퍼센트 입력(원가→단가, 단가→판매가)
  const [costMarkupPct, setCostMarkupPct] = useState<number>(0);
  const [unitMarkupPct, setUnitMarkupPct] = useState<number>(0);

  // 중국 원가 & 환율 & 배수 관련 상태
  const [chinaCost, setChinaCost] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number>(190);
  const [costMultiple, setCostMultiple] = useState<number>(1.5);

  const formatKRW = (n: number) =>
    new Intl.NumberFormat("ko-KR").format(Math.max(0, Math.round(n)));
  const calcFromPct = (base: number, pct: number) =>
    Math.max(0, Math.round(base * (1 + (pct || 0) / 100)));

  const marginPct = (cost: number, price: number) => {
    if (!price || price <= 0) return 0;
    const pct = ((price - (cost || 0)) / price) * 100;
    return Math.round(pct * 10) / 10;
  };

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
    if (pct > high) return "마진 보통";
    return "마진 높음";
  };

  const PRODUCER = { low: 40, high: 60 };
  const SUPPLIER = { low: 50, high: 80 };

  const baseChinaCostKRW = Math.round(chinaCost * exchangeRate);
  const calculatedKRWCost = Math.round(chinaCost * exchangeRate * costMultiple);

  const expectedUnitPrice = calcFromPct(editedCost, costMarkupPct);
  const expectedSalePrice = calcFromPct(editedUnitPrice, unitMarkupPct);

  const unitMargin = marginPct(editedCost, editedUnitPrice);
  const unitLabel = labelByRange(unitMargin, PRODUCER.low, PRODUCER.high);

  const saleMargin = marginPct(editedCost, editedSalePrice);
  const saleLabel = labelByRange(saleMargin, SUPPLIER.low, SUPPLIER.high);

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

  const getKSTTimestamp = (): string => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().replace("T", " ").substring(0, 19);
  };

  // 실시간 재고 계산 (현재 편집 중인 inHistory/outHistory 기준)
  const currentTotalIn = inHistory.reduce((sum, rec) => sum + (rec.수량 || 0), 0) + (editedInQty || 0);
  const currentTotalOut = outHistory.reduce((sum, rec) => sum + (rec.수량 || 0), 0) + (editedOutQty || 0);
  const calculatedStock = currentTotalIn - currentTotalOut;

  // 🔹 과거 내역 항목 삭제 핸들러
  const handleRemoveHistoryItem = (type: "입고" | "출고", index: number) => {
    if (!window.confirm(`해당 ${type} 기록을 삭제하시겠습니까?`)) return;

    if (type === "입고") {
      setInHistory((prev) => prev.filter((_, i) => i !== index));
    } else {
      setOutHistory((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // 🔹 과거 내역 직접 추가 핸들러
  const handleAddDirectHistory = () => {
    if (customQty <= 0) {
      alert("1개 이상의 수량을 입력해주세요.");
      return;
    }
    if (!customDate) {
      alert("날짜를 입력해주세요.");
      return;
    }

    const newRecord: StockRecord = {
      날짜: `${customDate} 12:00:00`,
      수량: Number(customQty),
    };

    if (historyTab === "입고") {
      setInHistory((prev) => [...prev, newRecord]);
    } else {
      setOutHistory((prev) => [...prev, newRecord]);
    }

    setCustomQty(0);
    alert(`${historyTab} 내역에 추가되었습니다. (수정하기 버튼을 눌러 저장)`);
  };

  // 🔹 저장 업데이트
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

    // 입고/출고 내역 업데이트 반영 (const 사용)
    const finalInList = [...inHistory];
    if (editedInQty > 0) {
      finalInList.push({ 날짜: today, 수량: editedInQty });
    }
    updates.입고기록 = finalInList;

    const finalOutList = [...outHistory];
    if (editedOutQty > 0) {
      finalOutList.push({ 날짜: today, 수량: editedOutQty });
    }
    updates.출고기록 = finalOutList;

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
    "w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition";

  return (
    <div
      className="fixed inset-0 flex justify-center items-center z-50 p-4"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* 고정 모달 헤더 */}
        <div className="flex justify-between items-center border-b border-slate-800 px-6 py-3.5 bg-slate-900 shrink-0">
          <h2 className="text-base font-bold text-slate-100">상품 상세 정보 수정</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg font-bold p-1 rounded-lg transition"
          >
            ✕
          </button>
        </div>

        {/* 스크롤 가능한 본문 영역 */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* 상단: 이미지 & 기본 정보 */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 items-center">
            <div className="sm:col-span-1 flex flex-col items-center justify-center gap-2">
              {previewUrl || product.사진이력?.at(-1)?.경로 ? (
                <img
                  src={previewUrl || product.사진이력?.at(-1)?.경로}
                  alt="상품 이미지"
                  className="w-24 h-24 object-cover rounded-lg border border-slate-800 bg-slate-900"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center text-[11px] text-slate-600">
                  이미지 없음
                </div>
              )}
            </div>

            <div className="sm:col-span-3 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">
                    상품명
                  </label>
                  <input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">
                    브랜드
                  </label>
                  <input
                    value={editedBrand}
                    onChange={(e) => setEditedBrand(e.target.value)}
                    placeholder="#조계사 #템플스테이"
                    className={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-400 mb-1">
                  이미지 교체
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 중국 원가 계산기 영역 */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-amber-900/40 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                🇨🇳 중국 원가 ➔ 한국 원가 계산기
              </span>
              <button
                type="button"
                onClick={() => setEditedCost(calculatedKRWCost)}
                disabled={chinaCost <= 0}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white disabled:text-slate-500 font-semibold text-[11px] px-2.5 py-1 rounded-md transition shrink-0"
              >
                원가에 적용 ({formatKRW(calculatedKRWCost)}원)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-400 mb-1">
                  중국 원가 (¥ 위안)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={chinaCost || ""}
                  onChange={(e) => setChinaCost(Number(e.target.value) || 0)}
                  placeholder="예: 25.5"
                  className={`${inputStyle} text-amber-200 font-medium`}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-400 mb-1">
                  적용 환율 (원/¥)
                </label>
                <input
                  type="number"
                  min={0}
                  value={exchangeRate || ""}
                  onChange={(e) => setExchangeRate(Number(e.target.value) || 0)}
                  placeholder="예: 190"
                  className={inputStyle}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-400 mb-1">
                  배수 설정 (1~2배)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step="0.1"
                  value={costMultiple || ""}
                  onChange={(e) => setCostMultiple(Number(e.target.value) || 0)}
                  placeholder="예: 1.5"
                  className={inputStyle}
                />
              </div>
            </div>

            {chinaCost > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">기본 원가 (1배):</span>
                  <strong className="text-slate-200">{formatKRW(baseChinaCostKRW)}원</strong>
                </div>
                <div className="bg-slate-900/90 p-2 rounded-lg border border-amber-900/30">
                  <span className="text-amber-400/90 block">배수({costMultiple}배) 적용 원가:</span>
                  <strong className="text-amber-300 font-bold">{formatKRW(calculatedKRWCost)}원</strong>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col justify-center">
                  <span className="text-slate-400">예상 단가 마진: <strong className="text-slate-200">{marginPct(calculatedKRWCost, editedUnitPrice)}%</strong></span>
                  <span className="text-slate-400">예상 판매가 마진: <strong className="text-slate-200">{marginPct(calculatedKRWCost, editedSalePrice)}%</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* 가격 & 마진 설정 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <h3 className="font-semibold text-slate-300">가격 및 마진 설정</h3>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-400">원가 (원):</span>
                <input
                  type="number"
                  min={0}
                  value={editedCost}
                  onChange={(e) => setEditedCost(Number(e.target.value) || 0)}
                  className={`${inputStyle} w-32 font-medium text-right`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* 왼쪽 열: 단가 설정 */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2.5 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="font-bold text-slate-300 block border-b border-slate-800/60 pb-1">
                    1. 단가 (생산자)
                  </span>

                  <div className="flex items-center justify-between gap-1.5 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-slate-400 shrink-0">마진(%)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={costMarkupPct}
                        onChange={(e) => setCostMarkupPct(Number(e.target.value) || 0)}
                        placeholder="예: 30"
                        className={`${inputStyle} w-16 text-center`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditedUnitPrice(expectedUnitPrice)}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] px-2 py-1 rounded-md transition shrink-0"
                    >
                      단가 적용 ({formatKRW(expectedUnitPrice)}원)
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                    <span>예상 마진: {expectedUnitMargin}%</span>
                    <span className={`border text-[10px] font-bold px-1.5 py-0.2 rounded-full ${labelBadgeStyle(expectedUnitLabel)}`}>
                      {expectedUnitLabel}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <label className="block font-semibold text-slate-400 mb-1">
                    최종 적용 단가 (원)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editedUnitPrice}
                    onChange={(e) => setEditedUnitPrice(Number(e.target.value) || 0)}
                    className={`${inputStyle} font-semibold`}
                  />
                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1.5">
                    <span>현재 마진: <strong className="text-slate-200">{unitMargin}%</strong></span>
                    <span className={`border text-[10px] font-bold px-1.5 py-0.2 rounded-full ${labelBadgeStyle(unitLabel)}`}>
                      {unitLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* 오른쪽 열: 판매가 설정 */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2.5 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="font-bold text-slate-300 block border-b border-slate-800/60 pb-1">
                    2. 판매가 (납품업체)
                  </span>

                  <div className="flex items-center justify-between gap-1.5 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-slate-400 shrink-0">마진(%)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={unitMarkupPct}
                        onChange={(e) => setUnitMarkupPct(Number(e.target.value) || 0)}
                        placeholder="예: 20"
                        className={`${inputStyle} w-16 text-center`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditedSalePrice(expectedSalePrice)}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] px-2 py-1 rounded-md transition shrink-0"
                    >
                      판매가 적용 ({formatKRW(expectedSalePrice)}원)
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                    <span>예상 마진: {expectedSaleMargin}%</span>
                    <span className={`border text-[10px] font-bold px-1.5 py-0.2 rounded-full ${labelBadgeStyle(expectedSaleLabel)}`}>
                      {expectedSaleLabel}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <label className="block font-semibold text-slate-400 mb-1">
                    최종 적용 판매가 (원)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editedSalePrice}
                    onChange={(e) => setEditedSalePrice(Number(e.target.value) || 0)}
                    className={`${inputStyle} font-semibold`}
                  />
                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1.5">
                    <span>현재 마진: <strong className="text-slate-200">{saleMargin}%</strong></span>
                    <span className={`border text-[10px] font-bold px-1.5 py-0.2 rounded-full ${labelBadgeStyle(saleLabel)}`}>
                      {saleLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 🔹 입출고 관리 & 과거 내역 리스트 관리 */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
              <h3 className="font-semibold text-slate-300">입출고 관리 및 과거 내역</h3>
              <div className="text-xs">
                현재 재고:{" "}
                <strong className={`text-sm ${calculatedStock <= 20 ? "text-rose-400 font-bold" : "text-blue-400 font-bold"}`}>
                  {calculatedStock}개
                </strong>
              </div>
            </div>

            {/* 빠른 수량 추가 & 현황 요약 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">
                    오늘 입고 수량 추가
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editedInQty}
                    onChange={(e) => setEditedInQty(Number(e.target.value) || 0)}
                    placeholder="수량 입력"
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">
                    오늘 출고 수량 추가
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editedOutQty}
                    onChange={(e) => setEditedOutQty(Number(e.target.value) || 0)}
                    placeholder="수량 입력"
                    className={inputStyle}
                  />
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-400 items-center">
                <div>
                  누적 입고: <strong className="text-slate-200">{currentTotalIn}개</strong>
                </div>
                <div>
                  최근 입고일: <strong className="text-slate-200">{inHistory.at(-1)?.날짜?.split(" ")[0] ?? "-"}</strong>
                </div>
                <div>
                  누적 출고: <strong className="text-slate-200">{currentTotalOut}개</strong>
                </div>
                <div>
                  최근 출고일: <strong className="text-slate-200">{outHistory.at(-1)?.날짜?.split(" ")[0] ?? "-"}</strong>
                </div>
              </div>
            </div>

            {/* 🔹 과거 상세 내역 테이블 및 추가/삭제 패널 */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              {/* 상단 탭 및 내역 직접 추가 폼 */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHistoryTab("입고")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      historyTab === "입고"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    입고 내역 ({inHistory.length}건)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab("출고")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      historyTab === "출고"
                        ? "bg-rose-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    출고 내역 ({outHistory.length}건)
                  </button>
                </div>

                {/* 내역 직접 추가 폼 */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className={`${inputStyle} w-32`}
                  />
                  <input
                    type="number"
                    min={1}
                    value={customQty || ""}
                    onChange={(e) => setCustomQty(Number(e.target.value) || 0)}
                    placeholder="수량"
                    className={`${inputStyle} w-20 text-center`}
                  />
                  <button
                    type="button"
                    onClick={handleAddDirectHistory}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shrink-0"
                  >
                    + 내역 추가
                  </button>
                </div>
              </div>

              {/* 스크롤 가능한 내역 목록 */}
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60 rounded-lg border border-slate-800 bg-slate-900/60">
                {(historyTab === "입고" ? inHistory : outHistory).length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-[11px]">
                    등록된 {historyTab} 내역이 없습니다.
                  </div>
                ) : (
                  (historyTab === "입고" ? inHistory : outHistory)
                    .map((item, idx) => ({ ...item, originalIndex: idx }))
                    .reverse() // 최신순 표시
                    .map((item) => (
                      <div
                        key={item.originalIndex}
                        className="px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-800/40 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 text-[11px]">
                            {item.날짜}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-semibold ${
                              historyTab === "입고"
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            {historyTab === "입고" ? "+" : "-"}
                            {item.수량}개
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveHistoryItem(
                                historyTab,
                                item.originalIndex
                              )
                            }
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                            title="이 기록 삭제"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
              <p className="text-[10px] text-slate-500 text-right">
                * 내역 추가/삭제 후 하단의 <strong>[수정하기]</strong>를 눌러야 최종 저장됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 고정 하단 액션 버튼 */}
        <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-800 bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-4 py-2 rounded-lg transition"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isUpdating}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {isUpdating ? "수정 중..." : "수정하기"}
          </button>
        </div>
      </div>
    </div>
  );
}