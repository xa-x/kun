import type { Metadata } from "next";
import { HomeGallery } from "@/components/HomeGallery";

export const metadata: Metadata = { title: "Workbooks" };

export default function WorkbooksPage() {
  return <HomeGallery />;
}
