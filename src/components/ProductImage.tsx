import { useProductImage } from "../hook/useProductImage";


interface Props {
  path: string;
}

export default function ProductImage({ path }: Props) {
  const { data: imageUrl, isLoading, isError } = useProductImage(path);

  if (isLoading) {
    return (
      <div
        style={{
          width: "100px",
          height: "100px",
          background: "#f0f0f0",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "12px",
        }}
      >
        로딩 중...
      </div>
    );
  }

  if (isError || !imageUrl) {
    return (
      <div
        style={{
          width: "100px",
          height: "100px",
          background: "#ffe5e5",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "12px",
          color: "red",
        }}
      >
        이미지 오류
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt="상품 이미지"
      width={100}
      height={100}
      style={{ objectFit: "cover" }}
    />
  );
}
