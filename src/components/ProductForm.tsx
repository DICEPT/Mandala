import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { Product } from "../types/Product";
import Papa from "papaparse";

interface ParsedCSVRow {
  상품번호?: string;
  상품명: string;
  카테고리1?: string;
  카테고리2?: string;
  바코드?: string;
  원가?: string;
  단가?: string;
  판매가?: string;
  입고수량?: string;
  최초_납품_상품명1?: string;
  최초_납품_상품명2?: string;
  원자재?: string;
  알수량?: string;
  알사이즈?: string;
  메모?: string;
  브랜드?: string;
  계절행사?: string;
  가로?: string;
  세로?: string;
}

export default function ProductForm() {
  const [product, setProduct] = useState<
    Pick<
      Product,
      | "상품번호"
      | "상품명"
      | "카테고리1"
      | "카테고리2"
      | "바코드"
      | "최초_납품_상품명1"
      | "최초_납품_상품명2"
      | "원자재"
      | "알사이즈"
      | "메모"
      | "브랜드"
      | "알수량"
      | "계절행사"
      | "가로"
      | "세로"
    >
  >({
    상품번호: "",
    상품명: "",
    카테고리1: "",
    카테고리2: "",
    최초_납품_상품명1: "",
    최초_납품_상품명2: "",
    바코드: "",
    원자재: "",
    알사이즈: "",
    메모: "",
    브랜드: "",
    알수량: "",
    계절행사: "",
    가로: "",
    세로: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [원가, set원가] = useState<number>(0);
  const [단가, set단가] = useState<number>(0);
  const [판매가, set판매가] = useState<number>(0);
  const [입고수량, set입고수량] = useState<number>(0);
  const [categories1, setCategories1] = useState<string[]>([]);
  const [categories2, setCategories2] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [brandInput, setBrandInput] = useState("");
  const [brands, setBrands] = useState<string[]>([]);

  const getKSTTimestamp = (): string => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().replace("T", " ").substring(0, 19);
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setProduct((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleAddBrand = () => {
    const trimmed = brandInput.trim();
    if (trimmed && !brands.includes(trimmed)) {
      setBrands([...brands, trimmed]);
      setBrandInput("");
    }
  };

  const handleRemoveBrand = (brandToRemove: string) => {
    setBrands(brands.filter((b) => b !== brandToRemove));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let imageUrl = "";
    const today = getKSTTimestamp();

    try {
      const autoNumber = await fetchNextNumber();

      if (file) {
        const safeFileName = `${Date.now()}_${encodeURIComponent(file.name)}`;
        const imageRef = ref(storage, `productImages/${safeFileName}`);
        await uploadBytes(imageRef, file);
        imageUrl = await getDownloadURL(imageRef);
      }

      const newProduct: Product = {
        ...product,
        번호: autoNumber,
        브랜드: [...brands].sort((a, b) => a.localeCompare(b, "ko")).join(", "),
        사진이력: imageUrl ? [{ 날짜: today, 경로: imageUrl }] : [],
        원가이력: [{ 날짜: today, 금액: 원가 }],
        판매가이력: [{ 날짜: today, 금액: 판매가 }],
        단가이력: [{ 날짜: today, 금액: 단가 }],
        삭제이력_단가: [],
        입고기록: 입고수량 > 0 ? [{ 날짜: today, 수량: 입고수량 }] : [],
        삭제이력_입고: [],
        출고기록: [],
        삭제이력_출고: [],
        createdAt: serverTimestamp(),
        상품_카테고리2: "",
      };

      await addDoc(collection(db, "products"), newProduct);
      alert("상품이 성공적으로 등록되었습니다.");

      setProduct({
        상품번호: "",
        상품명: "",
        카테고리1: "",
        카테고리2: "",
        최초_납품_상품명1: "",
        최초_납품_상품명2: "",
        바코드: "",
        원자재: "",
        알사이즈: "",
        메모: "",
        알수량: "",
        계절행사: "",
        가로: "",
        세로: "",
      });
      setBrands([]);
      set원가(0);
      set단가(0);
      set판매가(0);
      set입고수량(0);
      setFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("상품 등록 중 오류:", error);
      alert("상품 등록 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
    }
  };

  useEffect(() => {
    const fetchNextProductNumber = async () => {
      const snapshot = await getDocs(collection(db, "products"));
      const productNumbers = snapshot.docs
        .map((doc) => doc.data().상품번호)
        .filter((num) => typeof num === "string" && num.startsWith("BS"));

      const maxNumber = productNumbers.reduce((max, curr) => {
        const parsed = parseInt(curr?.replace("BS", ""), 10);
        return parsed > max ? parsed : max;
      }, 0);

      const nextNumber = `BS${String(maxNumber + 1).padStart(4, "0")}`;
      setProduct((prev) =>
        prev.상품번호 ? prev : { ...prev, 상품번호: nextNumber }
      );
    };

    const fetchCategories = async () => {
      const snapshot = await getDocs(collection(db, "products"));
      const products = snapshot.docs.map((doc) => doc.data() as Product);

      const cat1: string[] = Array.from(
        new Set(
          products
            .map((p) => p.카테고리1)
            .filter((v): v is string => Boolean(v))
        )
      );
      const cat2: string[] = Array.from(
        new Set(
          products
            .map((p) => p.카테고리2)
            .filter((v): v is string => Boolean(v))
        )
      );

      setCategories1(cat1);
      setCategories2(cat2);
    };

    fetchNextProductNumber();
    fetchCategories();
  }, []);

  const fetchNextNumber = async (): Promise<number> => {
    const snapshot = await getDocs(collection(db, "products"));
    const numbers = snapshot.docs
      .map((doc) => Number(doc.data().번호))
      .filter((n) => !isNaN(n));
    const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
    return maxNumber + 1;
  };

  const handleBulkUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmUpload = window.confirm("이 파일을 업로드하시겠습니까?");
    if (!confirmUpload) return;

    setUploading(true);
    setProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const today = getKSTTimestamp();
        const parsedData = results.data as ParsedCSVRow[];

        const existingSnapshot = await getDocs(collection(db, "products"));
        const existingNumbers = existingSnapshot.docs
          .map((doc) => Number(doc.data().번호))
          .filter((n) => !isNaN(n));
        let currentMax =
          existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;

        for (let i = 0; i < parsedData.length; i++) {
          const row = parsedData[i];
          const newNumber = ++currentMax;

          const newProduct: Product = {
            번호: newNumber,
            사진이력: [],
            상품번호:
              row["상품번호"] ?? `BS${String(newNumber).padStart(4, "0")}`,
            상품명: row["상품명"],
            카테고리1: row["카테고리1"] ?? "",
            카테고리2: row["카테고리2"] ?? "",
            원자재: row["원자재"] ?? "",
            알수량: row["알수량"] ?? "",
            알사이즈: row["알사이즈"] ?? "",
            브랜드: row["브랜드"] ?? "",
            계절행사: row["계절행사"] ?? "",
            원가이력: row["원가"]
              ? [{ 날짜: today, 금액: Number(row["원가"]) }]
              : [],
            단가이력: row["단가"]
              ? [{ 날짜: today, 금액: Number(row["단가"]) }]
              : [],
            판매가이력: row["판매가"]
              ? [{ 날짜: today, 금액: Number(row["판매가"]) }]
              : [],
            입고기록: row["입고수량"]
              ? [{ 날짜: today, 수량: Number(row["입고수량"]) }]
              : [],
            삭제이력_단가: [],
            삭제이력_입고: [],
            출고기록: [],
            삭제이력_출고: [],
            바코드: row["바코드"] ?? "",
            가로: row["가로"] ?? "",
            세로: row["세로"] ?? "",
            최초_납품_상품명1: row["최초_납품_상품명1"] ?? "",
            최초_납품_상품명2: row["최초_납품_상품명2"] ?? "",
            메모: row["메모"] ?? "",
            createdAt: serverTimestamp(),
            상품_카테고리2: "",
          };

          try {
            await addDoc(collection(db, "products"), newProduct);
            setProgress(Math.round(((i + 1) / parsedData.length) * 100));
          } catch (err) {
            console.error("등록 실패:", err);
          }
        }

        setUploading(false);
        setProgress(100);
        alert("엑셀 데이터 등록 완료!");
      },
    });
  };

  const CSV_HEADERS = [
    "상품번호",
    "상품명",
    "카테고리1",
    "카테고리2",
    "바코드",
    "원가",
    "단가",
    "판매가",
    "입고수량",
    "최초_납품_상품명1",
    "최초_납품_상품명2",
    "원자재",
    "알수량",
    "알사이즈",
    "메모",
    "브랜드",
    "계절행사",
    "가로",
    "세로",
  ];

  const handleDownloadCsvTemplate = () => {
    const csv = Papa.unparse({
      fields: CSV_HEADERS,
      data: [Array(CSV_HEADERS.length).fill("")],
    });

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "product_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // 인풋 스타일을 공통 클래스로 다크모드 전용 정의
  const inputStyle =
    "w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

  return (
    <div className="max-w-4xl mx-auto p-6 bg-slate-950 text-slate-100 min-h-screen">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">신규 상품 등록</h1>

      {/* CSV 업로드 영역 */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg mb-6">
        <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">
          CSV 대량 등록
        </h2>

        {uploading && (
          <div className="mb-4">
            <div className="flex justify-between text-sm font-medium text-slate-300 mb-1">
              <span>업로드 진행 중...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white transition">
            <span className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg border border-slate-700 font-medium text-xs">
              CSV 파일 선택
            </span>
            <input
              type="file"
              accept=".csv"
              onChange={handleBulkUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleDownloadCsvTemplate}
            className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg font-medium transition"
          >
            📥 CSV 양식 다운로드
          </button>
        </div>
      </div>

      {/* 개별 상품 등록 폼 */}
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg space-y-6"
      >
        {/* 기본 정보 Section */}
        <div>
          <h2 className="text-base font-semibold text-slate-200 mb-4 pb-2 border-b border-slate-800">
            기본 정보
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                상품번호 <span className="text-rose-400">*</span>
              </label>
              <input
                name="상품번호"
                value={product.상품번호}
                onChange={handleChange}
                placeholder="예: BS0007"
                required
                className={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                상품명 <span className="text-rose-400">*</span>
              </label>
              <input
                name="상품명"
                value={product.상품명}
                onChange={handleChange}
                required
                className={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                카테고리 1
              </label>
              <div className="flex gap-2">
                <select
                  name="카테고리1"
                  value={product.카테고리1}
                  onChange={handleChange}
                  className={`${inputStyle} w-1/2`}
                >
                  <option value="">선택</option>
                  {categories1.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <input
                  name="카테고리1"
                  value={product.카테고리1}
                  onChange={handleChange}
                  placeholder="직접 입력"
                  className={`${inputStyle} w-1/2`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                카테고리 2
              </label>
              <div className="flex gap-2">
                <select
                  name="카테고리2"
                  value={product.카테고리2}
                  onChange={handleChange}
                  className={`${inputStyle} w-1/2`}
                >
                  <option value="">선택</option>
                  {categories2.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <input
                  name="카테고리2"
                  value={product.카테고리2}
                  onChange={handleChange}
                  placeholder="직접 입력"
                  className={`${inputStyle} w-1/2`}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                바코드
              </label>
              <input
                name="바코드"
                value={product.바코드}
                onChange={handleChange}
                className={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* 가격 및 수량 Section */}
        <div>
          <h2 className="text-base font-semibold text-slate-200 mb-4 pb-2 border-b border-slate-800">
            가격 및 재고
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                원가
              </label>
              <input
                type="number"
                value={원가}
                onChange={(e) => set원가(Number(e.target.value))}
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                단가
              </label>
              <input
                type="number"
                value={단가}
                onChange={(e) => set단가(Number(e.target.value))}
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                판매가
              </label>
              <input
                type="number"
                value={판매가}
                onChange={(e) => set판매가(Number(e.target.value))}
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                최초 입고 수량
              </label>
              <input
                type="number"
                value={입고수량}
                onChange={(e) => set입고수량(Number(e.target.value))}
                className={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* 상세 사양 Section */}
        <div>
          <h2 className="text-base font-semibold text-slate-200 mb-4 pb-2 border-b border-slate-800">
            제품 규격 및 특성
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                최초 납품 상품명 1 <span className="text-rose-400">*</span>
              </label>
              <input
                name="최초_납품_상품명1"
                value={product.최초_납품_상품명1}
                onChange={handleChange}
                required
                className={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                최초 납품 상품명 2
              </label>
              <input
                name="최초_납품_상품명2"
                value={product.최초_납품_상품명2}
                onChange={handleChange}
                className={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                원자재
              </label>
              <input
                name="원자재"
                value={product.원자재}
                onChange={handleChange}
                className={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                계절행사
              </label>
              <input
                name="계절행사"
                value={product.계절행사}
                onChange={handleChange}
                className={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                알수량
              </label>
              <input
                name="알수량"
                value={product.알수량}
                onChange={handleChange}
                className={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                알사이즈
              </label>
              <input
                name="알사이즈"
                value={product.알사이즈}
                onChange={handleChange}
                className={inputStyle}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                제품 사이즈 (mm)
              </label>
              <div className="flex gap-2 items-center">
                <input
                  name="가로"
                  value={product.가로}
                  onChange={handleChange}
                  placeholder="가로"
                  className={inputStyle}
                />
                <span className="text-slate-500">×</span>
                <input
                  name="세로"
                  value={product.세로}
                  onChange={handleChange}
                  placeholder="세로"
                  className={inputStyle}
                />
              </div>
            </div>

            {/* 브랜드 태그 선택 영역 */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                브랜드 태그
              </label>
              <div className="flex gap-2 mb-2">
                <select
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  className={inputStyle}
                >
                  <option value="">브랜드 선택</option>
                  <option value="조계사">조계사</option>
                  <option value="템플스테이">템플스테이</option>
                  <option value="보살">보살</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddBrand}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0"
                >
                  추가
                </button>
              </div>

              <div className="flex gap-1.5 flex-wrap min-h-[36px] p-2 bg-slate-950 border border-slate-800 rounded-lg">
                {brands.length === 0 && (
                  <span className="text-xs text-slate-500 self-center">
                    선택된 브랜드가 없습니다.
                  </span>
                )}
                {brands.map((brand) => (
                  <span
                    key={brand}
                    className="bg-blue-950 text-blue-300 border border-blue-800 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium"
                  >
                    {brand}
                    <button
                      type="button"
                      onClick={() => handleRemoveBrand(brand)}
                      className="text-blue-400 hover:text-blue-200 font-bold leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                메모
              </label>
              <input
                name="메모"
                value={product.메모}
                onChange={handleChange}
                className={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* 이미지 영역 */}
        <div>
          <h2 className="text-base font-semibold text-slate-200 mb-4 pb-2 border-b border-slate-800">
            상품 이미지
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">
              이미지 첨부
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
            />
          </div>

          {previewUrl && (
            <div className="mt-3">
              <span className="block text-xs font-semibold text-slate-400 mb-1">
                미리보기
              </span>
              <div className="w-32 h-32 border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <img
                  src={previewUrl}
                  alt="미리보기"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>

        {/* 제출 버튼 */}
        <div className="pt-4 border-t border-slate-800">
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition duration-150 ease-in-out"
          >
            상품 등록 완료
          </button>
        </div>
      </form>
    </div>
  );
}