import { TemplateDetail } from "@/components/TemplateDetail";

// Server component — slug awaited here rather than `use()`d in a client page.
export default async function TemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <TemplateDetail slug={slug} />;
}
