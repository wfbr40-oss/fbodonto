import { supabase, isSupabaseConfigured } from './supabase';

let logoCache: string | null = null;
let logoCarregada = false;

const FALLBACK_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80">
  <rect width="240" height="80" fill="#ffffff" rx="12"/>
  <g transform="translate(16, 16)">
    <path d="M24 2C16 2 12 8 12 16C12 21 14 26 16 32C18 38 16 46 20 46C24 46 26 40 28 36C30 32 34 32 36 36C38 40 40 46 44 46C48 46 46 38 48 32C50 26 52 21 52 16C52 8 48 2 40 2C32 2 28 8 24 2Z" fill="#0284c7" stroke="#0369a1" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="32" cy="16" r="3" fill="#ffffff"/>
  </g>
  <text x="84" y="38" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="26" fill="#0f172a">FB Odonto</text>
  <text x="84" y="56" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="12" fill="#64748b">Esterilização &amp; Qualidade</text>
</svg>`;

export async function carregarLogo(): Promise<string | null> {
  if (logoCarregada) return logoCache;

  try {
    if (isSupabaseConfigured) {
      const { data } = supabase.storage.from('config').getPublicUrl('logo.svg');
      if (data?.publicUrl) {
        const res = await fetch(data.publicUrl);
        if (res.ok) {
          const blob = await res.blob();
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          logoCache = dataUrl;
          logoCarregada = true;
          return logoCache;
        }
      }
    }
  } catch (e) {
    console.warn("Não foi possível carregar logo do Supabase Storage, usando fallback:", e);
  }

  // Fallback para SVG embutido
  const blob = new Blob([FALLBACK_LOGO_SVG], { type: 'image/svg+xml' });
  const reader = new FileReader();
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    logoCache = dataUrl;
    logoCarregada = true;
    return logoCache;
  } catch {
    logoCache = null;
    logoCarregada = true;
    return null;
  }
}
