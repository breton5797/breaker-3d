# BREAKER 3D

공 하나가 3,000개가 되는 3D 벽돌깨기. 기울어진 3D 테이블 위에서 분열 게이트(×2/×3/×5),
연쇄 폭탄, 레이저, 화염공으로 수천 개의 벽돌을 갈아버리는 웹 게임입니다. 기획은 [PLAN.md](PLAN.md).

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 시뮬레이션 단위 테스트 (vitest)
npm run build    # dist/ 정적 빌드
node scripts/autoplay.mjs   # 봇으로 전 스테이지 밸런스 측정
```

## 조작

| 입력 | 동작 |
|---|---|
| 마우스 / 터치 드래그, ← → / A D | 패들 이동 |
| 클릭 / 탭 / Space | 발사 |
| 1 / Q | 스킬: 전체 공 ×3 분열 |
| 2 / W | 스킬: 메테오 (관통 화염공 부채꼴) |
| P / Esc | 일시정지 |

## 구조

- `src/sim/` — 렌더와 무관한 순수 게임 로직 (테스트 대상)
- `src/render/` — Three.js 렌더링 (InstancedMesh, 블룸, 파편/충격파/레이저)
- `src/director.js` — 시뮬레이션 이벤트 → 연출·사운드·슬로모션
- `src/audio.js` — WebAudio 합성 사운드 (에셋 없음)
- `src/ui.js`, `src/storage.js` — HUD/메뉴, 진행도 저장(localStorage)
