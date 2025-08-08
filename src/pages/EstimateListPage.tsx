import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Estimate } from "../types/Product";
import { Timestamp } from "firebase/firestore";

export default function EstimateListPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);

  useEffect(() => {
    const fetchEstimates = async () => {
      const snap = await getDocs(collection(db, "estimates"));
      const data = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          createdAt: d.createdAt,
          items: d.items,
          total: d.total,
        } as Estimate;
      });
      setEstimates(data);
    };
    fetchEstimates();
  }, []);

  const formatDate = (timestamp: Timestamp) => {
    try {
      return timestamp.toDate().toLocaleDateString("ko-KR");
    } catch {
      return "-";
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">견적서 리스트</h2>
      <table className="w-full border border-collapse border-gray-300">
        <thead>
          <tr className="bg-gray-100 text-black">
            <th className="border px-3 py-2">날짜</th>
            <th className="border px-3 py-2">총 품목수</th>
            <th className="border px-3 py-2">합계</th>
            <th className="border px-3 py-2">보기</th>
          </tr>
        </thead>
        <tbody>
          {estimates.map((est) => (
            <tr key={est.id}>
              <td className="border px-3 py-2">{formatDate(est.createdAt)}</td>
              <td className="border px-3 py-2 text-center">{est.items.length}</td>
              <td className="border px-3 py-2 text-right">{est.total.toLocaleString()}원</td>
              <td className="border px-3 py-2 text-center">
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
