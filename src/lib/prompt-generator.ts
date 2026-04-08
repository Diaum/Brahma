const PT_TO_EN: Record<string, string> = {
  // Corpo / Body
  magro: "thin",
  gordo: "fat",
  musculoso: "muscular",
  alto: "tall",
  baixo: "short",
  forte: "strong",
  esbelto: "slender",
  robusto: "stocky",
  atlético: "athletic",
  atletico: "athletic",
  obeso: "obese",
  franzino: "scrawny",
  encorpado: "heavyset",

  // Cabelo / Hair
  cabelo: "hair",
  careca: "bald",
  loiro: "blonde",
  moreno: "dark-haired",
  ruivo: "red-haired",
  grisalho: "gray-haired",
  cacheado: "curly",
  liso: "straight",
  ondulado: "wavy",
  "cabelo curto": "short hair",
  "cabelo longo": "long hair",
  "cabelo comprido": "long hair",
  "cabelo bagunçado": "messy hair",
  "cabelo baguncado": "messy hair",
  rastafári: "dreadlocks",
  rastafari: "dreadlocks",
  trança: "braids",
  tranca: "braids",
  "rabo de cavalo": "ponytail",
  franja: "bangs",

  // Rosto / Face
  barba: "beard",
  "barba por fazer": "stubble",
  "barba cheia": "full beard",
  bigode: "mustache",
  cavanhaque: "goatee",
  cicatriz: "scar",
  sardas: "freckles",
  olhos: "eyes",
  "olhos claros": "light eyes",
  "olhos escuros": "dark eyes",
  "olhos verdes": "green eyes",
  "olhos azuis": "blue eyes",
  "olhos castanhos": "brown eyes",
  sobrancelha: "eyebrow",
  "sobrancelha grossa": "thick eyebrows",
  nariz: "nose",
  "nariz largo": "wide nose",
  "nariz fino": "thin nose",
  rosto: "face",
  "rosto redondo": "round face",
  "rosto fino": "thin face",
  queixo: "chin",
  "queixo forte": "strong chin",
  bochecha: "cheeks",
  rugas: "wrinkles",

  // Roupas / Clothing
  camiseta: "t-shirt",
  camisa: "shirt",
  calça: "pants",
  calca: "pants",
  jeans: "jeans",
  bermuda: "shorts",
  shorts: "shorts",
  "shorts roxo escuro": "dark purple shorts",
  chinelo: "flip-flops",
  tênis: "sneakers",
  tenis: "sneakers",
  bota: "boots",
  sapato: "shoes",
  jaqueta: "jacket",
  moletom: "hoodie",
  colete: "vest",
  terno: "suit",
  gravata: "tie",
  boné: "cap",
  bone: "cap",
  chapéu: "hat",
  chapeu: "hat",
  óculos: "glasses",
  oculos: "glasses",
  "óculos escuros": "sunglasses",
  "oculos escuros": "sunglasses",
  relógio: "watch",
  relogio: "watch",
  corrente: "chain necklace",
  colar: "necklace",
  anel: "ring",
  brinco: "earring",
  tatuagem: "tattoo",
  piercing: "piercing",
  "camiseta de banda": "band t-shirt",
  "camiseta de banda antiga": "vintage band t-shirt",
  regata: "tank top",
  saia: "skirt",
  vestido: "dress",

  // Expressão / Expression
  sorrindo: "smiling",
  sério: "serious expression",
  serio: "serious expression",
  triste: "sad expression",
  bravo: "angry expression",
  pensativo: "thoughtful expression",
  cansado: "tired expression",
  determinado: "determined expression",
  assustado: "scared expression",
  confiante: "confident expression",
  tímido: "shy expression",
  timido: "shy expression",

  // Postura / Posture
  "de pé": "standing",
  "de pe": "standing",
  sentado: "sitting",
  encostado: "leaning",
  agachado: "crouching",
  andando: "walking",
  correndo: "running",
  deitado: "lying down",
  "braços cruzados": "arms crossed",
  "bracos cruzados": "arms crossed",
  "mãos no bolso": "hands in pockets",
  "maos no bolso": "hands in pockets",

  // Pele / Skin
  "pele clara": "light skin",
  "pele escura": "dark skin",
  "pele morena": "brown skin",
  "pele negra": "black skin",
  bronzeado: "tanned",
  pálido: "pale",
  palido: "pale",

  // Cores / Colors
  preto: "black",
  branco: "white",
  vermelho: "red",
  azul: "blue",
  verde: "green",
  amarelo: "yellow",
  roxo: "purple",
  laranja: "orange",
  rosa: "pink",
  cinza: "gray",
  marrom: "brown",
  escuro: "dark",
  claro: "light",
  velho: "old",
  novo: "new",
  antiga: "vintage",
  antigo: "vintage",
  rasgado: "torn",
  sujo: "dirty",
  limpo: "clean",
};

