/** Los fondos de las historias de texto, con los nombres que guarda el servidor. */
export const STORY_GRADIENTS: Record<string, string> = {
  sunset: 'linear-gradient(135deg, #f7931e 0%, #f05a22 45%, #e1306c 100%)',
  ocean: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
  forest: 'linear-gradient(135deg, #56ab2f 0%, #1d7a46 100%)',
  berry: 'linear-gradient(135deg, #8e2de2 0%, #e1306c 100%)',
  night: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
  sand: 'linear-gradient(135deg, #e6c79c 0%, #c79a5b 100%)',
  coral: 'linear-gradient(135deg, #ff9a8b 0%, #ff6a88 55%, #ff99ac 100%)',
  mint: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
};

export function storyBackground(name: string | null | undefined): string {
  return STORY_GRADIENTS[name ?? ''] ?? STORY_GRADIENTS['sunset'] ?? '#f05a22';
}

/** Las tipografías de las historias de texto. */
export const STORY_FONT_FAMILIES: Record<string, string> = {
  classic: "Georgia, 'Times New Roman', serif",
  modern: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  typewriter: "'Courier New', ui-monospace, monospace",
  bold: "Impact, 'Arial Black', system-ui, sans-serif",
};

export function storyFont(name: string | null | undefined): string {
  return STORY_FONT_FAMILIES[name ?? ''] ?? STORY_FONT_FAMILIES['modern'] ?? 'sans-serif';
}
