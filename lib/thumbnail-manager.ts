/**
 * 카테고리별 썸네일 관리
 * - thumbnails/ 디렉토리에 카테고리별 1회 생성 후 캐싱
 * - Gemini API로 기존 썸네일 스타일 참고하여 생성
 * - 없으면 placeholder URL 반환
 */

import fs from "fs";
import path from "path";
import https from "https";
import { loadConfig } from "./config";

const THUMBNAILS_DIR = path.resolve(__dirname, "..", "thumbnails");

/** 카테고리 메타데이터: 색상, 영문 파일명, 검색 키워드 */
interface CategoryMeta {
  color: string;
  filename: string;
  keywords: string[];
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  운영체제: { color: "파란색", filename: "operatingsystem", keywords: ["operatingsystem", "os"] },
  네트워크: { color: "초록색", filename: "network", keywords: ["network", "networkthumbnail"] },
  보안: { color: "남색", filename: "security", keywords: ["security"] },
  컨테이너: { color: "남색", filename: "container", keywords: ["container"] },
  데이터베이스: { color: "보라색", filename: "database", keywords: ["database", "db"] },
  클라우드: { color: "진한 청록색", filename: "cloud", keywords: ["cloud"] },
  DevOps: { color: "진한 초록색", filename: "devops", keywords: ["devops"] },
  SMTP: { color: "주황색", filename: "smtp", keywords: ["smtp", "mail"] },
  부하테스트: { color: "빨간색", filename: "loadtest", keywords: ["loadtest", "stress"] },
  임베딩: { color: "보라색", filename: "embedding", keywords: ["embedding", "ml"] },
};

/** 썸네일 생성 프롬프트 템플릿 */
const THUMBNAIL_PROMPT = `깔끔한 교육용 블로그 썸네일 디자인, 스프링 노트(공책) 스타일, 상단에 링 바인딩이 있는 구조, 전체적으로 미니멀하고 정돈된 레이아웃

상단에는 여백이 있고, 중앙에는 큰 메인 제목, 하단에는 개념을 설명하는 일러스트가 배치된 구조

중앙 텍스트: "{TITLE}"
텍스트는 굵고 가독성 높은 한글 폰트, 화면 중앙에 크게 배치, 깔끔하고 전문적인 느낌

하단에는 "{TITLE}" 주제를 시각적으로 설명하는 일러스트를 구성:
- 해당 주제를 대표하는 핵심 개념 요소들을 포함
- 직관적으로 이해 가능한 아이콘과 구조
- 너무 복잡하지 않고 교육용으로 단순화된 표현

색상은 {COLOR} 계열 중심, 밝고 깔끔한 느낌, 과한 네온이나 미래지향적 스타일은 배제

플랫 디자인 + 약간의 3D 깊이감, 교육용 커버 이미지 스타일, 고해상도`;

function ensureThumbnailDir(): void {
  if (!fs.existsSync(THUMBNAILS_DIR)) {
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
  }
}

/** 카테고리명 또는 주제명에서 메타데이터 찾기 */
function findCategoryMeta(category: string): CategoryMeta | null {
  // 정확한 매칭
  if (CATEGORY_META[category]) return CATEGORY_META[category];

  // 부분 매칭 (예: "컨테이너 보안" → "컨테이너")
  for (const [key, meta] of Object.entries(CATEGORY_META)) {
    if (category.includes(key) || key.includes(category)) return meta;
  }

  return null;
}

/** 캐시된 썸네일 경로 반환 (없으면 null) */
function getCachedThumbnail(category: string): string | null {
  ensureThumbnailDir();
  const files = fs.readdirSync(THUMBNAILS_DIR);
  const meta = findCategoryMeta(category);
  const keywords = meta ? meta.keywords : [category.toLowerCase()];

  const match = files.find((f) => {
    const lower = f.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  });

  return match ? path.join(THUMBNAILS_DIR, match) : null;
}

/** 참고 이미지 1개를 base64로 로드 */
function loadReferenceImage(): { base64: string; mimeType: string } | null {
  ensureThumbnailDir();
  const files = fs.readdirSync(THUMBNAILS_DIR).filter((f) => /\.(png|jpg|jpeg)$/i.test(f));

  if (files.length === 0) return null;

  const refPath = path.join(THUMBNAILS_DIR, files[0]);
  const buffer = fs.readFileSync(refPath);
  const ext = path.extname(files[0]).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

  return { base64: buffer.toString("base64"), mimeType };
}

/** 영문 파일명 생성 */
function generateFilename(category: string): string {
  const meta = findCategoryMeta(category);
  if (meta) return `${meta.filename}.png`;

  // 매핑에 없는 경우: 한글 → 영문 변환 불가하므로 타임스탬프 사용
  const safe = category.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "thumbnail";
  return `${safe}_${Date.now()}.png`;
}

/** placeholder 썸네일 URL 생성 */
function generatePlaceholderUrl(title: string): string {
  const text = encodeURIComponent(title.slice(0, 30));
  return `https://via.placeholder.com/800x400/2d3436/ffffff?text=${text}`;
}

/** GitHub raw URL 베이스 (레포 push 후 유효) */
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/jhj030811/dev-blog-automation/main/thumbnails";

export interface ThumbnailResult {
  /** 블로그 본문에 삽입할 URL (GitHub raw URL) */
  url: string;
  /** 로컬 파일 경로 */
  localPath: string | null;
  cached: boolean;
  source: "cache" | "placeholder" | "gemini";
  /** 새로 생성된 썸네일이면 true → git push 필요 */
  needsPush: boolean;
}

