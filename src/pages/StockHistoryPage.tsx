import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Product } from "../types/Product";

interface ProductWithId extends Product {
  id: string;
  deletedAt?: string;
}

interface StockEntry {
  id: string;
  상품번호: string;
  상품명?: string;
  구분: "입고" | "출고";
  수량: number;
  날짜: string;
  상태?: "삭제됨";
  삭제시간?: string;
}

export default function StockHistoryPage() {
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const fetchData = async () => {
      const [productSnap, deletedSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "deleteList")),
      ]);

      const products = productSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProductWithId[];

      const deletedProducts = deletedSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProductWithId[];

      const allEntries: StockEntry[] = [];

      const processProduct = (product: ProductWithId, isDeleted = false) => {
        product.입고기록?.forEach((rec, index) => {
          allEntries.push({
            id: `${product.id}-in-${index}-${isDeleted ? "deleted" : "active"}`,
            상품번호: product.상품번호,
            상품명: product.상품명,
            구분: "입고",
            수량: rec.수량,
            날짜: rec.날짜,
            상태: isDeleted ? "삭제됨" : undefined,
            삭제시간: isDeleted ? product.deletedAt : undefined,
          });
        });

        product.출고기록?.forEach((rec, index) => {
          allEntries.push({
            id: `${product.id}-out-${index}-${
              isDeleted ? "deleted" : "active"
            }`,
            상품번호: product.상품번호,
            상품명: product.상품명,
            구분: "출고",
            수량: rec.수량,
            날짜: rec.날짜,
            상태: isDeleted ? "삭제됨" : undefined,
            삭제시간: isDeleted ? product.deletedAt : undefined,
          });
        });
      };

      products.forEach((p) => processProduct(p, false));
      deletedProducts.forEach((p) => processProduct(p, true));

      setEntries(sortEntries(allEntries, sortOrder));
    };

    fetchData();
  }, [sortOrder]);

  const sortEntries = (data: StockEntry[], order: "asc" | "desc") => {
    return data.sort((a, b) =>
      order === "asc"
        ? a.날짜.localeCompare(b.날짜)
        : b.날짜.localeCompare(a.날짜)
    );
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>상품 입출고 이력</h2>
      <button onClick={toggleSortOrder} style={{ marginBottom: "10px" }}>
        날짜 정렬: {sortOrder === "asc" ? "오름차순 ↑" : "내림차순 ↓"}
      </button>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>상품번호</th>
            <th style={thStyle}>상품명</th>
            <th style={thStyle}>구분</th>
            <th style={thStyle}>수량</th>
            <th style={thStyle}>날짜</th>
            <th style={thStyle}>비고</th>
            <th style={thStyle}>삭제시간</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              style={entry.상태 === "삭제됨" ? { opacity: 0.5 } : {}}
            >
              <td style={tdStyle}>{entry.상품번호}</td>
              <td style={tdStyle}>{entry.상품명}</td>
              <td style={tdStyle}>{entry.구분}</td>
              <td style={tdStyle}>{entry.수량}</td>
              <td style={tdStyle}>{entry.날짜}</td>
              <td style={tdStyle}>
                {entry.상태 === "삭제됨" ? "삭제된 상품" : ""}
              </td>
              <td style={tdStyle}>{entry.삭제시간 ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  border: "1px solid #ccc",
  padding: "8px",
  backgroundColor: "#f0f0f0",
  textAlign: "left" as const,
  color: "black",
};

const tdStyle = {
  border: "1px solid #ccc",
  padding: "8px",
};
