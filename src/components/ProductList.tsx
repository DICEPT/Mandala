import { useEffect, useState, ChangeEvent } from "react";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  updateDoc,
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

type SortKey = "번호" | "상품번호" | "상품명" | "브랜드";
type SortOrder = "asc" | "desc";
type BulkField = "원가" | "단가" | "판매가";

export default function ProductList() {
  const [products, setProducts] = useState<ProductWithId[]>([]);
  const [keyword, setKeyword] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("번호");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedProduct, setSelectedProduct] = useState<ProductWithId | null>(
    null
  );
  const [bulkField, setBulkField] = useState<BulkField>("판매가");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedCategory1, setSelectedCategory1] = useState<string>("");
  const [selectedCategory2, setSelectedCategory2] = useState<string>("");
  const [allBrand, setAllBrand] = useState<string[]>([]);
  const [allCategory1, setAllCategory1] = useState<string[]>([]);
  const [allCategory2, setAllCategory2] = useState<string[]>([]);

  const itemsPerPage = 700;

  useEffect(() => {
    fetchProducts();
  }, []);

  // ✅ CSV 유틸: 엑셀 호환(BOM 포함) + 셀 이스케이프
  const csvEscape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const getLatest = (arr?: { 금액?: number; 날짜?: string }[]) =>
    Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : undefined;

  const toKSTStamp = () => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(kst.getUTCDate()).padStart(2, "0");
    const hh = String(kst.getUTCHours()).padStart(2, "0");
    const mm = String(kst.getUTCMinutes()).padStart(2, "0");
    const ss = String(kst.getUTCSeconds()).padStart(2, "0");
    return `${y}${m}${d}_${hh}${mm}${ss}`;
  };

  const buildCsv = (list: ProductWithId[]) => {
    const header = [
      "순번(3자리)",
      "상품번호",
      "상품명",
      "카테고리1",
      "카테고리2",
      "브랜드",
      "원가(최신)",
      "단가(최신)",
      "판매가(최신)",
      "재고",
      "최근입고수량",
      "최근입고일",
      "최근출고수량",
      "최근출고일",
      "이미지경로",
    ];

    const rows = list.map((p) => {
      const stockIn = p.입고기록 ?? [];
      const stockOut = p.출고기록 ?? [];
      const lastIn = stockIn.at(-1);
      const lastOut = stockOut.at(-1);
      const latestCost = getLatest(p.원가이력)?.금액 ?? "";
      const latestUnit = getLatest(p.단가이력)?.금액 ?? "";
      const latestPrice = getLatest(p.판매가이력)?.금액 ?? "";
      // 재고 계산 (이미 getStockCount 있음)
      const stock = typeof getStockCount === "function" ? getStockCount(p) : "";

      const imagePath = p.사진이력?.at(-1)?.경로 ?? "";

      return [
        String(p.번호 ?? "").padStart(3, "0"),
        p.상품번호 ?? "",
        p.상품명 ?? "",
        p.카테고리1 ?? "",
        p.카테고리2 ?? "",
        p.브랜드 ?? "",
        latestCost,
        latestUnit,
        latestPrice,
        stock,
        lastIn?.수량 ?? "",
        lastIn?.날짜 ?? "",
        lastOut?.수량 ?? "",
        lastOut?.날짜 ?? "",
        imagePath,
      ]
        .map(csvEscape)
        .join(",");
    });

    return [header.map(csvEscape).join(","), ...rows].join("\n");
  };

  const downloadCsv = (list: ProductWithId[], suffix: string) => {
    const csv = buildCsv(list);
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    }); // BOM 포함
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products_${suffix}_${toKSTStamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
    const brands = Array.from(
      new Set(
        productList
          .map((p) => p.브랜드)
          .filter((x): x is string => typeof x === "string")
      )
    );

    setAllBrand(brands);
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

  const getTotalOut = (product: ProductWithId): number => {
    return product.출고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
  };

  const getTotalIn = (product: ProductWithId): number => {
    return product.입고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
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
    // 🔹 문자열 정규화 (소문자 + trim)
    const norm = (v?: string) =>
      typeof v === "string" ? v.trim().toLowerCase() : "";

    const kw = norm(keyword);

    // 🔹 키워드 검색 범위: 상품명, 상품번호, 브랜드
    const matchKeyword =
      norm(p.상품명).includes(kw) ||
      norm(p.상품번호).includes(kw) ||
      norm(p.브랜드).includes(kw);

    const matchCategory1 =
      !selectedCategory1 || p.카테고리1 === selectedCategory1;
    const matchCategory2 =
      !selectedCategory2 || p.카테고리2 === selectedCategory2;
    const matchBrand = !selectedBrand || p.브랜드 === selectedBrand;

    return matchKeyword && matchCategory1 && matchCategory2 && matchBrand;
  });

  const getSortValue = (p: ProductWithId, key: SortKey) => {
    switch (key) {
      case "번호":
        return Number(p.번호) || 0; // 🔹 숫자 변환해서 정렬
      case "상품번호":
        return p.상품번호 ?? "";
      case "상품명":
        return p.상품명 ?? "";
      case "브랜드":
        return p.브랜드 ?? "";
      default:
        return "";
    }
  };

  const sorted = [...filtered].sort((a, b) => {
    const aValue = getSortValue(a, sortKey);
    const bValue = getSortValue(b, sortKey);

    const aNum = Number(aValue);
    const bNum = Number(bValue);
    const bothNumeric = !Number.isNaN(aNum) && !Number.isNaN(bNum);

    if (bothNumeric) {
      return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
    }
    const aStr = String(aValue);
    const bStr = String(bValue);
    return sortOrder === "asc"
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  const pageCount = Math.ceil(sorted.length / itemsPerPage);
  const offset = currentPage * itemsPerPage;
  const paginatedProducts = sorted.slice(offset, offset + itemsPerPage);

  const handleBulkPriceUpdate = async () => {
    if (selectedIds.length === 0) {
      alert("수정할 상품을 선택하세요.");
      return;
    }
    if (bulkValue.trim() === "" || Number.isNaN(Number(bulkValue))) {
      alert("수정값을 숫자로 입력하세요.");
      return;
    }

    const value = Number(bulkValue);
    const ts = getKSTTimestamp();

    const historyKey =
      bulkField === "원가"
        ? "원가이력"
        : bulkField === "단가"
        ? "단가이력"
        : "판매가이력";

    setIsUpdating(true);
    try {
      const selectedProducts = products.filter((p) =>
        selectedIds.includes(p.id)
      );

      await Promise.all(
        selectedProducts.map(async (p) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prevHistory = (p as any)[historyKey] ?? [];
          const newHistory = [...prevHistory, { 금액: value, 날짜: ts }];

          // 🔸 문서 전체를 덮어쓰지 않고 해당 필드만 갱신
          await updateDoc(doc(db, "products", p.id), {
            [historyKey]: newHistory,
          });
        })
      );

      alert(
        `${selectedProducts.length}개 상품의 ${bulkField}를 업데이트했습니다.`
      );
      setBulkValue("");
      fetchProducts();
    } catch (err) {
      console.error("일괄 수정 오류:", err);
      alert("일괄 수정 중 오류가 발생했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

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
          <option value="브랜드">브랜드</option>
        </select>
        <select
          value={selectedBrand}
          onChange={(e) => {
            setSelectedBrand(e.target.value);
            setCurrentPage(0);
          }}
        >
          <option value="">브랜드 선택</option>
          {allBrand
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
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
        {/* 일괄 가격 수정 UI */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={bulkField}
            onChange={(e) => setBulkField(e.target.value as BulkField)}
            title="수정할 항목"
          >
            <option value="원가">원가</option>
            <option value="단가">단가</option>
            <option value="판매가">판매가</option>
          </select>

          <input
            type="number"
            placeholder="수정 금액(원)"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            style={{ width: 140 }}
          />

          <button
            onClick={handleBulkPriceUpdate}
            disabled={
              isUpdating ||
              selectedIds.length === 0 ||
              bulkValue.trim() === "" ||
              Number.isNaN(Number(bulkValue))
            }
          >
            {isUpdating ? "수정 중..." : "수정"}
          </button>
        </div>
        <button
          onClick={() => downloadCsv(sorted, "filtered_all")}
          title="필터+정렬된 전체 결과를 CSV로 저장"
        >
          CSV 내보내기
        </button>

        {/* <button
          onClick={() => downloadCsv(paginatedProducts, "current_page")}
          title="현재 페이지 항목만 CSV로 저장"
        >
          CSV 내보내기(현재 페이지)
        </button> */}
      </div>

      <ul>
        {paginatedProducts.map((p) => {
          const currentStock = getStockCount(p);
          const imagePath = p.사진이력?.at(-1)?.경로;
          const totalOut = getTotalOut(p);
          const totalIn = getTotalIn(p);

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
                  {String(p.번호).padStart(3, "0")}
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
                {/* 🔽 텍스트 영역: 세로 정렬로 묶기 */}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <strong style={{ display: "block" }}>
                    상품명:{" "}
                    {[p.상품번호, p.상품명, p.카테고리2, p.알사이즈]
                      .filter(Boolean)
                      .join("_")}
                  </strong>

                  <div>
                    {p.카테고리1} / {p.카테고리2} / {p.브랜드}
                    <br />
                    원가: {p.원가이력?.[p.원가이력.length - 1]?.금액}원 / 단가:{" "}
                    {p.단가이력?.[p.단가이력.length - 1]?.금액}원 / 판매가:{" "}
                    {p.판매가이력?.[p.판매가이력.length - 1]?.금액}원
                    <br />
                    <strong>누적 입고:</strong> {totalIn}개 /{" "}
                    <strong>누적 출고:</strong> {totalOut}개
                    {p.알수량 ? <strong> / 알 수량:</strong> : ""}
                    {p.알수량 ? `${p.알수량}개` : ""}
                    <br />
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
