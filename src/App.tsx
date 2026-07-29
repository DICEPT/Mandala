import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import RegisterPage from "./pages/RegisterPage";
import ListPage from "./pages/ListPage";
import StockPage from "./pages/StockPage";
import LowStockPage from "./pages/LowStockPage";
import StockHistoryPage from "./pages/StockHistoryPage";
import EstimatePage from "./pages/EstimatePage";
import EstimateListPage from "./pages/EstimateListPage";

const queryClient = new QueryClient();

export default function App() {
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

  // 비밀번호 인증 전 화면
  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-4 font-sans">
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl flex flex-col items-center w-full max-w-sm space-y-4"
        >
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-slate-100 flex items-center justify-center gap-2">
              🔒 보관함 접근 제한
            </h2>
            <p className="text-xs text-slate-400">
              시스템에 접근하려면 비밀번호를 입력해주세요.
            </p>
          </div>

          <input
            type="password"
            placeholder="비밀번호 입력"
            value={inputPw}
            onChange={(e) => {
              setInputPw(e.target.value);
              setError("");
            }}
            className="w-full py-2.5 px-3.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            autoFocus
          />

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition shadow-md"
          >
            접근 승인
          </button>

          {error && (
            <p className="text-rose-400 text-xs font-medium text-center pt-1">
              {error}
            </p>
          )}
        </form>
      </div>
    );
  }

  // 메뉴 리스트 정의
  const navItems = [
    { to: "/", label: "신규 상품 등록", icon: "➕" },
    { to: "/list", label: "상품 리스트", icon: "📦" },
    { to: "/stock-history", label: "입출고 전체 이력", icon: "📋" },
    { to: "/low-stock", label: "재고 부족 리스트", icon: "⚠️" },
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        {/* 전체 컨테이너: 왼쪽 정렬 (justify-start) */}
        <div className="flex justify-start min-h-screen w-full bg-slate-950 text-slate-100 font-sans">
          
          {/* 좌측 고정 사이드바 */}
          <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 sticky top-0 h-screen">
            {/* 로고 & 타이틀 */}
            <div className="p-4 border-b border-slate-800 flex items-center gap-2.5">
              <span className="text-lg">🏪</span>
              <div>
                <h1 className="font-bold text-slate-100 text-xs leading-tight">
                  재고 및 물류 관리
                </h1>
                <p className="text-[10px] text-slate-500 mt-0.5">Admin Dashboard</p>
              </div>
            </div>

            {/* 네비게이션 메뉴 */}
            <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition duration-150 ${
                      isActive
                        ? "bg-blue-600 text-white font-semibold shadow-md border border-blue-500/50"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`
                  }
                >
                  <span className="text-sm">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* 하단 푸터 */}
            {/* <div className="p-3 border-t border-slate-800 text-[10px] text-slate-500 text-left px-4">
              Logged in Authorized
            </div> */}
          </aside>

          {/* 우측 메인 콘텐츠 영역 (좌측 밀착) */}
          <main className="flex-1 min-w-0 overflow-x-hidden p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<RegisterPage />} />
              <Route path="/list" element={<ListPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/stock-history" element={<StockHistoryPage />} />
              <Route path="/low-stock" element={<LowStockPage />} />
              <Route path="/estimate" element={<EstimatePage />} />
              <Route path="/estimate-list" element={<EstimateListPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}