import type { BodyPartId, Language } from "./shared";

const en = {
  // Main window
  "title.setup": "Let's set up your stretch routine",
  "subtitle.setup": "Pick what you want to stretch and how often.",
  "title.main": "Stretch Reminder",
  "subtitle.main": "Closing this window keeps reminders running in the menu bar / tray.",
  language: "Language",
  details: "Details",
  "stat.next": "Next reminder in",
  "stat.now": "Now!",
  "stat.paused": "Paused",
  "legend.done": "Done {n}",
  "legend.missed": "Missed {n}",
  "legend.goal": "Goal {n}",
  "title.daily": "Today's stretch plan",
  "subtitle.daily": "A new day! Set how often to remind you and how many stretches you're aiming for.",
  startDay: "Start today",
  goal: "Today's goal",
  "goal.value": "{n} times",
  "goal.hint": "From now until 6 PM, this interval fits up to {n}.",
  "goal.hintLate": "It's past 6 PM. Set a light goal for the rest of today.",
  "goal.dec": "One fewer",
  "goal.inc": "One more",
  bodyParts: "Body parts",
  // People who sit for long hours most often report neck/shoulder and lower-back symptoms, and
  // long sitting is linked to stiffer hips, so one pick per area spreads the stretching evenly.
  "parts.guide": "Mixing neck/shoulders, upper and lower body works best.",
  selectAll: "Select all",
  clear: "Clear",
  remindEvery: "Remind me every",
  "interval.dec": "15 minutes less",
  "interval.inc": "15 minutes more",
  notification: "Notification",
  position: "Position",
  "pos.right-top": "Top right",
  "pos.right-bottom": "Bottom right",
  "pos.middle": "Middle",
  staysFor: "Stays on screen for",
  "duration.hint": "Sets how long the notification stays. Once you start stretching, it stays until you finish.",
  "duration.dec": "Shorter",
  "duration.inc": "Longer",
  quit: "Quit app",
  "quit.confirm": "Quit Stretch Reminder? You won't get reminders until you open it again.",
  "quit.cancel": "Cancel",
  "quit.yes": "Quit",
  community: "Community · Report a problem",
  version: "Version {v}",
  "update.title": "Version {v} is available",
  "update.body": "Update to get the latest fixes and features.",
  "update.now": "Update",
  "update.later": "Later",
  "update.skip": "Skip this version",
  "update.close": "Close",
  "update.downloading": "Downloading… {p}%",
  "update.installing": "Installing. The app will restart.",
  "update.failed": "The update didn't go through. You can download it from the community site instead.",
  "update.openSite": "Open the site",
  test: "Remind me now",
  start: "Start reminding me",
  save: "Save changes",
  saved: "Saved. The countdown has restarted.",

  // Toast
  "toast.open": "Open Stretch Reminder",
  "toast.closes": "{done}/{total} done · closes in {t}",
  "toast.engaged": "{done}/{total} done · finish them all!",
  "toast.holdFirst": "Read the tip & hold {s}s first!",
  "toast.holdMore": "Hold it… {s}s more",
  "toast.tick": "Tick the box!",
  "toast.secs": "{s}s",
  "toast.partDone": "Done!",
  "toast.keepGoing": "You started, so finish! Keep going.",
  "toast.notSoFast": "Not so fast! {n} left: {list}",
  "toast.wait": "Wait {s}s…",
  "toast.complete": "Complete",
  "toast.mark": "Mark {name} as stretched",
};

type Key = keyof typeof en;

