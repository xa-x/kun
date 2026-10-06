INSERT INTO "skills" ("id", "org_id", "source", "registry_id", "slug", "display_name", "description", "body", "installs", "created_by", "created_at", "updated_at") VALUES
('w03q1y8uma5l', 'k9gjw3v0z7pd', 'local', NULL, 'replicate-food-photo-style', 'Replicate Food Photo Style', '', '# Replicate Food Photo Style
Replicate the visual style, lighting, and composition of a provided food photograph.

## Rules
*   Generate an overhead photograph of a food dish.
*   The plate must be on a matte, solid warm-cream background.
*   Replicate harsh, dramatic, low-angle directional light from the left.
*   Ensure a deep, defined, elongated shadow of the entire plated composition extends to the right.
*   Maintain a clean, consistent warm-cream background color.
*   The focus must be sharp across the entire plate and food, emphasizing all textures.
*   Aim for a minimalist and nostalgic studio look.

## Prompting
High-resolution, professional overhead photograph of the entire composition, presented on a clean, vintage white ceramic plate with its exact thin dark blue rim, positioned centrally on a matte, solid warm-cream (light beige) background. Harsh, dramatic, low-angle directional light from the left, casting a deep, defined, elongated shadow of the entire plated composition to the right onto the surface. Clean and consistent warm-cream background. Sharp focus across the entire plate and food, emphasizing all textures. Minimalist and nostalgic studio look.', 0, 'hmyvlb63gb84', '2026-09-28T20:36:32.000Z'::timestamptz, '2026-09-28T20:39:09.901Z'::timestamptz),
('8dcpta28s1j8', 'k9gjw3v0z7pd', 'local', NULL, 'replicate-food-photo-style-preserve-original-plate', 'Replicate Food Photo Style — Preserve Original Plate', 'Replicates the visual style, lighting, background, shadow, and mood of a provided food photograph while keeping the original plate and food completely unchanged.', '# Replicate Food Photo Style — Preserve Original Plate & Food
Replicate only the visual style, lighting, background, shadow, and mood of a provided food photograph while keeping the original plate and food completely unchanged.

## Rules
* Use the provided food photograph as the exact subject reference. The original plate and food are locked content.
* Preserve the original plate 100%: same shape, size, thickness, rim, edge profile, material, color, pattern, glaze, texture, and any unique details.
* Do not change, replace, redesign, crop, warp, or stylize the plate.
* Preserve the food 100%: same ingredients, count, portions, arrangement, garnish, sauce, and texture.
* Do not add, remove, rearrange, or replace any food item.
* Keep the original composition and camera angle/perspective. If the source image is overhead, keep exact overhead framing. Do not force a different angle if it changes the plate’s perceived shape.
* Only modify: background to matte solid warm-cream, lighting to harsh dramatic low-angle directional from the left, shadow to deep elongated to the right, color grading, and minimalist nostalgic studio look.
* Keep sharp focus across the entire plate and food, emphasizing the original textures.
* If any style instruction conflicts with preserving the original plate/food details, prioritize preserving the original plate and food.

## Prompting
High-resolution, professional food photograph of the exact same dish from the reference image. Preserve the original plate and food 100% unchanged: same plate shape, size, rim, edge, material, color, pattern, glaze, texture, and unique details; same ingredients, portions, placement, garnish, sauce, and arrangement. Do not redesign, replace, crop, warp, or alter the plate or food. Keep the original camera angle and perspective; if the reference is overhead, keep exact overhead composition. Position the original plated composition centrally on a matte, solid warm-cream (light beige) background. Harsh, dramatic, low-angle directional light from the left, casting a deep, defined, elongated shadow of the entire plated composition to the right onto the surface. Clean, consistent warm-cream background. Sharp focus across the entire plate and food, emphasizing all original textures. Minimalist, nostalgic studio look. Only change the background, lighting, shadow, and color grade; preserve the original subject exactly.

Negative prompt:
changed plate shape, altered plate rim, different plate, new plate design, warped plate, distorted plate, altered food arrangement, added food, removed food, replaced ingredients, different garnish, different sauce, changed portions, changed perspective, cropped plate, stylized plate, redesigned plate, extra props, extra utensils.', 0, 'hmyvlb63gb84', '2026-09-28T20:56:25.000Z'::timestamptz, '2026-09-28T20:56:25.000Z'::timestamptz)
ON CONFLICT ("id") DO NOTHING;