function translateWithDictionary(descriptionPt: string): string {
  let result = descriptionPt.toLowerCase();

  // Sort keys by length (longest first) to match multi-word phrases before single words
  const sortedKeys = Object.keys(PT_TO_EN).sort(
    (a, b) => b.length - a.length
  );

  for (const pt of sortedKeys) {
    const en = PT_TO_EN[pt];
    const regex = new RegExp(`\\b${pt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    result = result.replace(regex, en);
  }

  return result;
}

async function translateWithGemini(
  descriptionPt: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Translate the following Brazilian Portuguese physical description of a character into English. Keep it as a concise comma-separated list of physical attributes, clothing, and expression. Do NOT add any commentary, just the translated description.

Portuguese: "${descriptionPt}"

English:`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function translateDescription(
  descriptionPt: string
): Promise<string> {
  // Try Gemini first, fall back to dictionary
  const geminiResult = await translateWithGemini(descriptionPt);
  if (geminiResult) return geminiResult;
  return translateWithDictionary(descriptionPt);
}

const CINEMATIC_STYLE = `Shot on Arri Alexa with vintage anamorphic lens, shallow depth of field, heavy teal-green color grading, crushed blacks, desaturated skin tones, visible film grain, subtle lens vignette. Low-key lighting with dramatic contrast.

Style: Brazilian neo-realism cinema, City of God and Elite Squad cinematography. Vertical 9:16 portrait aspect ratio for Instagram Reels, photorealistic, raw gritty atmosphere, documentary handheld camera feel. Hyperrealistic, 8K detail on skin texture and pores.`;

export function buildCinematicPrompt(
  name: string,
  age: number,
  descriptionEn: string
): string {
  return `Cinematic still frame of a ${age}-year-old Brazilian man, ${descriptionEn}.

${CINEMATIC_STYLE}`;
}

export async function translateScene(scenePt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return translateWithDictionary(scenePt);
  }

  const prompt = `You are translating a scene description from Brazilian Portuguese to English for an AI image generation prompt.

Translate this into vivid, descriptive English. Include the setting, action, camera angle, and mood. Output ONLY the English translation, nothing else.

Portuguese: "${scenePt}"`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 512,
          },
        }),
      }
    );

    if (!res.ok) {
      console.error("Gemini translate error:", res.status, await res.text());
      return translateWithDictionary(scenePt);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) return text;
  } catch (err) {
    console.error("Gemini translate exception:", err);
  }

  return translateWithDictionary(scenePt);
}

export function composeFullPrompt(
  promptBaseEn: string,
  sceneEn: string
): string {
  // Extract only the character appearance (first paragraph/sentence before any scene description).
  // We look for the first "Cinematic still frame of..." sentence and stop at the first double newline
  // or at known scene markers like "The bedroom", "The room", "Shot on Arri"
  const sceneMarkers = [
    "The bedroom",
    "The room",
    "The house",
    "The street",
    "The bar",
    "The office",
    "Shot on Arri",
    "\n\n",
  ];

  let characterPart = promptBaseEn;
  for (const marker of sceneMarkers) {
    const idx = characterPart.indexOf(marker);
    if (idx > 0) {
      characterPart = characterPart.substring(0, idx).trim();
    }
  }

  // Remove trailing period if present, we'll add structure
  characterPart = characterPart.replace(/\.\s*$/, "");

  return `${characterPart}. ${sceneEn}

${CINEMATIC_STYLE}`;
}
