import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import RegisterPage from "./pages/RegisterPage";
import ListPage from "./pages/ListPage";
import StockPage from "./pages/StockPage";
import LowStockPage from "./pages/LowStockPage";
import StockHistoryPage from "./pages/StockHistoryPage";
import EstimatePage from "./pages/EstimatePage";
import EstimateListPage from "./pages/EstimateListPage";

const queryClient = new QueryClient();

function App() {
  const [authorized, setAuthorized] = useState(false);
  const [inputPw, setInputPw] = useState("");
  const [error, setError] = useState("");
  const PASSWORD = import.meta.env.VITE_APP_PASSWORD;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (inputPw === PASSWORD) {
      setAuthorized(true);
    } else {
      setError("비밀번호가 틀렸습니다.");
      setInputPw("");
    }
  };

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#000] text-white font-sans">
        <form
          onSubmit={handleSubmit}
          className="bg-[#1a1a1a] p-8 rounded-lg border border-[#333] flex flex-col items-center w-[320px]"
        >
          <h2 className="text-xl font-bold mb-5 text-[#e4e4e7]">
            🔒 보관함 접근 제한
          </h2>
          <input
            type="password"
            placeholder="비밀번호 입력"
            value={inputPw}
            onChange={(e) => {
              setInputPw(e.target.value);
              setError("");
            }}
            className="w-full py-2.5 px-3 mb-4 rounded-md border border-[#444] bg-[#222] text-white text-center focus:outline-none focus:border-[#646cff]"
            autoFocus
          />
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-md bg-[#646cff] text-white font-bold hover:bg-[#535bf2] transition-colors"
          >
            확인
          </button>
          {error && (
            <p className="text-red-500 text-sm mt-3 text-center">{error}</p>
          )}
        </form>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <nav className="flex gap-4 my-5 mb-5 justify-center">
          <Link to="/">
            <button className="btn">상품 등록</button>
          </Link>

          <Link to="/list">
            <button className="btn">상품 리스트</button>
          </Link>

          <Link to="/stock">
            <button className="btn">입출고</button>
          </Link>

          <Link to="/stock-history">
            <button className="btn">입출고 전체 이력</button>
          </Link>

          <Link to="/low-stock">
            <button className="btn">재고 부족 리스트</button>
          </Link>
          {/* 
          <Link to="/estimate">
            <button className="btn">견적서 작성</button>
          </Link>

          <Link to="/estimate-list">
            <button className="btn">견적서 리스트</button>
          </Link> */}
        </nav>

        <Routes>
          <Route path="/" element={<RegisterPage />} />
          <Route path="/list" element={<ListPage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/stock-history" element={<StockHistoryPage />} />
          <Route path="/low-stock" element={<LowStockPage />} />
          <Route path="/estimate" element={<EstimatePage />} />
          <Route path="/estimate-list" element={<EstimateListPage />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;