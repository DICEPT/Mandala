import { useEffect, useState, ChangeEvent } from "react";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Product } from "../types/Product";
import ProductModal from "./ProductModal";
import ProductImage from "./ProductImage";
import ReactPaginate from "react-paginate";
import "./ProductListPagination.css";
import QRCodeDisplay from "./QRCodeDisplay";

interface ProductWithId extends Product {
  id: string;
}

type SortKey = "번호" | "상품번호" | "상품명";
type SortOrder = "asc" | "desc";

export default function ProductList() {
  const [products, setProducts] = useState<ProductWithId[]>([]);
  const [keyword, setKeyword] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("번호");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedProduct, setSelectedProduct] = useState<ProductWithId | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [selectedCategory1, setSelectedCategory1] = useState<string>("");
  const [selectedCategory2, setSelectedCategory2] = useState<string>("");
  const [allCategory1, setAllCategory1] = useState<string[]>([]);
  const [allCategory2, setAllCategory2] = useState<string[]>([]);

  const itemsPerPage = 700;

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const snapshot = await getDocs(collection(db, "products"));
    const productList: ProductWithId[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ProductWithId[];
    setProducts(productList);
    setSelectedIds([]);
    const categories1 = Array.from(
      new Set(
        productList
          .map((p) => p.카테고리1)
          .filter((x): x is string => typeof x === "string")
      )
    );
    const categories2 = Array.from(
      new Set(
        productList
          .map((p) => p.카테고리2)
          .filter((x): x is string => typeof x === "string")
      )
    );

    setAllCategory1(categories1);
    setAllCategory2(categories2);
  };

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
    setCurrentPage(0);
  };

  const getKSTTimestamp = (): string => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC + 9시간
    return kst.toISOString().replace("T", " ").substring(0, 19); // "YYYY-MM-DD HH:mm:ss"
  };

  const handleDelete = async (id: string) => {
    const productToDelete = products.find((p) => p.id === id);
    if (!productToDelete) return;

    const confirmDelete = window.confirm("정말로 이 상품을 삭제하시겠습니까?");
    if (!confirmDelete) return;

    try {
      const deletedAt = getKSTTimestamp(); // ✅ 한국 시간

      await setDoc(doc(db, "deleteList", id), {
        ...productToDelete,
        deletedAt,
      });

      await deleteDoc(doc(db, "products", id));

      alert("상품이 삭제되었습니다.");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("삭제 오류:", error);
      alert("상품 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert("삭제할 상품을 선택하세요.");
      return;
    }

    const confirmDelete = window.confirm(
      `${selectedIds.length}개 상품을 삭제하시겠습니까?`
    );
    if (!confirmDelete) return;

    try {
      const toDelete = products.filter((p) => selectedIds.includes(p.id));
      const deletedAt = getKSTTimestamp(); // ✅ 한국 시간

      await Promise.all(
        toDelete.map(async (product) => {
          await setDoc(doc(db, "deleteList", product.id), {
            ...product,
            deletedAt,
          });
          await deleteDoc(doc(db, "products", product.id));
        })
      );

      alert("선택된 상품이 삭제되었습니다.");
      fetchProducts();
    } catch (error) {
      console.error("일괄 삭제 오류:", error);
      alert("일괄 삭제 중 오류가 발생했습니다.");
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const getStockCount = (product: ProductWithId): number => {
    const totalIn =
      product.입고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    const totalOut =
      product.출고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    return totalIn - totalOut;
  };

  const filtered = products.filter((p) => {
    const matchKeyword =
      p.상품명?.includes(keyword) || p.상품번호?.includes(keyword);
    const matchCategory1 =
      !selectedCategory1 || p.카테고리1 === selectedCategory1;
    const matchCategory2 =
      !selectedCategory2 || p.카테고리2 === selectedCategory2;
    return matchKeyword && matchCategory1 && matchCategory2;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aValue = a[sortKey] ?? "";
    const bValue = b[sortKey] ?? "";
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortOrder === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else if (!isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
      return sortOrder === "asc"
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue);
    }
    return 0;
  });

  const pageCount = Math.ceil(sorted.length / itemsPerPage);
  const offset = currentPage * itemsPerPage;
  const paginatedProducts = sorted.slice(offset, offset + itemsPerPage);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <input
          placeholder="검색 (상품명 또는 상품번호)"
          value={keyword}
          onChange={handleSearch}
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="번호">순번</option>
          <option value="상품명">상품명</option>
          <option value="상품번호">상품번호</option>
        </select>
        <select
          value={selectedCategory1}
          onChange={(e) => {
            setSelectedCategory1(e.target.value);
            setCurrentPage(0);
          }}
        >
          <option value="">카테고리1 전체</option>
          {allCategory1
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
        </select>

        <select
          value={selectedCategory2}
          onChange={(e) => {
            setSelectedCategory2(e.target.value);
            setCurrentPage(0);
          }}
        >
          <option value="">카테고리2 전체</option>
          {allCategory2
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
        </select>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
        >
          <option value="asc">오름차순</option>
          <option value="desc">내림차순</option>
        </select>
        <input
          type="checkbox"
          checked={
            selectedIds.length > 0 &&
            paginatedProducts.every((p) => selectedIds.includes(p.id))
          }
          onChange={(e) => {
            const isChecked = e.target.checked;
            if (isChecked) {
              const idsToAdd = paginatedProducts
                .map((p) => p.id)
                .filter((id) => !selectedIds.includes(id));
              setSelectedIds((prev) => [...prev, ...idsToAdd]);
            } else {
              const idsToRemove = paginatedProducts.map((p) => p.id);
              setSelectedIds((prev) =>
                prev.filter((id) => !idsToRemove.includes(id))
              );
            }
          }}
        />
        <span>전체 선택</span>

        <button onClick={handleBulkDelete} disabled={selectedIds.length === 0}>
          선택 삭제 ({selectedIds.length})
        </button>
      </div>

      <ul>
        {paginatedProducts.map((p) => {
          const currentStock = getStockCount(p);
          const imagePath = p.사진이력?.at(-1)?.경로;

          return (
            <li
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "10px 30px",
                margin: "10px 0",
                borderRadius: "10px",
                // borderBottom: "1px solid #ddd",
                paddingLeft: "30px",
                backgroundColor: "#ffffff08",
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(p.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSelection(p.id);
                }}
              />

              <div
                style={{
                  display: "flex",
                  cursor: "pointer",
                  flex: 1,
                  alignItems: "center",
                }}
                onClick={() => setSelectedProduct(p)}
              >
                <div
                  style={{
                    width: "50px",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  {p.번호}
                </div>
                <div
                  style={{
                    width: "100px",
                    height: "100px",
                    marginLeft: "10px",
                    marginRight: "10px",
                    borderRadius: "10px",
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  {imagePath ? (
                    <ProductImage path={imagePath} />
                  ) : (
                    <div
                      style={{
                        width: "100px",
                        height: "100px",
                        background: "#ffffff10",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        fontSize: "12px",
                        // objectFit: "cover"
                      }}
                    >
                      이미지 없음
                    </div>
                  )}
                </div>
                <strong>
                  상품명:
                  {[p.상품번호, p.상품명, p.카테고리2, p.알사이즈]
                    .filter(Boolean)
                    .join("_")}{" "}
                  &nbsp;
                </strong>
                <div>
                  {/* /상품번호: {p.상품번호} */}
                  {/* /상품명: {p.상품명} */} / {p.카테고리1} / {p.카테고리2}
                  {/* /원가: {p.원가이력?.[p.원가이력.length - 1]?.금액}원 */} /
                  단가:{p.단가이력?.[p.단가이력.length - 1]?.금액}원 / 판매가:
                  {p.판매가이력?.[p.판매가이력.length - 1]?.금액}원
                  {/* / 최근 입고: {p.입고기록?.[p.입고기록.length - 1]?.수량 ?? 0}개{" "}{p.입고기록?.[p.입고기록.length - 1]?.날짜 ?? "-"}
                  / 최근 출고: {p.출고기록?.[p.출고기록.length - 1]?.수량 ?? 0}개{" "}{p.출고기록?.[p.출고기록.length - 1]?.날짜 ?? "-"}  */}{" "}
                  /{" "}
                  <strong
                    style={{
                      color:
                        currentStock <= 20
                          ? "red"
                          : currentStock <= 50
                          ? "orange"
                          : currentStock <= 100
                          ? "green"
                          : "white",
                    }}
                  >
                    재고: {currentStock}개
                  </strong>
                </div>
              </div>

              <div>
                <QRCodeDisplay value={p.상품번호} />
              </div>

              <div>
                <button
                  style={{ height: "50px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p.id);
                  }}
                >
                  ❌ 삭제
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <ReactPaginate
        previousLabel={"← 이전"}
        nextLabel={"다음 →"}
        breakLabel={"..."}
        pageCount={pageCount}
        marginPagesDisplayed={1}
        pageRangeDisplayed={5}
        onPageChange={({ selected }) => setCurrentPage(selected)}
        containerClassName={"pagination"}
        activeClassName={"active"}
        disabledClassName={"disabled"}
      />

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onUpdated={fetchProducts}
        />
      )}
    </div>
  );
}
