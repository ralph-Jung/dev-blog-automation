---
name: blog-publish
description: Notion "개발 블로그 작성 주제" 페이지에서 주제를 찾아 Velog 블로그를 자동 발행합니다.
argument-hint: topic - 발행할 주제 키워드
---

# blog-publish Skill

Notion "개발 블로그 작성 주제" 페이지에서 주제를 검색하여 Velog 블로그를 발행하는 자동화 스킬입니다.

## 실행 워크플로우

### Step 1: Notion에서 주제 검색

1. Notion MCP로 루트 페이지 `2efddb9e-dfce-8002-ab5b-daaf62d471e7`의 하위 블록을 조회
2. 입력된 `topic` 키워드와 매칭되는 페이지를 찾음
3. 매칭 방식:
   - 카테고리 하위 주제: 카테고리 페이지의 child_page 중 매칭 (예: "운영체제" > "1. 서론")
   - 독립 주제: 루트의 직접 child_page 중 매칭 (예: "컨테이너 보안")

### Step 2: 콘텐츠 수집

1. 매칭된 주제 페이지의 `block_id`로 `get-block-children` 호출
2. 하위 블록에 `has_children: true`인 블록이 있으면 재귀적으로 조회
3. 모든 블록 데이터를 수집

### Step 3: 제목 생성

프로젝트의 `lib/title-formatter.ts`의 규칙을 적용:
- 카테고리 하위: `"N. 주제명"` + category → `"[카테고리] N장 : 주제명"`
- 독립 주제: 제목 그대로 사용

### Step 4: 본문 생성 + 썸네일 준비 (병렬 처리)

아래 두 작업을 **Agent 도구로 병렬 실행**한다:

**에이전트 A - 본문 보강:**
1. `lib/content-parser.ts`의 `blocksToMarkdown()` 로직으로 Notion 블록 → 마크다운 변환
2. `prompts/content-writer.md` 프롬프트 참조하여 본문 보강:
   - Notion 원본 70% 유지
   - AI가 도입부, 요약, 연결 문장 30% 추가

**에이전트 B - 썸네일 (캐시 miss일 때만):**
1. `thumbnails/` 폴더에 해당 카테고리 이미지가 있으면 스킵 (캐시 hit)
2. 없으면 **사용자에게 원하는 썸네일 색상을 질문**한 뒤 Gemini로 생성
   - 기존 썸네일을 참고 이미지로 첨부
   - 생성된 이미지를 영문 파일명으로 `thumbnails/`에 저장
3. **새 썸네일이 생성된 경우**: `git add thumbnails/` → `git commit` → `git push`하여 GitHub에 반영
   - push 완료 후에야 raw URL이 유효해짐

### Step 5: 썸네일 URL 생성

썸네일 이미지는 GitHub raw URL로 블로그 본문에 삽입한다:
```
https://raw.githubusercontent.com/{username}/dev-blog-automation/main/thumbnails/{filename}.png
```
- 본문 최상단에 `![thumbnail](raw_url)` 삽입 → Velog가 자동으로 썸네일로 인식

### Step 6: 발행

1. `lib/velog-client.ts`의 `buildPublishPayload()` 로직으로 페이로드 구성
2. `lib/velog-client.ts`의 `publishToVelog()`로 Velog GraphQL API 직접 호출하여 발행
3. 발행 결과 URL을 사용자에게 반환

**주의**: Velog MCP의 `write_post`는 한글 인코딩 버그가 있으므로 사용하지 않는다. 반드시 `lib/velog-client.ts`의 직접 GraphQL 호출을 사용할 것.

## 주의사항

- 발행 전 반드시 사용자에게 제목, 태그, 본문 미리보기를 보여주고 확인 받을 것
- `is_private: false` (공개)가 기본이지만 사용자가 비공개 요청 시 변경
- 시리즈가 있으면 `series_id`를 포함하여 시리즈에 추가
- **반드시 `GOTCHAS.md`를 참조하여 알려진 실패 지점을 사전에 회피할 것**