const ko: Record<Key, string> = {
  "title.setup": "스트레칭 루틴을 정해볼까요?",
  "subtitle.setup": "어디를, 얼마나 자주 스트레칭할지 골라주세요.",
  "title.main": "스트레칭 알리미",
  "subtitle.main": "창을 닫아도 메뉴 막대(트레이)에서 계속 알려드려요.",
  language: "언어",
  details: "상세 정보",
  "stat.next": "다음 알림까지",
  "stat.now": "지금!",
  "stat.paused": "일시정지",
  "legend.done": "완료 {n}",
  "legend.missed": "놓침 {n}",
  "legend.goal": "목표 {n}",
  "title.daily": "오늘의 스트레칭 계획",
  "subtitle.daily": "새로운 하루예요! 오늘의 알림 간격과 목표 횟수를 정해주세요.",
  startDay: "오늘 시작하기",
  goal: "오늘 목표 횟수",
  "goal.value": "{n}회",
  "goal.hint": "지금부터 6시까지, 이 간격이면 최대 {n}회까지 가능해요.",
  "goal.hintLate": "6시가 지났어요. 남은 시간엔 가볍게 목표를 잡아봐요.",
  "goal.dec": "1회 줄이기",
  "goal.inc": "1회 늘리기",
  bodyParts: "스트레칭 부위",
  "parts.guide": "목·어깨, 상체, 하체에서 하나씩 고르면 더 효과적이에요.",
  selectAll: "전체 선택",
  clear: "선택 해제",
  remindEvery: "알림 간격",
  "interval.dec": "15분 줄이기",
  "interval.inc": "15분 늘리기",
  notification: "알림",
  position: "위치",
  "pos.right-top": "오른쪽 위",
  "pos.right-bottom": "오른쪽 아래",
  "pos.middle": "가운데",
  staysFor: "표시 시간",
  "duration.hint": "알림이 지속되는 시간을 정해요. 스트레칭을 시작하면 끝날 때까지 떠있어요.",
  "duration.dec": "짧게",
  "duration.inc": "길게",
  quit: "앱 종료",
  "quit.confirm": "스트레칭 알리미를 종료할까요? 다시 열기 전까지 알림이 오지 않아요.",
  "quit.cancel": "취소",
  "quit.yes": "종료",
  community: "커뮤니티 · 문의하기",
  version: "버전 {v}",
  "update.title": "새 버전({v})이 나왔어요",
  "update.body": "업데이트하면 최신 개선 사항을 바로 쓸 수 있어요.",
  "update.now": "업데이트",
  "update.later": "나중에",
  "update.skip": "이 버전 건너뛰기",
  "update.close": "닫기",
  "update.downloading": "내려받는 중… {p}%",
  "update.installing": "설치 중이에요. 앱이 다시 시작돼요.",
  "update.failed": "업데이트에 실패했어요. 커뮤니티 사이트에서 직접 받을 수 있어요.",
  "update.openSite": "사이트 열기",
  test: "지금 알림 받기",
  start: "알림 시작하기",
  save: "변경사항 저장",
  saved: "저장했어요. 카운트다운을 다시 시작해요.",

  "toast.open": "스트레칭 알리미 열기",
  "toast.closes": "{done}/{total} 완료 · {t} 후 닫힘",
  "toast.engaged": "{done}/{total} 완료 · 끝까지 해봐요!",
  "toast.holdFirst": "설명을 보며 {s}초 버텨주세요!",
  "toast.holdMore": "조금만 더… {s}초",
  "toast.tick": "체크하세요!",
  "toast.secs": "{s}초",
  "toast.partDone": "완료!",
  "toast.keepGoing": "시작했으면 끝까지! 조금만 더 힘내요.",
  "toast.notSoFast": "아직이에요! {n}개 남음: {list}",
  "toast.wait": "{s}초 기다려요…",
  "toast.complete": "완료",
  "toast.mark": "{name} 스트레칭 완료로 표시",
};

const DICT: Record<Language, Record<Key, string>> = { en, ko };

