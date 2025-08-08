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

  const getStockCount = (p: ProductWithId): number => {
    const totalIn = p.입고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    const totalOut = p.출고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    return totalIn - totalOut;
  };

  const getKSTTimestamp = (): string => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC + 9
    return kst.toISOString().replace("T", " ").substring(0, 19); // "YYYY-MM-DD HH:mm:ss"
  };

  // useEffect로 ESC 키 누르면 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
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

  const handleUpdate = async () => {
    const prevCost = product.원가이력?.at(-1)?.금액;
    const prevUnit = product.단가이력?.at(-1)?.금액;
    const prevSale = product.판매가이력?.at(-1)?.금액;

    const today = getKSTTimestamp();

    const updates: Partial<Product> = {};

    if (editedName !== product.상품명) updates.상품명 = editedName;

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
      const productRef = doc(db, "products", product.id);
      await updateDoc(productRef, updates);
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
          minWidth: "300px",
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

        <p>
          <strong>상품명:</strong>
          <input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            style={{ width: "100%" }}
          />
        </p>

        <p>
          <strong>원가:</strong>
          <input
            type="number"
            value={editedCost}
            onChange={(e) => setEditedCost(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </p>

        <p>
          <strong>단가:</strong>
          <input
            type="number"
            value={editedUnitPrice}
            onChange={(e) => setEditedUnitPrice(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </p>

        <p>
          <strong>판매가:</strong>
          <input
            type="number"
            value={editedSalePrice}
            onChange={(e) => setEditedSalePrice(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </p>

        <p>
          <strong>입고 수량:</strong>
          <input
            type="number"
            value={editedInQty}
            onChange={(e) => setEditedInQty(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </p>

        <p>
          <strong>출고 수량:</strong>
          <input
            type="number"
            value={editedOutQty}
            onChange={(e) => setEditedOutQty(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </p>

        <p>
          <strong>이미지 수정:</strong>
          <input type="file" accept="image/*" onChange={handleImageChange} />
        </p>

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
