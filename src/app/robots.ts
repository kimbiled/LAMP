import type { MetadataRoute } from "next";

// LAMP — внутренняя система компании. Поисковикам здесь делать нечего.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
