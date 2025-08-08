import printJS from "print-js";
import { Estimate } from "../types/Product";
import { Timestamp } from "firebase/firestore";

interface EstimateModalProps {
  estimate: Estimate;
  onClose: () => void;
}

export default function EstimateModal({ estimate, onClose }: EstimateModalProps) {
  const handlePrint = () => {
    printJS({
      printable: "estimate-modal-print",
      type: "html",
      targetStyles: ["*"],
    });
  };

  const total = estimate.items.reduce((sum, item) => sum + item.amount, 0);

  const formatDate = (timestamp: Timestamp) => {
    try {
      return timestamp.toDate().toLocaleDateString("ko-KR");
    } catch {
      return "-";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded p-6 max-w-4xl w-full relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-600 hover:text-black">
          ✕
        </button>

        <div className="mb-4 flex justify-end print:hidden">
          <button
            onClick={handlePrint}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            인에하기
          </button>
        </div>

        <div id="estimate-modal-print" className="text-sm p-4">
          <div className="text-center text-xl font-bold mb-4">입고명세서</div>

          <div className="flex justify-between mb-2">
            <div>{formatDate(estimate.createdAt)}</div>
            <div>공급자: 엠케이플러스 | 사업자등록번호: 101-08-45868</div>
          </div>
          <div className="flex justify-between mb-4">
            <div>상호: 엠케이플러스 | 성명: 김홍준</div>
            <div>주소: 서울시 종로구 송월길 159</div>
          </div>
          <div className="mb-6">조계사 문화상품에 대해서 아래와 같이 입고 합니다.</div>

          <table className="w-full border border-black border-collapse mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-2 py-1">NO</th>
                <th className="border border-black px-2 py-1">품매</th>
                <th className="border border-black px-2 py-1">사이즈</th>
                <th className="border border-black px-2 py-1">수량</th>
                <th className="border border-black px-2 py-1">단가</th>
                <th className="border border-black px-2 py-1">공급가액</th>
                <th className="border border-black px-2 py-1">기타</th>
              </tr>
            </thead>
            <tbody>
              {estimate.items.map((item, i) => (
                <tr key={i}>
                  <td className="border border-black px-2 py-1 text-center">{item.no}</td>
                  <td className="border border-black px-2 py-1">{item.name}</td>
                  <td className="border border-black px-2 py-1 text-center">{item.size}</td>
                  <td className="border border-black px-2 py-1 text-right">{item.qty}</td>
                  <td className="border border-black px-2 py-1 text-right">{item.price.toLocaleString()}</td>
                  <td className="border border-black px-2 py-1 text-right">{item.amount.toLocaleString()}</td>
                  <td className="border border-black px-2 py-1">{item.note}</td>
                </tr>
              ))}
              {[...Array(12 - estimate.items.length)].map((_, idx) => (
                <tr key={`empty-${idx}`}>
                  <td className="border border-black px-2 py-1">{estimate.items.length + idx + 1}</td>
                  <td className="border border-black px-2 py-1" colSpan={6}></td>
                </tr>
              ))}
              <tr>
                <td className="border border-black px-2 py-1 text-center" colSpan={5}>합계</td>
                <td className="border border-black px-2 py-1 text-right font-bold">{total.toLocaleString()}</td>
                <td className="border border-black px-2 py-1"></td>
              </tr>
            </tbody>
          </table>

          <div className="mt-6">
            단당자: 김홍준 | H.P: 010-4272-6763 | 전화: 02-446-2901 | FAX: 0303-0303-2990
          </div>
        </div>
      </div>
    </div>
  );
}