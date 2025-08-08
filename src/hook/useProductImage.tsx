import { useQuery } from "@tanstack/react-query";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase";

export function useProductImage(path: string) {
  return useQuery({
    queryKey: ["productImage", path],
    queryFn: async () => {
      const imageRef = ref(storage, path);
      return await getDownloadURL(imageRef);
    },
    staleTime: 1000 * 60 * 10, // 10분 캐시 유지
  });
}