/** `tips` with more than one entry: one is picked at random each time the notification shows. */
const PARTS: Record<Language, Record<BodyPartId, { name: string; tips: string[] }>> = {
  en: {
    neck: { name: "Neck", tips: ["Tilt your ear toward your shoulder. Hold, then switch sides."] },
    shoulders: { name: "Shoulders", tips: ["Roll your shoulders back 10 times, then pull each arm across your chest."] },
    "upper-back": {
      name: "Upper back",
      tips: [
        "Bend your elbows to 90° and pull them back, squeezing your shoulder blades together. Hold 5s, release, repeat.",
        "Lace your hands behind your head, lean back over the chair back and open your chest to the ceiling.",
      ],
    },
    "lower-back": { name: "Lower back", tips: ["Seated twist: hold the back of the chair and rotate gently. Do both sides."] },
    chest: { name: "Chest", tips: ["Clasp your hands behind you, open your chest and lift your arms slightly."] },
    wrists: { name: "Wrists", tips: ["Arm out, palm up, gently pull your fingers back. Then palm down. Swap arms."] },
    arms: { name: "Upper arms", tips: ["Fold one arm behind your head and gently press that elbow down with your other hand. Switch sides."] },
    "lower-body": {
      name: "Lower body",
      tips: [
        "Seated: rest one ankle on the other knee (figure 4) and lean forward a little. Then straighten that leg and pull your toes toward you. Switch sides.",
      ],
    },
  },
  ko: {
    neck: { name: "목", tips: ["귀를 어깨 쪽으로 천천히 기울이고 버틴 뒤, 반대쪽도 해요."] },
    shoulders: { name: "어깨", tips: ["어깨를 뒤로 10번 돌린 다음, 한 팔씩 가슴 앞으로 당겨요."] },
    "upper-back": {
      name: "윗등",
      tips: [
        "팔꿈치를 90도로 굽혀 뒤로 당기며 날개뼈를 꽉 모아요. 5초 버티고 풀기를 반복해요.",
        "두 손을 머리 뒤에 깍지 끼고, 의자 등받이에 기대 가슴을 하늘로 열며 상체를 뒤로 젖혀요.",
      ],
    },
    "lower-back": { name: "허리", tips: ["의자 등받이를 잡고 상체를 천천히 비틀어요. 양쪽 다 해요."] },
    chest: { name: "가슴", tips: ["두 손을 등 뒤로 깍지 끼고, 가슴을 펴며 팔을 살짝 들어요."] },
    wrists: { name: "손목", tips: ["팔을 뻗어 손바닥을 위로 하고 손가락을 몸 쪽으로 당겨요. 손바닥을 아래로 바꿔 한 번 더, 반대쪽도요."] },
    arms: { name: "팔뚝", tips: ["한 팔을 머리 뒤로 접어 넘기고, 다른 손으로 팔꿈치를 지그시 눌러요. 반대쪽도요."] },
    "lower-body": {
      name: "하체",
      tips: [
        "앉아서 한쪽 발목을 반대쪽 무릎 위에 올리고(4자 다리) 상체를 살짝 숙여요. 이어서 그 다리를 쭉 뻗어 발끝을 몸 쪽으로 당겨요. 반대쪽도요.",
      ],
    },
  },
};

