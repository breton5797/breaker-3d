# 미션 보상 2배 (보상형 광고) — 2026-11-19

대표님 선택: "미션 보상 2배 광고 (권장)" → 계획 승인 "계획대로 진행". 지침: `AD_MONETIZATION.md`(0장 우선), `GAME_PSYCHOLOGY.md`.

## 광고 지면 표 (BRIEF 8장 / AD_MONETIZATION 0.5)

| 위치 | 포맷 | 조건 | 보상 |
| --- | --- | --- | --- |
| 게임 오버 '이어하기' | 보상형 | 선택형, 판당 1회 | 부활 ♥+1 |
| 클리어 '골드 2배' | 보상형 | 선택형, 클리어당 1회 | 그 판 골드 2배 |
| **이벤트 화면 '광고 보고 2배' (신규)** | 보상형 | 선택형, 받을 수 있는 미션·보너스·주간 단계마다 1회 (받기와 같은 1회) | 그 보상 골드 2배 |

- 전면형·배너 없음 (변경 없음). 웹은 광고 없음 → 2배 버튼 미노출, 일반 받기만.
- 광고 제거 구매자: 기존 보상과 같이 광고 없이 2배 ("🎁 2배").
- 지급 기준: AdMob 정식 보상 결과(`showRewardVideoAd` 보상 amount>0)일 때만. 실패·중간 닫기 → "광고를 불러오지 못했어요" 안내, 일반 받기 그대로 가능.
- 중복 방지: 받기 플래그(events.js) + 광고 표시 중 다른 받기 탭 무시(eventsClaim.js) + 기존 one-at-a-time.

## 상한·원격 설정

- 일일 상한: 미션 자체가 하루 4개(미션 3 + 완료 보너스) + 주 3단계라 자연 상한. 별도 상한 없음 (대표님 승인).
- 원격 설정·광고 분석 이벤트: 프로젝트 전체에 아직 없음 → 범위 밖. 후속 과제로 `rewarded_enabled`·`rewarded_daily_limit`(기본 20) 원격 설정과 광고 요청/표시/보상 이벤트 계측을 함께 도입한다.

## A/B 가설 (기록만, 실험 미실행)

- 가설: 미션 2배를 제공하면 보상형 광고 시청 수가 늘고 D1 유지율은 떨어지지 않는다.
- 대조군: 2배 버튼 없음 / 실험군: 2배 버튼. 주지표: 사용자당 광고 수익(ARPDAU). 보호지표: D1·D7 유지율, 광고 제거 구매 전환.
- 중단 조건: D1 유지율 유의미 하락. 원격 설정·계측 도입 전에는 실험 불가 — 데이터가 없으므로 성과는 추정치로만 말한다.

## GAME_PSYCHOLOGY

- P1 고정 골드만(무작위 없음, 결제 없음) · P3 결과 조작 없음 · P4 압박 팝업·타이머 없음, 선택형 버튼 · P5 개인정보 없음 · P7 새 에셋 없음.

## 코드

`src/events.js`(claim*에 mult), `src/monetize/rewards.js`(missionDouble), `src/eventsView.js`(claimActions·2배 버튼), `src/eventsClaim.js`(광고→2배 지급), `src/main.js`(연결·watchAd), `src/ui.js`, `src/style.css`, 14개 언어 `events.double`, `docs/store/listing.md`(광고 고지).
테스트: `tests/eventsClaim.test.js`(지급·실패·중복 탭·광고 제거·웹), `tests/events.test.js`, `tests/eventsView.test.js`, `tests/monetize.test.js`.
