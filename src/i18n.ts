import type { BodyPartId, Language } from "./shared";

const en = {
  // Main window
  "title.setup": "Let's set up your stretch routine",
  "subtitle.setup": "Pick what you want to stretch and how often.",
  "title.main": "Stretch Reminder",
  "subtitle.main": "Closing this window keeps reminders running in the menu bar / tray.",
  language: "Language",
  details: "Details",
  "stat.next": "until next",
  "stat.done": "completed",
  "stat.missed": "missed",
  "stat.note": "Counts since the app was started. A missed reminder comes back after 5 minutes.",
  "stat.now": "Now",
  yourStretches: "Your stretches",
  adjustments: "Adjustments",
  bodyParts: "Body parts",
  chooseOne: "Choose at least one.",
  selectAll: "Select all",
  clear: "Clear",
  remindEvery: "Remind me every",
  "interval.hint": "15-minute steps, from 15 minutes to 4 hours.",
  "interval.dec": "15 minutes less",
  "interval.inc": "15 minutes more",
  position: "Notification position",
  "pos.right-top": "Top right",
  "pos.right-bottom": "Bottom right",
  "pos.middle": "Middle",
  staysFor: "Notification stays for",
  "duration.hint": "20 seconds to 7 minutes. It stays open while you're stretching.",
  "duration.dec": "Shorter",
  "duration.inc": "Longer",
  quit: "Quit app",
  "quit.confirm": "Quit Stretch Reminder? You won't get reminders until you open it again.",
  "quit.cancel": "Cancel",
  "quit.yes": "Quit",
  test: "Remind me now",
  start: "Start reminding me",
  save: "Save changes",
  saved: "Saved. The countdown has restarted.",
  "status.next": "Next in {t}",
  "status.now": "Time to stretch",

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
  "toast.nice": "Nice! See you in {t} ♥",
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
  "stat.done": "완료",
  "stat.missed": "놓침",
  "stat.note": "앱을 실행한 뒤부터 센 횟수예요. 놓친 알림은 5분 뒤에 다시 와요.",
  "stat.now": "지금",
  yourStretches: "내 스트레칭",
  adjustments: "설정",
  bodyParts: "스트레칭 부위",
  chooseOne: "하나 이상 골라주세요.",
  selectAll: "전체 선택",
  clear: "선택 해제",
  remindEvery: "알림 간격",
  "interval.hint": "15분 단위로, 15분부터 4시간까지 정할 수 있어요.",
  "interval.dec": "15분 줄이기",
  "interval.inc": "15분 늘리기",
  position: "알림 위치",
  "pos.right-top": "오른쪽 위",
  "pos.right-bottom": "오른쪽 아래",
  "pos.middle": "가운데",
  staysFor: "알림 표시 시간",
  "duration.hint": "20초부터 7분까지. 스트레칭을 시작하면 끝날 때까지 떠 있어요.",
  "duration.dec": "짧게",
  "duration.inc": "길게",
  quit: "앱 종료",
  "quit.confirm": "스트레칭 알리미를 종료할까요? 다시 열기 전까지 알림이 오지 않아요.",
  "quit.cancel": "취소",
  "quit.yes": "종료",
  test: "지금 알림 받기",
  start: "알림 시작하기",
  save: "변경사항 저장",
  saved: "저장했어요. 카운트다운을 다시 시작해요.",
  "status.next": "{t} 후 알림",
  "status.now": "스트레칭 시간!",

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
  "toast.nice": "잘했어요! {t} 후에 또 만나요 ♥",
  "toast.wait": "{s}초 기다려요…",
  "toast.complete": "완료",
  "toast.mark": "{name} 스트레칭 완료로 표시",
};

const DICT: Record<Language, Record<Key, string>> = { en, ko };

const PARTS: Record<Language, Record<BodyPartId, { name: string; tip: string }>> = {
  en: {
    neck: { name: "Neck", tip: "Tilt your ear toward your shoulder. Hold, then switch sides." },
    shoulders: { name: "Shoulders", tip: "Roll your shoulders back 10 times, then pull each arm across your chest." },
    "upper-back": { name: "Upper back", tip: "Clasp your hands in front of you, round your back and push them away." },
    "lower-back": { name: "Lower back", tip: "Seated twist: hold the back of the chair and rotate gently. Do both sides." },
    chest: { name: "Chest", tip: "Clasp your hands behind you, open your chest and lift your arms slightly." },
    wrists: { name: "Wrists & forearms", tip: "Arm out, palm up. Gently pull your fingers back, then swap arms." },
    hips: { name: "Hips", tip: "Stand and step into a lunge, then press your hips forward. Switch legs." },
    hamstrings: { name: "Hamstrings", tip: "Put a heel on a low surface and hinge forward with a flat back." },
    calves: { name: "Calves", tip: "Hands on a wall, one leg back. Press that heel into the floor." },
  },
  ko: {
    neck: { name: "목", tip: "귀를 어깨 쪽으로 천천히 기울이고 버틴 뒤, 반대쪽도 해요." },
    shoulders: { name: "어깨", tip: "어깨를 뒤로 10번 돌린 다음, 한 팔씩 가슴 앞으로 당겨요." },
    "upper-back": { name: "윗등", tip: "두 손을 앞으로 깍지 끼고, 등을 둥글게 말며 앞으로 밀어요." },
    "lower-back": { name: "허리", tip: "의자 등받이를 잡고 상체를 천천히 비틀어요. 양쪽 다 해요." },
    chest: { name: "가슴", tip: "두 손을 등 뒤로 깍지 끼고, 가슴을 펴며 팔을 살짝 들어요." },
    wrists: { name: "손목·팔뚝", tip: "팔을 뻗어 손바닥을 위로 하고, 손가락을 살짝 몸 쪽으로 당겨요. 반대쪽도요." },
    hips: { name: "고관절", tip: "일어나서 한 발 앞으로 런지 자세를 하고 골반을 앞으로 밀어요. 다리를 바꿔요." },
    hamstrings: { name: "허벅지 뒤", tip: "뒤꿈치를 낮은 곳에 올리고, 등을 편 채 앞으로 숙여요." },
    calves: { name: "종아리", tip: "벽을 짚고 한 다리를 뒤로 뺀 뒤, 뒤꿈치로 바닥을 눌러요." },
  },
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
    "의자에서 탈출!!",
    "하늘 향해 쭉!!",
    "기지개 켤 시간!!",
    "굳은 몸 풀기!!",
    "잠깐 일어나요!!",
    "몸이 부르고 있어요!!",
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

export function partTip(id: string): string {
  return PARTS[current][id as BodyPartId]?.tip ?? "";
}

export function randomTitle(): string {
  const list = TITLES[current];
  return list[Math.floor(Math.random() * list.length)];
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
