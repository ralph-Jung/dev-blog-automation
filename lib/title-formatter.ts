/**
 * Notion 페이지 제목을 Velog 블로그 제목으로 변환
 *
 * 카테고리 하위 주제: "1. 서론" + category "운영체제" → "[운영체제] 1장 : 서론"
 * 독립 주제: "컨테이너 보안" → "컨테이너 보안" (그대로 사용)
 */

export interface TitleInput {
  /** Notion 페이지 제목 (예: "1. 서론") */
  pageTitle: string;
  /** 상위 카테고리명 (예: "운영체제"). 없으면 독립 주제 */
  category?: string;
}

export interface FormattedTitle {
  /** Velog에 발행할 제목 */
  title: string;
  /** URL slug용 (한글 포함 가능) */
  slug: string;
  /** Velog 태그 배열 */
  tags: string[];
}

/** "N. 주제명" 패턴 매칭 */
const NUMBERED_TITLE_RE = /^(\d+)\.\s*(.+)$/;

export function formatTitle(input: TitleInput): FormattedTitle {
  const { pageTitle, category } = input;
  const trimmed = pageTitle.trim();

  let title: string;
  let tags: string[] = [];

  if (category) {
    tags.push(category);
    const match = trimmed.match(NUMBERED_TITLE_RE);
    if (match) {
      const [, num, topicName] = match;
      title = `[${category}] ${num}장 : ${topicName.trim()}`;
      if (topicName.trim()) tags.push(topicName.trim());
    } else {
      // 번호 없는 카테고리 하위 주제
      title = `[${category}] ${trimmed}`;
      tags.push(trimmed);
    }
  } else {
    // 독립 주제
    title = trimmed;
    tags.push(trimmed);
  }

  const slug = title
    .toLowerCase()
    .replace(/\[|\]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return { title, slug, tags };
}

// CLI 테스트
if (require.main === module) {
  const tests: TitleInput[] = [
    { pageTitle: "1. 서론", category: "운영체제" },
    { pageTitle: "2. 운영체제 구조", category: "운영체제" },
    { pageTitle: "4. 스레드와 병행성", category: "운영체제" },
    { pageTitle: "1. 물리 계층의 기술", category: "네트워크" },
    { pageTitle: "컨테이너 보안" },
    { pageTitle: "부하테스트" },
    { pageTitle: "SMTP 프로토콜 + 메일 보내는 방법" },
  ];

  for (const t of tests) {
    const result = formatTitle(t);
    console.log(`입력: "${t.pageTitle}" (${t.category ?? "독립"}) → "${result.title}"`);
    console.log(`  slug: ${result.slug} | tags: [${result.tags.join(", ")}]\n`);
  }
}
