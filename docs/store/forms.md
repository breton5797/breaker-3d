# 스토어 설문 답안 (BREAKER 3D v1.0.0)

코드 기준 사실: 회원가입·서버·분석 도구 없음. 저장은 기기 안(localStorage)만. 앱에만 Google Mobile Ads SDK(보상형 광고, UMP 동의, iOS ATT)와
스토어 결제(`remove_ads`)가 있다. 아래 "수집"은 전부 AdMob SDK가 하는 것 — Google 공식 안내
(Play: developers.google.com/admob/android/privacy/play-data-disclosure, iOS: developers.google.com/admob/ios/privacy/data-disclosure)를
제출 직전에 한 번 더 대조한다(SDK 버전에 따라 항목이 바뀔 수 있음).

## 1. Google Play — 데이터 보안(Data safety)

| 질문 | 답 |
| --- | --- |
| 필수 사용자 데이터 유형을 수집하거나 공유하나요? | 예 |
| 수집하는 모든 사용자 데이터가 전송 중 암호화되나요? | 예 |
| 사용자가 데이터 삭제를 요청할 수 있는 방법을 제공하나요? | 아니요 (개발자가 보관하는 데이터 없음 — 광고 ID는 기기 설정에서 재설정/삭제) |
| 계정 생성 | 앱에 계정 없음 |

| 데이터 유형 | 수집 | 공유 | 처리 방식 | 목적 |
| --- | --- | --- | --- | --- |
| 위치 > 대략적인 위치 (IP로 추정) | 예 | 예 | 임시 처리 아님, 필수 | 광고·마케팅, 사기 방지·보안 |
| 앱 활동 > 앱 상호작용 (광고 노출·클릭) | 예 | 예 | 필수 | 광고·마케팅, 분석, 사기 방지 |
| 앱 정보 및 성능 > 비정상 종료 로그, 진단 | 예 | 예 | 필수 | 분석, 사기 방지 |
| 기기 또는 기타 ID (광고 ID) | 예 | 예 | 필수 | 광고·마케팅, 분석, 사기 방지 |

- 구매 기록은 Google Play 결제가 처리하므로 앱이 수집하지 않음(신고 대상 아님).
- **광고 ID 선언**(앱 콘텐츠 > 광고 ID): "예, 광고 ID 사용" → 용도: 광고 또는 마케팅, 분석, 사기 방지.
- **광고**(앱 콘텐츠 > 광고): "예, 앱에 광고가 포함됨".
- **타겟층 및 콘텐츠**: 대상 연령 **13세 이상**으로 선택(13~15, 16~17, 18+). 만 13세 미만을 포함하면 가족 정책(인증 광고 SDK·
  아동 대상 광고 설정)이 적용되므로, 아동을 대상으로 한 문구·이미지가 없는 지금은 13+로 둔다. "아동의 관심을 끌 수 있나요?" → 아니요.
- **정부 앱 / 금융 / 건강 / 뉴스** 설문: 모두 해당 없음.

## 2. App Store — 앱 개인정보 보호(App Privacy)

"데이터를 수집합니까?" → **예**. 항목별(모두 **사용자와 연결되지 않음**):

| 데이터 유형 | 용도 | 추적에 사용 |
| --- | --- | --- |
| 식별자 > 기기 ID (IDFA, 추적 허용 시) | 타사 광고, 분석 | **예** |
| 위치 > 대략적인 위치 | 타사 광고, 분석 | 아니요 |
| 사용 데이터 > 제품 상호작용 | 타사 광고, 분석 | 아니요 |
| 사용 데이터 > 광고 데이터 | 타사 광고, 분석 | **예** |
| 진단 > 충돌 데이터 · 성능 데이터 · 기타 진단 데이터 | 분석 | 아니요 |

- 구매 내역: App Store가 처리 → 앱 수집 아님.
- "추적"이 있으므로 ATT 팝업이 반드시 떠야 함 — 이미 구현(`src/monetize/native.js`, 동의 → ATT → SDK 시작).

## 3. 등급

### Google Play — IARC 설문 (카테고리: 게임)
| 질문 | 답 | 근거 |
| --- | --- | --- |
| 폭력 | 아니요 — 사실적·인간 대상 폭력 없음. 공이 벽돌·추상적 몬스터(보스)를 맞혀 부숨, 피·사망 표현 없음 | 보수적으로 답하려면 "판타지/만화 폭력(경미)" → PEGI 7 / ESRB E 예상 |
| 공포 | 아니요 | |
| 성적 내용·노출·욕설·약물·담배·주류 | 아니요 | |
| 도박 / 모의 도박 | 아니요 | 별 상자는 고정 150골드(무작위 아님), 현금 구매 재화 없음 |
| 사용자 간 상호작용·채팅·UGC | 아니요 | |
| 위치 공유 | 아니요 | |
| 디지털 상품 구매 | 예 (`remove_ads`) | |
| 광고 | 예 | |
예상 결과: 전체 이용가/PEGI 3(또는 7)/ESRB Everyone. 국내는 IARC 등급이 게임물관리위원회 등급분류를 대체(자체등급분류사업자).

### App Store — 연령 등급 설문 (2025~ 신규 문항)
| 항목 | 답 |
| --- | --- |
| 만화/판타지 폭력 | 없음 (보수적: "드물게/경미" → 그래도 4+ 또는 9+) |
| 사실적 폭력·잔인함·공포·성적 내용·욕설·약물·도박·의료·시뮬레이션 도박 | 없음 |
| 무제한 웹 접근 | 아니요 (사진 출처 링크는 외부 Safari로 열림) |
| 사용자 생성 콘텐츠 · 메시지/채팅 · 소셜 피드 | 아니요 |
| 광고 | 예 |
| 자녀 보호 기능 / 연령 확인 | 아니요 |
| 콘테스트 | 아니요 |
예상 결과: 4+ (광고 문항 매핑은 제출 화면에서 계산되는 값을 따름).

## 4. App Store 심사 메모 (App Review Information)

- 로그인: 필요 없음 (계정 없음).
- Notes (영어로 입력):
  > No account is needed. Rewarded ads (Google AdMob) are optional: after a game over the player may watch an ad to revive, and after a clear to double gold. The App Tracking Transparency prompt appears on first launch after Google's consent form (only shown in regions that require it); declining does not limit any feature. The in-app purchase "Remove Ads" (non-consumable, product id remove_ads) is on the title screen together with "Restore Purchases"; it gives the same rewards without watching ads.
- 연락처: 이름·전화·breton5797@gmail.com (전화번호는 공개되지 않음).

## 5. Google Play 앱 콘텐츠 기타
- 개인정보처리방침 URL: https://breton5797.github.io/breaker-3d/privacy.html
- 앱 액세스: "모든 기능을 특별한 액세스 권한 없이 사용 가능".
- 스토어 설정 > 연락처: 이메일 breton5797@gmail.com, 웹사이트 https://breton5797.github.io/breaker-3d/
