import { useEffect, useState, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Product, PriceHistory, StockRecord } from "../types/Product";
import ProductModal from "./ProductModal";
import ProductImage from "./ProductImage";
import ReactPaginate from "react-paginate";
import "./ProductListPagination.css";
import QRCodeDisplay from "./QRCodeDisplay";

interface ProductWithId extends Product {
  id: string;
}

// 🔹 any 대체용 주문 아이템 타입 정의
interface OrderCartItem {
  id: string;
  product: ProductWithId;
  orderQty: number;
  price: number;
}

type SortKey = "번호" | "상품번호" | "상품명" | "브랜드";
type SortOrder = "asc" | "desc";
type BulkField = "원가" | "단가" | "판매가" | "입고" | "출고" | "브랜드";

export default function ProductList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductWithId[]>([]);
  const [keyword, setKeyword] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("번호");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedProduct, setSelectedProduct] = useState<ProductWithId | null>(null);
  const [bulkField, setBulkField] = useState<BulkField>("판매가");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedCategory1, setSelectedCategory1] = useState<string>("");
  const [selectedCategory2, setSelectedCategory2] = useState<string>("");
  const [allBrand, setAllBrand] = useState<string[]>([]);
  const [allCategory1, setAllCategory1] = useState<string[]>([]);
  const [allCategory2, setAllCategory2] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

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

  const getStockCount = (product: ProductWithId): number => {
    const totalIn = product.입고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    const totalOut = product.출고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
    return totalIn - totalOut;
  };

  const buildCsv = (list: ProductWithId[]) => {
    const header = [
      "순번(3자리)", "상품번호", "상품명", "카테고리1", "카테고리2",
      "브랜드", "원가(최신)", "단가(최신)", "판매가(최신)", "재고",
      "최근입고수량", "최근입고일", "최근출고수량", "최근출고일", "이미지경로",
    ];

    const rows = list.map((p) => {
      const stockIn = p.입고기록 ?? [];
      const stockOut = p.출고기록 ?? [];
      const lastIn = stockIn.at(-1);
      const lastOut = stockOut.at(-1);
      const latestCost = getLatest(p.원가이력)?.금액 ?? "";
      const latestUnit = getLatest(p.단가이력)?.금액 ?? "";
      const latestPrice = getLatest(p.판매가이력)?.금액 ?? "";
      const stock = getStockCount(p);
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
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
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
    const productList: ProductWithId[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as ProductWithId[];
    setProducts(productList);
    setSelectedIds([]);

    const categories1 = Array.from(new Set(productList.map((p) => p.카테고리1).filter((x): x is string => typeof x === "string")));
    const categories2 = Array.from(new Set(productList.map((p) => p.카테고리2).filter((x): x is string => typeof x === "string")));
    const brands = Array.from(new Set(productList.map((p) => p.브랜드).filter((x): x is string => typeof x === "string")));

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
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().replace("T", " ").substring(0, 19);
  };

  const handleDelete = async (id: string) => {
    const productToDelete = products.find((p) => p.id === id);
    if (!productToDelete) return;

    if (!window.confirm("정말로 이 상품을 삭제하시겠습니까?")) return;

    try {
      const deletedAt = getKSTTimestamp();
      await setDoc(doc(db, "deleteList", id), { ...productToDelete, deletedAt });
      await deleteDoc(doc(db, "products", id));
      alert("상품이 삭제되었습니다.");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("삭제 오류:", error);
      alert("상품 삭제 중 오류가 발생했습니다.");
    }
  };

  const getTotalOut = (product: ProductWithId): number => product.출고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;
  const getTotalIn = (product: ProductWithId): number => product.입고기록?.reduce((sum, rec) => sum + rec.수량, 0) ?? 0;

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert("삭제할 상품을 선택하세요.");
      return;
    }
    if (!window.confirm(`${selectedIds.length}개 상품을 삭제하시겠습니까?`)) return;

    try {
      const toDelete = products.filter((p) => selectedIds.includes(p.id));
      const deletedAt = getKSTTimestamp();

      await Promise.all(
        toDelete.map(async (product) => {
          await setDoc(doc(db, "deleteList", product.id), { ...product, deletedAt });
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

  // 🔹 주문서 담기 (any 타입 및 미사용 변수 제거)
  const handleAddToOrder = () => {
    if (selectedIds.length === 0) {
      alert("주문서에 담을 상품을 먼저 선택해주세요.");
      return;
    }

    const savedCart = localStorage.getItem("orderList");
    const existingOrders: OrderCartItem[] = savedCart ? JSON.parse(savedCart) : [];

    const selectedProducts = products.filter((p) => selectedIds.includes(p.id));
    const newOrders = [...existingOrders];

    selectedProducts.forEach((p) => {
      const existingIndex = newOrders.findIndex((item) => item.id === p.id);
      const latestPrice = getLatest(p.판매가이력)?.금액 ?? getLatest(p.단가이력)?.금액 ?? 0;

      if (existingIndex > -1) {
        newOrders[existingIndex].orderQty += 1;
      } else {
        newOrders.push({
          id: p.id,
          product: p,
          orderQty: 1,
          price: latestPrice,
        });
      }
    });

    localStorage.setItem("orderList", JSON.stringify(newOrders));

    if (
      window.confirm(
        `${selectedProducts.length}개 상품을 주문서에 담았습니다.\n주문서 페이지로 바로 이동하시겠습니까?`
      )
    ) {
      navigate("/estimate");
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const filtered = products.filter((p) => {
    const norm = (v?: string) => (typeof v === "string" ? v.trim().toLowerCase() : "");
    const kw = norm(keyword);
    const matchKeyword =
      norm(p.상품명).includes(kw) || norm(p.상품번호).includes(kw) || norm(p.브랜드).includes(kw);
    const matchCategory1 = !selectedCategory1 || p.카테고리1 === selectedCategory1;
    const matchCategory2 = !selectedCategory2 || p.카테고리2 === selectedCategory2;
    const matchBrand = !selectedBrand || p.브랜드 === selectedBrand;

    return matchKeyword && matchCategory1 && matchCategory2 && matchBrand;
  });

  const getSortValue = (p: ProductWithId, key: SortKey) => {
    switch (key) {
      case "번호": return Number(p.번호) || 0;
      case "상품번호": return p.상품번호 ?? "";
      case "상품명": return p.상품명 ?? "";
      case "브랜드": return p.브랜드 ?? "";
      default: return "";
    }
  };

  const sorted = [...filtered].sort((a, b) => {
    const aValue = getSortValue(a, sortKey);
    const bValue = getSortValue(b, sortKey);
    const aNum = Number(aValue);
    const bNum = Number(bValue);

    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
      return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
    }
    const aStr = String(aValue);
    const bStr = String(bValue);
    return sortOrder === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  const pageCount = Math.ceil(sorted.length / itemsPerPage);
  const offset = currentPage * itemsPerPage;
  const paginatedProducts = sorted.slice(offset, offset + itemsPerPage);

  // 🔹 any 대신 안전한 속성 접근으로 수정
  const handleBulkPriceUpdate = async () => {
    if (selectedIds.length === 0) {
      alert("수정할 상품을 선택하세요.");
      return;
    }
    if (bulkValue.trim() === "") {
      alert("수정할 값을 입력하세요.");
      return;
    }
    if (
      ["원가", "단가", "판매가", "입고", "출고"].includes(bulkField) &&
      Number.isNaN(Number(bulkValue))
    ) {
      alert("수량 또는 금액은 숫자로 입력하세요.");
      return;
    }

    const ts = getKSTTimestamp();
    setIsUpdating(true);

    try {
      const selectedProducts = products.filter((p) => selectedIds.includes(p.id));
      await Promise.all(
        selectedProducts.map(async (p) => {
          if (bulkField === "브랜드") {
            await updateDoc(doc(db, "products", p.id), { 브랜드: bulkValue.trim() });
          } else if (bulkField === "입고" || bulkField === "출고") {
            const historyKey = bulkField === "입고" ? "입고기록" : "출고기록";
            const prevHistory = (p[historyKey] as StockRecord[] | undefined) ?? [];
            await updateDoc(doc(db, "products", p.id), {
              [historyKey]: [...prevHistory, { 수량: Number(bulkValue), 날짜: ts }],
            });
          } else {
            const historyKey =
              bulkField === "원가" ? "원가이력" : bulkField === "단가" ? "단가이력" : "판매가이력";
            const prevHistory = (p[historyKey] as PriceHistory[] | undefined) ?? [];
            await updateDoc(doc(db, "products", p.id), {
              [historyKey]: [...prevHistory, { 금액: Number(bulkValue), 날짜: ts }],
            });
          }
        })
      );

      alert(`${selectedProducts.length}개 상품의 ${bulkField}를 업데이트했습니다.`);
      setBulkValue("");
      fetchProducts();
    } catch (err) {
      console.error("일괄 수정 오류:", err);
      alert("일괄 수정 중 오류가 발생했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  const inputStyle =
    "bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition";

  return (
    <div className="max-w-6xl mx-auto p-6 bg-slate-950 text-slate-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-100">상품 목록 관리</h1>
        <button
          onClick={() => navigate("/estimate")}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow flex items-center gap-1.5"
        >
          🛒 주문서(견적서) 확인하기
        </button>
      </div>

      {/* 검색 / 필터 / 일괄처리 바 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="검색 (상품명 또는 상품번호)"
            value={keyword}
            onChange={handleSearch}
            className={`${inputStyle} flex-1 min-w-[200px]`}
          />

          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={inputStyle}>
            <option value="번호">순번 정렬</option>
            <option value="상품명">상품명 정렬</option>
            <option value="상품번호">상품번호 정렬</option>
            <option value="브랜드">브랜드 정렬</option>
          </select>

          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)} className={inputStyle}>
            <option value="asc">오름차순</option>
            <option value="desc">내림차순</option>
          </select>

          <select
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value);
              setCurrentPage(0);
            }}
            className={inputStyle}
          >
            <option value="">브랜드 전체</option>
            {allBrand.slice().sort((a, b) => a.localeCompare(b)).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedCategory1}
            onChange={(e) => {
              setSelectedCategory1(e.target.value);
              setCurrentPage(0);
            }}
            className={inputStyle}
          >
            <option value="">카테고리1 전체</option>
            {allCategory1.slice().sort((a, b) => a.localeCompare(b)).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedCategory2}
            onChange={(e) => {
              setSelectedCategory2(e.target.value);
              setCurrentPage(0);
            }}
            className={inputStyle}
          >
            <option value="">카테고리2 전체</option>
            {allCategory2.slice().sort((a, b) => a.localeCompare(b)).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(0);
            }}
            className={`${inputStyle} text-blue-400 font-semibold`}
            title="페이지당 표시 개수"
          >
            <option value={50}>50개씩 보기</option>
            <option value={100}>100개씩 보기</option>
            <option value={200}>200개씩 보기</option>
            <option value={300}>300개씩 보기</option>
            <option value={400}>400개씩 보기</option>
            <option value={500}>500개씩 보기</option>
          </select>
        </div>

        {/* 액션 버튼 영역 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer select-none mr-1">
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
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
              />
              전체 선택
            </label>

            <button
              onClick={handleAddToOrder}
              disabled={selectedIds.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-2 rounded-lg font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
            >
              📝 주문서에 담기 ({selectedIds.length})
            </button>

            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.length === 0}
              className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs px-3 py-2 rounded-lg font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              선택 삭제 ({selectedIds.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={bulkField}
              onChange={(e) => {
                setBulkField(e.target.value as BulkField);
                setBulkValue("");
              }}
              title="수정할 항목"
              className={inputStyle}
            >
              <option value="원가">원가</option>
              <option value="단가">단가</option>
              <option value="판매가">판매가</option>
              <option value="입고">입고(수량 추가)</option>
              <option value="출고">출고(수량 추가)</option>
              <option value="브랜드">브랜드</option>
            </select>

            <input
              type={bulkField === "브랜드" ? "text" : "number"}
              placeholder={
                bulkField === "브랜드"
                  ? "브랜드명 입력"
                  : bulkField === "입고" || bulkField === "출고"
                  ? "수량 입력"
                  : "수정 금액(원)"
              }
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className={`${inputStyle} w-36`}
            />

            <button
              onClick={handleBulkPriceUpdate}
              disabled={
                isUpdating ||
                selectedIds.length === 0 ||
                bulkValue.trim() === ""
              }
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isUpdating ? "수정 중..." : "일괄 수정"}
            </button>

            <button
              onClick={() => downloadCsv(sorted, "filtered_all")}
              title="필터+정렬된 전체 결과를 CSV로 저장"
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg transition"
            >
              📥 CSV 내보내기
            </button>
          </div>
        </div>
      </div>

      {/* 상품 카드 목록 */}
      <div className="space-y-3">
        {paginatedProducts.map((p) => {
          const currentStock = getStockCount(p);
          const imagePath = p.사진이력?.at(-1)?.경로;
          const totalOut = getTotalOut(p);
          const totalIn = getTotalIn(p);

          const getStockBadgeClass = (stock: number) => {
            if (stock <= 20) return "bg-rose-950/80 text-rose-300 border-rose-800";
            if (stock <= 50) return "bg-amber-950/80 text-amber-300 border-amber-800";
            if (stock <= 100) return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
            return "bg-slate-800 text-slate-300 border-slate-700";
          };

          return (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4 transition shadow-md"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(p.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSelection(p.id);
                }}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
              />

              <div
                className="flex items-center gap-4 flex-1 cursor-pointer min-w-0"
                onClick={() => setSelectedProduct(p)}
              >
                <span className="text-xs font-mono font-bold text-slate-500 w-10 text-center shrink-0">
                  {String(p.번호).padStart(3, "0")}
                </span>

                <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center">
                  {imagePath ? (
                    <ProductImage path={imagePath} />
                  ) : (
                    <span className="text-[10px] text-slate-600">이미지 없음</span>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="text-sm font-semibold text-slate-100 truncate">
                    {[p.상품번호, p.상품명, p.카테고리2, p.알사이즈].filter(Boolean).join("_")}
                  </h3>

                  <p className="text-xs text-slate-400">
                    <span className="text-slate-300">{p.카테고리1 || "-"}</span> /{" "}
                    <span className="text-slate-300">{p.카테고리2 || "-"}</span> /{" "}
                    <span className="text-blue-400 font-medium">{p.브랜드 || "브랜드 미지정"}</span>
                  </p>

                  <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                    <span>원가: <strong className="text-slate-200">{getLatest(p.원가이력)?.금액 ?? 0}원</strong></span>
                    <span>단가: <strong className="text-slate-200">{getLatest(p.단가이력)?.금액 ?? 0}원</strong></span>
                    <span>판매가: <strong className="text-slate-200">{getLatest(p.판매가이력)?.금액 ?? 0}원</strong></span>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-2 pt-0.5">
                    <span>누적 입고: <strong className="text-slate-300">{totalIn}</strong>개</span>
                    <span>/</span>
                    <span>누적 출고: <strong className="text-slate-300">{totalOut}</strong>개</span>
                    {p.알수량 && (
                      <>
                        <span>/</span>
                        <span>알 수량: <strong className="text-slate-300">{p.알수량}개</strong></span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <span
                    className={`inline-block border text-xs font-bold px-2.5 py-1 rounded-full ${getStockBadgeClass(
                      currentStock
                    )}`}
                  >
                    재고 {currentStock}개
                  </span>
                </div>
              </div>

              <div className="shrink-0 px-2 border-l border-slate-800">
                <QRCodeDisplay value={p.상품번호} />
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(p.id);
                }}
                className="shrink-0 text-slate-500 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800 transition"
                title="상품 삭제"
              >
                ❌
              </button>
            </div>
          );
        })}
      </div>

      {/* 페이지네이션 */}
      <div className="mt-6 flex justify-center">
        <ReactPaginate
          previousLabel={"← 이전"}
          nextLabel={"다음 →"}
          breakLabel={"..."}
          pageCount={pageCount}
          marginPagesDisplayed={1}
          pageRangeDisplayed={5}
          onPageChange={({ selected }) => setCurrentPage(selected)}
          forcePage={currentPage}
          containerClassName={"pagination"}
          activeClassName={"active"}
          disabledClassName={"disabled"}
        />
      </div>

      {/* 상품 상세 및 수정 모달 */}
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