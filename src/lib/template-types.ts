export interface TemplateMeta {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  cloneCount: number;
  featured: boolean;
  createdAt?: string | number;
}
