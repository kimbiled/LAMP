import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// Главный адрес сайта: вошедших отправляем на Dashboard, остальных — на вход.
export default async function RootPage() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
