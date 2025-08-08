import { Timestamp } from "firebase/firestore";
import { FieldValue } from "firebase/firestore";

export interface PriceHistory {
  날짜: string;
  금액: number;
}

export interface PhotoHistory {
  날짜: string;
  경로: string;
}

export interface StockRecord {
  날짜: string;
  수량: number;
}

export interface Product {
  상품_카테고리2: string;
  상품번호: string;
  번호: number;
  상품명?: string;
  사진이력: PhotoHistory[];
  원가이력: PriceHistory[];
  판매가이력: PriceHistory[];
  단가이력?: PriceHistory[];
  삭제이력_단가?: PriceHistory[];
  입고기록?: StockRecord[];
  삭제이력_입고?: StockRecord[];
  출고기록?: StockRecord[];
  삭제이력_출고?: StockRecord[];

  // 기타 정보
  브랜드?: string;
  상품명_종합?: string;
  최초_납품_상품명1?: string;
  최초_납품_상품명2?: string;
  카테고리1?: string;
  카테고리2?: string;
  알수량?: string;
  계절_연도?: string;
  온라인_판매처?: string;
  관리_상품명?: string;
  QR코드?: string;
  사이즈?: string;
  바코드?: string;
  createdAt?: FieldValue;

  // 🔽 추가 필드
  조계사_납품명?: string;
  템플스테이_납품명?: string;
  원자재?: string;
  알사이즈?: string;
  메모?: string;
  계절행사: string;
  가로: string;
  세로: string;
}

export interface EstimateItem {
  no: number;
  name: string;
  size: string;
  qty: number;
  price: number;
  amount: number;
  note: string;
}

export interface Estimate {
  id: string;
  createdAt: Timestamp;
  items: EstimateItem[];
  total: number;
}
