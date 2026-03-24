# dev-blog-automation

Notion MCP + Velog GraphQL API 기반 개발 블로그 자동 발행 시스템

## Overview

Notion에 정리한 학습 노트를 자연어 한 줄로 Velog 블로그에 자동 발행합니다.

```
"스레드와 병행성 블로그 작성해줘"
```

이 한 마디로 Notion 콘텐츠 조회 → 제목 생성 → 본문 보강 → 썸네일 삽입 → Velog 발행까지 자동 처리됩니다.

## Architecture

```
┌─────────────┐     Notion MCP      ┌──────────────────┐
│   Notion    │ ◄─────────────────► │                  │
│  (학습 노트)  │                     │   Claude Code    │
└─────────────┘                     │   + blog-publish │
                                    │     Skill        │
┌─────────────┐  Velog GraphQL API  │                  │
│   Velog     │ ◄─────────────────► │                  │
│  (블로그)     │   v2.velog.io       └──────────────────┘
└─────────────┘                              │
                                             │
┌─────────────┐    GitHub Raw URL            │
│   GitHub     │ ◄───────────────────────────┘
│ (썸네일 호스팅)│
└─────────────┘
```

## Tech Stack

| 구분 | 기술 |
|------|------|
| 언어 | TypeScript |
| Notion 연동 | Notion MCP (`@notionhq/notion-mcp-server`) |
| Velog 발행 | Velog GraphQL API (`v2.velog.io/graphql`) 직접 호출 |
| 썸네일 호스팅 | GitHub Raw URL |
| 썸네일 생성 | Gemini API (선택) |
| 오케스트레이션 | Claude Code Skill (`blog-publish`) |

## Project Structure

```
dev-blog-automation/
├── lib/
│   ├── config.ts              # 환경변수 로딩
│   ├── title-formatter.ts     # Notion 제목 → Velog 제목 변환
│   ├── content-parser.ts      # Notion 블록 → 마크다운 변환
│   ├── thumbnail-manager.ts   # 카테고리별 썸네일 캐싱 + GitHub Raw URL
│   └── velog-client.ts        # Velog GraphQL API 직접 호출
├── thumbnails/                # 카테고리별 썸네일 이미지
├── .claude/
│   └── skills/
│       └── blog-publish/
│           ├── SKILL.md       # 스킬 워크플로우 정의
│           ├── GOTCHAS.md     # 실패 지점 기록
│           ├── prompts/       # 본문 작성 프롬프트
│           └── templates/     # 블로그 템플릿
├── CLAUDE.md
├── package.json
└── tsconfig.json
```

## Workflow

```
1. Notion MCP로 "개발 블로그 작성 주제" 페이지에서 콘텐츠 조회
2. title-formatter로 제목 생성 (예: [운영체제] 4장 : 스레드와 병행성)
3. content-parser로 Notion 블록 → 마크다운 변환
4. 서브에이전트로 본문 보강 (도입부 + 정리 추가)
5. thumbnail-manager로 썸네일 GitHub Raw URL 확인
6. velog-client로 Velog GraphQL API 직접 호출하여 발행
```

## Setup

### 1. 환경변수

```bash
cp .env.example .env
```

```env
VELOG_ACCESS_TOKEN=your_velog_access_token
VELOG_USERNAME=your_velog_username
NOTION_TOKEN=your_notion_token
GEMINI_API_KEY=your_gemini_api_key  # 선택
```

### 2. MCP 설정

`.mcp.json`에 Notion MCP 설정:

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "NOTION_TOKEN": "your_notion_token"
      }
    }
  }
}
```

### 3. 의존성 설치

```bash
npm install
```

## Usage

Claude Code에서 자연어로 요청:

```
# 카테고리 하위 주제
"운영체제 4. 스레드와 병행성 블로그 작성해줘"

# 독립 주제
"컨테이너 보안 블로그 작성해줘"

# 키워드 검색
"데이터 링크 계층 블로그 작성해줘"
```

## Gotchas

주요 실패 지점은 [GOTCHAS.md](.claude/skills/blog-publish/GOTCHAS.md)에 기록되어 있습니다.

- velog-mcp 패키지는 한글 인코딩 버그로 제거, Velog GraphQL API 직접 호출 사용
- Velog GraphQL 엔드포인트는 `v2.velog.io/graphql` (v3 아님)
- Velog 인증은 `Cookie: access_token=...` 방식 (Bearer 아님)
- 썸네일은 GitHub Raw URL로 호스팅 (레포 public 필수)
