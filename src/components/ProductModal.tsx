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
    return Math.round(pct * 10) / 10; // 소수 첫째자리
  };

  // 라벨 색상 매핑
  const labelColor = (label: string) => {
    if (label.includes("적음")) return "#1976d2"; // 파란색
    if (label.includes("보통")) return "#2e7d32"; // 녹색
    if (label.includes("높음")) return "#d32f2f"; // 빨간색
    return "#333";
  };

  // ▶ 라벨링: 범위 내 = "마진 보통", 이하 = "마진 적음", 이상 = "마진 높음"
  const labelByRange = (pct: number, low: number, high: number) => {
    if (pct < low) return "마진 적음";
    if (pct > high) return "마진 높음";
    return "마진 보통";
  };

  // 기준 범위
  const PRODUCER = { low: 40, high: 60 }; // 생산자(원가→단가)
  const SUPPLIER = { low: 50, high: 80 }; // 납품업체(원가→판매가) ※요청 기준에 맞춰 원가 대비로 평가

  // 실시간 예상가
  const expectedUnitPrice = calcFromPct(editedCost, costMarkupPct);
  const expectedSalePrice = calcFromPct(editedUnitPrice, unitMarkupPct);

  // 실시간 마진% & 라벨
  const unitMargin = marginPct(editedCost, editedUnitPrice);
  const unitLabel = labelByRange(unitMargin, PRODUCER.low, PRODUCER.high);

  const saleMargin = marginPct(editedCost, editedSalePrice);
  const saleLabel = labelByRange(saleMargin, SUPPLIER.low, SUPPLIER.high);

  // 예상값에 대한 마진 라벨(미리 검토용)
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

  // ESC로 닫기
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

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          minWidth: "320px",
          maxWidth: "90%",
          color: "black",
        }}
      >
        <h3>상품 상세 정보</h3>

        {(previewUrl || product.사진이력?.at(-1)?.경로) && (
          <img
            src={previewUrl || product.사진이력?.at(-1)?.경로}
            alt="상품 이미지"
            width="300"
            style={{ marginBottom: "12px", objectFit: "cover" }}
          />
        )}

        {/* 상품명 */}
        <p>
          <strong>상품명:</strong>
          <input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            style={{ width: "100%" }}
          />
        </p>

        {/* 원가 입력 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
          <label>
            <strong>원가:</strong>
            <input
              type="number"
              min={0}
              value={editedCost}
              onChange={(e) => setEditedCost(Number(e.target.value) || 0)}
              style={{ width: "100%" }}
            />
          </label>
        </div>

        {/* 원가 마진% 입력 → 예상 단가 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: 8,
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ whiteSpace: "nowrap" }}>원가 마진(%)</span>
            <input
              type="number"
              step="0.1"
              value={costMarkupPct}
              onChange={(e) => setCostMarkupPct(Number(e.target.value) || 0)}
              placeholder="예: 30"
              style={{ width: "100%" }}
            />
          </label>

          <div style={{ fontSize: 13 }}>
            예상 단가: <strong>{formatKRW(expectedUnitPrice)}원</strong>
            <span style={{ opacity: 0.8 }}>
              {" "}
              (마진 {expectedUnitMargin}% ·
              <strong
                style={{
                  color: labelColor(expectedUnitLabel),
                  fontWeight: 700,
                }}
              >
                {expectedUnitLabel}
              </strong>
              )
            </span>
          </div>

          <button
            type="button"
            onClick={() => setEditedUnitPrice(expectedUnitPrice)}
            style={{ padding: "6px 10px" }}
          >
            단가에 적용
          </button>
        </div>

        {/* 원가 → 단가 (예상/적용 + 현재 마진 진단) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 6,
            marginTop: 8,
          }}
        >
          <label
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span>단가:</span>
            <input
              type="number"
              min={0}
              value={editedUnitPrice}
              onChange={(e) => setEditedUnitPrice(Number(e.target.value) || 0)}
              style={{ width: "100%" }}
            />
          </label>

          {/* 현재 단가 마진 진단 */}
          <div style={{ fontSize: 13 }}>
            현재 단가 마진: <strong>{unitMargin}%</strong> ·
            <strong style={{ color: labelColor(unitLabel), fontWeight: 700 }}>
              {unitLabel}
            </strong>
            <span style={{ opacity: 0.6 }}>
              {" "}
              (기준: 생산자 {PRODUCER.low}~{PRODUCER.high}%)
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: 8,
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ whiteSpace: "nowrap" }}>단가 마진(%)</span>
            <input
              type="number"
              step="0.1"
              value={unitMarkupPct}
              onChange={(e) => setUnitMarkupPct(Number(e.target.value) || 0)}
              placeholder="예: 20"
              style={{ width: "100%" }}
            />
          </label>

          <div style={{ fontSize: 13 }}>
            예상 판매가: <strong>{formatKRW(expectedSalePrice)}원</strong>{" "}
            <span style={{ opacity: 0.8 }}>
              (마진 {expectedSaleMargin}% · {expectedSaleLabel})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setEditedSalePrice(expectedSalePrice)}
            style={{ padding: "6px 10px" }}
          >
            판매가에 적용
          </button>
        </div>

        {/* 단가 → 판매가 (예상/적용 + 현재 마진 진단) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 6,
            marginTop: 12,
          }}
        >
          <label
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span>판매가:</span>
            <input
              type="number"
              min={0}
              value={editedSalePrice}
              onChange={(e) => setEditedSalePrice(Number(e.target.value) || 0)}
              style={{ width: "100%" }}
            />
          </label>

          {/* 현재 판매가 마진 진단 */}
          <div style={{ fontSize: 13 }}>
            현재 판매가 마진: <strong>{saleMargin}%</strong> ·
            <strong style={{ color: labelColor(saleLabel), fontWeight: 700 }}>
              {saleLabel}
            </strong>
            <span style={{ opacity: 0.6 }}>
              {" "}
              (기준: 납품업체 {SUPPLIER.low}~{SUPPLIER.high}%)
            </span>
          </div>
        </div>

        {/* 수량 */}
        <p>
          <strong>입고 수량:</strong>
          <input
            type="number"
            min={0}
            value={editedInQty}
            onChange={(e) => setEditedInQty(Number(e.target.value) || 0)}
            style={{ width: "100%" }}
          />
        </p>
        <p>
          <strong>출고 수량:</strong>
          <input
            type="number"
            min={0}
            value={editedOutQty}
            onChange={(e) => setEditedOutQty(Number(e.target.value) || 0)}
            style={{ width: "100%" }}
          />
        </p>

        {/* 브랜드 */}
        <p>
          <strong>브랜드:</strong>
          <input
            value={editedBrand}
            onChange={(e) => setEditedBrand(e.target.value)}
            placeholder="#조계사 #템플스테이 형식도 가능"
            style={{ width: "100%" }}
          />
        </p>

        {/* 이미지 변경 */}
        <p>
          <strong>이미지 수정:</strong>
          <input type="file" accept="image/*" onChange={handleImageChange} />
        </p>

        {/* 최근 기록 & 재고 */}
        <p>
          <strong>최근 입고:</strong> {product.입고기록?.at(-1)?.수량 ?? 0}개
        </p>
        <p>
          <strong>입고 날짜:</strong> {product.입고기록?.at(-1)?.날짜 ?? "-"}
        </p>
        <p>
          <strong>최근 출고:</strong> {product.출고기록?.at(-1)?.수량 ?? 0}개
        </p>
        <p>
          <strong>출고 날짜:</strong> {product.출고기록?.at(-1)?.날짜 ?? "-"}
        </p>
        <p>
          <strong>재고:</strong> {getStockCount(product)}개
        </p>

        <div
          style={{
            marginTop: "16px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <button onClick={onClose}>닫기</button>
          <button onClick={handleUpdate} disabled={isUpdating}>
            수정하기
          </button>
        </div>
      </div>
    </div>
  );
}