/** Shown after "Complete": praise + a silly body-change line + "see you in {t}". */
const CHEERS: Record<Language, { title: string; body: string }[]> = {
  en: [
    { title: "Great job!", body: "Your body just went full marshmallow. See you in {t}!" },
    { title: "Nailed it!", body: "Your spine said \"thank you.\" See you again in {t}." },
    { title: "Perfect!", body: "A rock just rolled off your shoulders. Back in {t}." },
    { title: "Awesome!", body: "You probably grew 0.1 cm just now. Let's grow again in {t}." },
    { title: "You did it!", body: "Stiff body → jelly mode activated. More jiggle in {t}." },
    { title: "Brilliant!", body: "Your neck moved one step from turtle to giraffe. See you in {t}." },
    { title: "Amazing!", body: "Hear that? Your joints are applauding. Encore in {t}." },
    { title: "Well done!", body: "Blood-flow highway: cleared. Traffic check again in {t}." },
    { title: "Clap clap!", body: "You escaped right before fusing with your chair. Escape again in {t}." },
    { title: "Good job!", body: "Your lower back says \"I can breathe again.\" See you in {t}." },
    { title: "Love it!", body: "You feel fresh out of the laundry. Another rinse in {t}." },
    { title: "Look at you!", body: "Your stiff muscles are melting like butter. More melting in {t}." },
    { title: "Done again!", body: "Body upgraded to the next version. Next patch drops in {t}." },
    { title: "Way to hold it!", body: "Your back is smooth as an ironed shirt. Ironing again in {t}." },
    { title: "Complete!", body: "Body battery +20%. Recharge again in {t}." },
    { title: "Nice stretch!", body: "Your wrists can now take revenge on the keyboard. See you in {t}." },
    { title: "Great habit!", body: "Future you says thanks. Invest again in {t}." },
    { title: "Bravo!", body: "You're stretchy as a brand-new rubber band. Stretch again in {t}." },
    { title: "Crushed it!", body: "Stiffness packed its bags and left. If it sneaks back, we'll kick it out in {t}." },
    { title: "Great job!", body: "With that posture you could walk a runway. See you on the catwalk in {t}." },
  ],
  ko: [
    { title: "잘했어요!", body: "몸이 말랑말랑해졌어요. {t} 뒤에 또 만나요!" },
    { title: "최고예요!", body: "척추가 \"고마워\"라고 했어요. {t} 뒤에 다시 봐요." },
    { title: "완벽해요!", body: "어깨에서 돌덩이 하나가 내려갔어요. {t} 뒤에 또 올게요." },
    { title: "멋져요!", body: "방금 키가 0.1cm 큰 것 같아요. {t} 뒤에 또 키워봐요." },
    { title: "해냈어요!", body: "굳어 있던 몸이 젤리가 됐어요. {t} 뒤에 다시 말랑해져요." },
    { title: "훌륭해요!", body: "목이 거북이에서 기린 쪽으로 한 걸음! {t} 뒤에 또 봐요." },
    { title: "대단해요!", body: "관절들이 박수 치는 소리 들려요? {t} 뒤에 앵콜 공연해요." },
    { title: "잘했어요!", body: "혈액순환 고속도로가 뻥 뚫렸어요. {t} 뒤에 또 정체 풀러 와요." },
    { title: "짝짝짝!", body: "의자랑 한 몸 되기 직전에 탈출 성공. {t} 뒤에 또 탈출해요." },
    { title: "굿잡!", body: "허리가 \"이제 살 것 같다\"고 전해달래요. {t} 뒤에 다시 만나요." },
    { title: "칭찬해요!", body: "몸이 갓 세탁한 빨래처럼 개운해졌어요. {t} 뒤에 또 헹궈요." },
    { title: "역시!", body: "굳은 근육이 버터처럼 녹고 있어요. {t} 뒤에 또 녹여요." },
    { title: "오늘도 해냈어요!", body: "몸이 한 단계 업그레이드됐어요. {t} 뒤에 다음 패치가 나와요." },
    { title: "잘 버텼어요!", body: "등이 다림질한 셔츠처럼 쫙 펴졌어요. {t} 뒤에 또 다려요." },
    { title: "완료!", body: "몸 배터리 20% 충전 완료. {t} 뒤에 또 충전해요." },
    { title: "멋진 스트레칭!", body: "손목이 키보드에게 복수할 힘을 얻었어요. {t} 뒤에 또 봐요." },
    { title: "좋은 습관이에요!", body: "미래의 내가 고맙대요. {t} 뒤에 또 투자해요." },
    { title: "브라보!", body: "몸이 새 고무줄처럼 쫀쫀해졌어요. {t} 뒤에 또 늘려봐요." },
    { title: "해치웠어요!", body: "뻐근함이 짐 싸서 나갔어요. 몰래 돌아오면 {t} 뒤에 또 쫓아내요." },
    { title: "잘했어요!", body: "지금 자세면 런웨이도 걸어요. {t} 뒤에 런웨이에서 만나요." },
  ],
};

/** One of these is picked at random every time the notification appears. */
const TITLES: Record<Language, string[]> = {
  en: [
    "Time to Stretch!!",
    "Stretch Break!!",
    "Wiggle Time!!",
    "Unstick Yourself!!",
    "Reach for the Sky!!",
    "Bend, Don't Break!!",
    "Chair Escape!!",
    "Loosen Up!!",
    "Body Says Hi!!",
    "Move It, Move It!!",
  ],
  ko: [
    "스트레칭 할 시간!!",
    "쭉쭉 펴요!!",
    "꿈틀꿈틀 타임!!",
    "통나무 탈출!!",
    "하늘 향해 쭉!!",
    "기지개 켤 시간!!",
    "굳은 몸 풀기!!",
    "잠깐 쉬어가요!!",
    "몸이 소리지르고 있어요!!",
    "움직여요, 움직여!!",
  ],
};

