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
  const [progress, setProgress] = useState(0); // % 단위 진행률
  const [brandInput, setBrandInput] = useState("");
  const [brands, setBrands] = useState<string[]>([]);

  const getKSTTimestamp = (): string => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC + 9시간
    return kst.toISOString().replace("T", " ").substring(0, 19); // "YYYY-MM-DD HH:mm:ss"
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setProduct((prev) => ({ ...prev, [name]: value }));
  };

  // 🔽 이미지 변경 시 미리보기 설정
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile)); // 미리보기 URL 생성
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
        원자재: product.원자재,
        알수량: product.알수량,
        계절행사: product.계절행사,
        가로: product.가로,
        세로: product.세로,
        최초_납품_상품명1: product.최초_납품_상품명1,
        최초_납품_상품명2: product.최초_납품_상품명2,
        createdAt: serverTimestamp(),
        상품_카테고리2: ""
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

    setUploading(true); // 로딩 시작
    setProgress(0); // 초기화

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
            상품번호: row["상품번호"] ?? `BS${String(newNumber).padStart(4, "0")}`,
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
            최초_납품_상품명1: row["세로"] ?? "",
            최초_납품_상품명2: row["세로"] ?? "",
            메모: row["메모"] ?? "",
            createdAt: serverTimestamp(),
            상품_카테고리2: ""
          };

          try {
            await addDoc(collection(db, "products"), newProduct);
            setProgress(Math.round(((i + 1) / parsedData.length) * 100));
          } catch (err) {
            console.error("등록 실패:", err);
          }
        }

        setUploading(false); // 로딩 끝
        setProgress(100);
        alert("엑셀 데이터 등록 완료!");
      },
    });
  };

  return (
    <>
      {uploading && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontWeight: "bold" }}>업로드 중... {progress}%</div>
          <div
            style={{
              width: "100%",
              height: "10px",
              backgroundColor: "#eee",
              borderRadius: "4px",
              marginTop: "4px",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                backgroundColor: "#4caf50",
                borderRadius: "4px",
                transition: "width 0.2s ease",
              }}
            ></div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <label>
          CSV 업로드 (상품 대량 등록):
          <input
            type="file"
            accept=".csv"
            onChange={handleBulkUpload}
            style={{ marginLeft: "8px" }}
          />
        </label>
      </div>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
      >
        <label>
          상품번호:
          <input
            name="상품번호"
            value={product.상품번호}
            onChange={handleChange}
            placeholder="예: BS0007"
            required
          />
        </label>
        <label>
          상품명:
          <input
            name="상품명"
            value={product.상품명}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          카테고리1:
          <select
            name="카테고리1"
            value={product.카테고리1}
            onChange={handleChange}
          >
            <option value="">-- 선택 또는 직접 입력 --</option>
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
          />
        </label>
        <label>
          카테고리2:
          <select
            name="카테고리2"
            value={product.카테고리2}
            onChange={handleChange}
          >
            <option value="">-- 선택 또는 직접 입력 --</option>
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
          />
        </label>
        <label>
          바코드:
          <input name="바코드" value={product.바코드} onChange={handleChange} />
        </label>
        <label>
          원가:
          <input
            type="number"
            value={원가}
            onChange={(e) => set원가(Number(e.target.value))}
          />
        </label>
        <label>
          단가:
          <input
            type="number"
            value={단가}
            onChange={(e) => set단가(Number(e.target.value))}
          />
        </label>
        <label>
          판매가:
          <input
            type="number"
            value={판매가}
            onChange={(e) => set판매가(Number(e.target.value))}
          />
        </label>
        <label>
          최초 입고 수량:
          <input
            type="number"
            value={입고수량}
            onChange={(e) => set입고수량(Number(e.target.value))}
          />
        </label>
        <label>
          이미지 업로드:
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </label>
        {previewUrl && (
          <div style={{ marginBottom: "10px" }}>
            <strong>이미지 미리보기:</strong>
            <br />
            <img
              src={previewUrl}
              alt="미리보기"
              style={{ width: "200px", marginTop: "8px", objectFit: "cover" }}
            />
          </div>
        )}
        <label>
          최초_납품_상품명1:
          <input
            name="최초_납품_상품명1"
            value={product.최초_납품_상품명1}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          최초_납품_상품명2:
          <input
            name="최초_납품_상품명2"
            value={product.최초_납품_상품명2}
            onChange={handleChange}
          />
        </label>
        <label>
          원자재:
          <input name="원자재" value={product.원자재} onChange={handleChange} />
        </label>
        <label>
          알사이즈:
          <input
            name="알사이즈"
            value={product.알사이즈}
            onChange={handleChange}
          />
        </label>
        <label>
          제품사이즈(가로세로):
          <input name="가로" value={product.가로} onChange={handleChange} />
          <input name="세로" value={product.세로} onChange={handleChange} />
        </label>

        <div>
          <label>브랜드 (태그 추가 방식)</label>
          <div className="flex gap-2 mb-2">
            <select
              className="border px-2 py-1"
              value={brandInput}
              onChange={(e) => setBrandInput(e.target.value)}
            >
              <option value="">브랜드 선택</option>
              <option value="조계사">조계사</option>
              <option value="템플스테이">템플스테이</option>
              <option value="보살">보살</option>
            </select>
            <button
              type="button"
              onClick={handleAddBrand}
              className="bg-blue-500 text-white px-3 py-1 rounded"
            >
              추가
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {brands.map((brand) => (
              <span
                key={brand}
                className="bg-gray-200 px-2 py-1 rounded flex items-center gap-1"
              >
                {brand}
                <button
                  type="button"
                  onClick={() => handleRemoveBrand(brand)}
                  className="text-red-500 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        <label>
          원자재:
          <input name="원자재" value={product.원자재} onChange={handleChange} />
        </label>
        <label>
          알수량:
          <input name="알수량" value={product.알수량} onChange={handleChange} />
        </label>
        <label>
          계절행사:
          <input
            name="계절행사"
            value={product.계절행사}
            onChange={handleChange}
          />
        </label>
        <label>
          가로(mm):
          <input name="가로" value={product.가로} onChange={handleChange} />
        </label>
        <label>
          세로(mm):
          <input name="세로" value={product.세로} onChange={handleChange} />
        </label>
        <label>
          메모:
          <input name="메모" value={product.메모} onChange={handleChange} />
        </label>
        <button type="submit">상품 등록</button>
      </form>
    </>
  );
}
