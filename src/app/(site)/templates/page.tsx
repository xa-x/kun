import type { Metadata } from "next";
import { TemplateGallery } from "@/components/TemplateGallery";

export const metadata: Metadata = {
  title: "Templates",
  description: "Published workbooks you can clone and make your own.",
};

export default function TemplatesPage() {
  return <TemplateGallery />;
}