let current: Language = "en";

export function setLanguage(lang: Language) {
  current = lang;
  document.documentElement.lang = lang;
}

export function getLanguage(): Language {
  return current;
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  return DICT[current][key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function partName(id: string): string {
  return PARTS[current][id as BodyPartId]?.name ?? id;
}

/** A tip for this body part; random when the part has several. */
export function partTip(id: string): string {
  const tips = PARTS[current][id as BodyPartId]?.tips ?? [];
  return tips.length ? tips[Math.floor(Math.random() * tips.length)] : "";
}

/** Shown when today's goal is reached: praise + body line + "see you tomorrow". */
const FINAL_CHEERS: Record<Language, { title: string; body: string }[]> = {
  en: [
    { title: "Goal complete!", body: "Your body is thanking you for today. Let's stretch together again tomorrow!" },
    { title: "Today: cleared!", body: "Every joint got its turn today. Same time tomorrow?" },
    { title: "You did all of it!", body: "Your back is off duty now. Come back tomorrow for another round." },
    { title: "Perfect day!", body: "Today's stiffness: 0. Let's keep the streak going tomorrow!" },
    { title: "Mission accomplished!", body: "Your body leveled up today. Tomorrow we level up again." },
    { title: "Daily goal hit!", body: "Tiny stretches, big habit. See you tomorrow, same spot!" },
    { title: "That's a wrap!", body: "Your muscles clocked out happy. Let's do it again tomorrow." },
    { title: "All done for today!", body: "Future you is already grateful. Keep it up tomorrow too!" },
  ],
  ko: [
    { title: "오늘 목표 달성!", body: "몸이 오늘 하루 고마웠대요. 내일도 같이 쭉쭉 펴요!" },
    { title: "오늘 클리어!", body: "관절들이 오늘 한 번씩 다 숨 쉬었어요. 내일 이 시간에 또 만나요." },
    { title: "전부 해냈어요!", body: "등이 이제 좀 살 것 같대요. 내일도 시원하게 풀어줘봐요." },
    { title: "완벽한 하루!", body: "오늘의 뻐근함 0. 내일도 이 기록 이어가 봐요!" },
    { title: "미션 컴플리트!", body: "몸이 오늘 한 단계 레벨업했어요. 내일 또 레벨업해요." },
    { title: "하루 목표 달성!", body: "작은 스트레칭이 큰 습관이 돼요. 내일도 여기서 만나요!" },
    { title: "오늘은 여기까지!", body: "근육들이 기분 좋게 퇴근했어요. 내일도 기분 좋게 퇴근해요." },
    { title: "오늘 할 일 끝!", body: "미래의 내가 벌써 고마워해요. 내일도 꾸준히 해봐요!" },
  ],
};

export function randomFinalCheer(): { title: string; body: string } {
  const list = FINAL_CHEERS[current];
  return list[Math.floor(Math.random() * list.length)];
}

/** A random reward message for the completion modal. */
export function randomCheer(interval: string): { title: string; body: string } {
  const list = CHEERS[current];
  const { title, body } = list[Math.floor(Math.random() * list.length)];
  return { title, body: body.replace("{t}", interval) };
}

export function randomTitle(): string {
  const list = TITLES[current];
  return list[Math.floor(Math.random() * list.length)];
}

/** e.g. "Tue, Nov 24" / "11월 24일 (화)" */
export function formatDate(d: Date): string {
  return d.toLocaleDateString(current === "ko" ? "ko-KR" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatInterval(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (current === "ko") {
    if (h === 0) return `${m}분`;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
  }
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h}h ${m}m`;
}

/** Fill every element marked with data-i18n / data-i18n-aria / data-i18n-title. */
export function applyStatic(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n as Key);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria as Key));
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle as Key);
  });
}
