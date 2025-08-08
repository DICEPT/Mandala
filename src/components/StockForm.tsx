import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import { Product, StockRecord } from "../types/Product";

type ProductWithId = Product & { id: string };

export default function StockForm() {
  const [productId, setProductId] = useState<string>("");
  const [type, setType] = useState<"입고" | "출고">("입고");
  const [quantity, setQuantity] = useState<string>("");
  const [products, setProducts] = useState<ProductWithId[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithId | null>(
    null
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  useEffect(() => {
    const fetchProducts = async () => {
      const snapshot = await getDocs(collection(db, "products"));
      const items: ProductWithId[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProductWithId[];
      setProducts(items);
    };

    fetchProducts();
  }, []);

  const getKSTTimestamp = (): string => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC + 9시간
    return kst.toISOString().replace("T", " ").substring(0, 19); // "YYYY-MM-DD HH:mm:ss"
  };

  const handleProductChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setProductId(selectedId);
    const found = products.find((p) => p.id === selectedId) || null;
    setSelectedProduct(found);
  };

  const getSortedAndFilteredProducts = () => {
    return [...products]
      .filter((p) =>
        `${p.상품번호 ?? ""} ${p.상품명 ?? ""} ${p.원자재 ?? ""}`.includes(searchKeyword)
      )
      .sort((a, b) => {
        const aValue = a.상품번호 ?? "";
        const bValue = b.상품번호 ?? "";
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      });
  };

  const getStockCount = (product: ProductWithId): number => {
    const totalIn =
      product.입고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    const totalOut =
      product.출고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    return totalIn - totalOut;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const today = getKSTTimestamp();

    const record: StockRecord = {
      날짜: today,
      수량: parseInt(quantity, 10),
    };

    const productRef = doc(db, "products", productId);
    const field: "입고기록" | "출고기록" =
      type === "입고" ? "입고기록" : "출고기록";

    await updateDoc(productRef, {
      [field]: arrayUnion(record),
    });

    alert(`${type} 기록 완료`);
    setQuantity("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}
    >
      <label>
        정렬 순서:
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
        >
          <option value="asc">오름차순</option>
          <option value="desc">내림차순</option>
        </select>
      </label>

      <label>
        상품 검색:
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="상품번호 또는 상품명 검색"
        />
      </label>

      <label>
        상품 선택:
        <select value={productId} onChange={handleProductChange} required>
          <option value="">상품 선택</option>
          {getSortedAndFilteredProducts().map((p) => (
            <option key={p.id} value={p.id}>
              {[p.상품번호, p.상품명, p.원자재 ,p.카테고리2, p.알사이즈, p.알수량]
                .filter(Boolean)
                .join("_")}
            </option>
          ))}
        </select>
      </label>

      {selectedProduct && (
        <div
          style={{
            border: "1px solid #ccc",
            padding: "12px",
            borderRadius: "8px",
          }}
        >
          <strong>상품명:</strong> {selectedProduct.상품명} <br />
          <strong>재고:</strong> {getStockCount(selectedProduct)}개 <br />
          {selectedProduct.사진이력?.[0]?.경로 && (
            <img
              src={selectedProduct.사진이력[0].경로}
              alt="상품 이미지"
              width={100}
              style={{ marginTop: "8px", borderRadius: "4px" }}
            />
          )}
        </div>
      )}

      <label>
        구분:
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "입고" | "출고")}
        >
          <option value="입고">입고</option>
          <option value="출고">출고</option>
        </select>
      </label>

      <label>
        수량:
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </label>

      <button type="submit">기록</button>
    </form>
  );
}