/** 로컬 파일명으로 GitHub raw URL 생성 */
function toGitHubRawUrl(localPath: string): string {
  const filename = path.basename(localPath);
  return `${GITHUB_RAW_BASE}/${filename}`;
}

/**
 * 주제에 맞는 썸네일을 반환
 * 1. 캐시 확인 → 2. Gemini 생성 + 저장 → 3. placeholder fallback
 */
/**
 * @param title - 블로그 제목
 * @param category - 카테고리명 (캐시 검색 키)
 * @param color - 사용자가 지정한 썸네일 색상 (예: "파란색", "초록색")
 */
export async function getThumbnail(
  title: string,
  category?: string,
  color?: string
): Promise<ThumbnailResult> {
  const searchKey = category || title;

  // 1. 캐시 확인 (이미 thumbnails/에 있는 이미지 → GitHub에도 push 되어 있다고 가정)
  const cachedPath = getCachedThumbnail(searchKey);
  if (cachedPath) {
    return {
      url: toGitHubRawUrl(cachedPath),
      localPath: cachedPath,
      cached: true,
      source: "cache",
      needsPush: false,
    };
  }

  // 2. Gemini API 생성 시도
  const config = loadConfig();
  if (config.geminiApiKey) {
    try {
      const savedPath = await generateWithGemini(searchKey, config.geminiApiKey, color);
      if (savedPath) {
        return {
          url: toGitHubRawUrl(savedPath),
          localPath: savedPath,
          cached: false,
          source: "gemini",
          needsPush: true, // 새로 생성 → git push 필요
        };
      }
    } catch (e) {
      console.warn("Gemini 썸네일 생성 실패, placeholder 사용:", (e as Error).message);
    }
  }

  // 3. Placeholder fallback
  return {
    url: generatePlaceholderUrl(title),
    localPath: null,
    cached: false,
    source: "placeholder",
    needsPush: false,
  };
}

/** Gemini API로 썸네일 생성하고 파일로 저장 */
async function generateWithGemini(
  category: string,
  apiKey: string,
  userColor?: string
): Promise<string | null> {
  const meta = findCategoryMeta(category);
  const color = userColor || meta?.color || "파란색";
  const displayTitle = category;

  // 프롬프트 생성
  const prompt = THUMBNAIL_PROMPT
    .replace(/\{TITLE\}/g, displayTitle)
    .replace(/\{COLOR\}/g, color);

  // 요청 body 구성
  const parts: any[] = [];

  // 참고 이미지 추가 (있으면)
  const ref = loadReferenceImage();
  if (ref) {
    parts.push({
      text: "아래 이미지와 동일한 스타일로 새로운 썸네일을 만들어줘. 스프링 노트 디자인, 레이아웃, 색감 톤을 참고해줘:",
    });
    parts.push({
      inline_data: { mime_type: ref.mimeType, data: ref.base64 },
    });
  }

  parts.push({ text: prompt });

  const requestBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  // Gemini API 호출
  const model = "gemini-2.0-flash-exp";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const responseData = await httpPost(url, requestBody);
  const parsed = JSON.parse(responseData);

  // 응답에서 이미지 추출
  const candidates = parsed.candidates;
  if (!candidates?.length) {
    console.warn("Gemini 응답에 candidates 없음:", JSON.stringify(parsed).slice(0, 200));
    return null;
  }

  const imagePart = candidates[0].content?.parts?.find(
    (p: any) => p.inline_data?.mime_type?.startsWith("image/")
  );

  if (!imagePart) {
    console.warn("Gemini 응답에 이미지 없음");
    return null;
  }

  // 이미지 저장
  ensureThumbnailDir();
  const filename = generateFilename(category);
  const savePath = path.join(THUMBNAILS_DIR, filename);
  const imageBuffer = Buffer.from(imagePart.inline_data.data, "base64");
  fs.writeFileSync(savePath, imageBuffer);

  console.log(`썸네일 저장 완료: ${savePath} (${(imageBuffer.length / 1024).toFixed(0)}KB)`);

  // CATEGORY_META에 없는 카테고리면 매핑 정보 로그 출력
  if (!CATEGORY_META[category]) {
    console.log(`새 카테고리 "${category}" → 파일명 "${filename}"`);
    console.log("CATEGORY_META에 추가하면 다음부터 자동 매칭됩니다.");
  }

  return savePath;
}

/** HTTPS POST 헬퍼 */
function httpPost(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString()));
    });

    req.on("error", reject);
    req.setTimeout(60000, () => {
      req.destroy(new Error("Gemini API 요청 타임아웃 (60초)"));
    });
    req.write(body);
    req.end();
  });
}

// CLI 테스트
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);

    if (args[0] === "generate" && args[1]) {
      // 직접 생성 테스트: npx ts-node lib/thumbnail-manager.ts generate "컨테이너 보안"
      console.log(`"${args[1]}" 썸네일 생성 중...\n`);
      const result = await getThumbnail(args[1], args[1]);
      console.log(`결과:`, result);
    } else {
      // 기본 테스트
      console.log("=== 썸네일 매니저 테스트 ===\n");
      const tests = [
        { title: "[운영체제] 1장 : 서론", category: "운영체제" },
        { title: "[네트워크] 1장 : 물리 계층의 기술", category: "네트워크" },
        { title: "컨테이너 보안", category: "컨테이너 보안" },
      ];

      for (const t of tests) {
        const result = await getThumbnail(t.title, t.category);
        console.log(`제목: "${t.title}"`);
        console.log(`  source: ${result.source} | cached: ${result.cached}`);
        console.log(`  url: ${result.url}\n`);
      }

      console.log("---");
      console.log("생성 테스트: npx ts-node lib/thumbnail-manager.ts generate \"컨테이너 보안\"");
    }
  })();
}
