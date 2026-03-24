# Claude Code Skills

## Blog Publishing Skills

### blog-publish

**Description**: Notion 브레인스토밍 페이지에서 주제를 찾아 Velog 블로그를 자동 발행합니다.

**Usage**:

- `/blog-publish "서론"` (카테고리 하위 주제)
- `/blog-publish "컨테이너 보안"` (독립 주제)
- `/blog-publish "물리 계층"` (키워드 매칭)

**Workflow**:

1. Notion MCP로 루트 페이지(`2efddb9e-dfce-8002-ab5b-daaf62d471e7`) 하위 구조 검색
2. `lib/title-formatter.ts` 규칙으로 제목 생성
3. `lib/content-parser.ts`로 Notion 블록 → 마크다운 변환
4. 서브에이전트로 본문 보강 (도입부 + 정리 추가)
5. `lib/velog-client.ts`로 페이로드 구성
6. Velog MCP `write_post`로 발행

**Notion 페이지 구조**:

```
개발 블로그 작성 주제 (루트)
├── 컨테이너 보안 (독립 주제)
├── 사이드카 컨테이너 + 네이티브 사이드카 컨테이너 (독립 주제)
├── 부하테스트 (독립 주제)
├── 임베딩 모델 배포 최적화 (독립 주제)
├── SMTP 프로토콜 + 메일 보내는 방법 (독립 주제)
├── 운영체제 (카테고리)
│   ├── 1. 서론
│   ├── 2. 운영체제 구조
│   ├── 3.
│   └── 4. 스레드와 병행성
└── 네트워크 (카테고리)
    ├── 1. 물리 계층의 기술
    └── 2. 데이터 링크 계층의 기술
```

**Lib 모듈**:

| 모듈 | 역할 |
|------|------|
| `lib/config.ts` | 환경변수 로딩 및 검증 |
| `lib/title-formatter.ts` | Notion 제목 → Velog 제목 변환 |
| `lib/content-parser.ts` | Notion 블록 → 마크다운 변환 |
| `lib/thumbnail-manager.ts` | 카테고리별 썸네일 캐싱 |
| `lib/velog-client.ts` | 발행 페이로드 생성 |

**Dependencies**:

- Notion MCP (`@notionhq/notion-mcp-server`)
- Velog MCP (`velog-mcp`)
