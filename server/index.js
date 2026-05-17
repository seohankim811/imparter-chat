import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Claude AI 클라이언트 (API 키가 환경변수에 있으면 작동)
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// 방별 Claude 대화 기록 (컨텍스트 유지)
const claudeHistories = new Map();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());

// 갓물주 잃도수 API를 Python mp_server.py(9090)로 프록시
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:9090',
  changeOrigin: true,
  logLevel: 'silent',
  pathRewrite: (path) => '/api' + path,
  onError: (err, req, res) => {
    if (!res.headersSent) {
      res.status(503).json({ error: '갓물주 서버가 꺼져 있어요' });
    }
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(join(__dirname, '../client/dist')));

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 50 * 1024 * 1024
});

const DATA_FILE = join(__dirname, 'rooms-data.json');
const PROFILES_FILE = join(__dirname, 'profiles.json');
const rooms = new Map();
const users = new Map();
const profiles = new Map(); // nickname -> { xp, level, badges, messageCount }

// 관리자 닉네임 — 모든 배지/레벨 자동 부여 + 모든 방의 방장 권한 (시크릿 키 필요)
const ADMIN_NICKNAMES = new Set(['서한']);

// VIP 닉네임 — 모든 배지/레벨 자동 부여만 (방장 권한 X, 시크릿 키 불필요)
// 닉네임이 정확히 일치할 때만 적용 — 추가 인증은 없으니 가족/지인 정도만
const VIP_NICKNAMES = new Set(['Daddy', 'cindy', '지한']);

// ===== 🛡️ 해킹 방지 시스템 =====
// 관리자 비밀 키 (환경변수 ADMIN_SECRET)
// Render 대시보드 → Environment 탭 → ADMIN_SECRET 등록
const ADMIN_SECRET = process.env.ADMIN_SECRET || null;
if (!ADMIN_SECRET) {
  console.warn('⚠️ ADMIN_SECRET 환경변수가 설정되지 않았어요. 관리자 닉네임 사용 불가.');
}

// 현재 인증된 관리자 소켓 (서버 메모리 - 클라이언트가 위조 불가)
const verifiedAdmins = new Set();

// 관리자 키 시도 추적 (IP 단위 무차별 대입 차단)
const adminAttempts = new Map(); // ip -> { failCount, lockedUntil }
const ADMIN_MAX_FAILS = 5;
const ADMIN_LOCK_MS = 30 * 60 * 1000; // 30분

// 메시지 도배 차단
const messageRateLimit = new Map(); // socket.id -> [timestamps]
const MSG_MAX_PER_WINDOW = 5; // 1초에 최대 5개
const MSG_WINDOW_MS = 1000;

function getClientIp(socket) {
  const fwd = socket.handshake.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return socket.handshake.address || 'unknown';
}

// 닉네임 정규화 — '서 한', '서한1', '서한 ' 같은 변형 잡기
function normalizeNickname(nick) {
  if (!nick) return '';
  return String(nick)
    .replace(/\s+/g, '')
    .replace(/[._\-~`!@#$%^&*()+=|\\/<>?,"';:\[\]{}]/g, '')
    .replace(/\d+/g, '')
    .toLowerCase();
}
const ADMIN_NORMALIZED = new Set([...ADMIN_NICKNAMES].map(normalizeNickname));
function isReservedNickname(nick) {
  if (!nick) return false;
  if (ADMIN_NICKNAMES.has(nick)) return true;
  const n = normalizeNickname(nick);
  return n.length > 0 && ADMIN_NORMALIZED.has(n);
}

function checkMessageRate(socketId) {
  const now = Date.now();
  let stamps = messageRateLimit.get(socketId) || [];
  stamps = stamps.filter(t => now - t < MSG_WINDOW_MS);
  if (stamps.length >= MSG_MAX_PER_WINDOW) {
    messageRateLimit.set(socketId, stamps);
    return false;
  }
  stamps.push(now);
  messageRateLimit.set(socketId, stamps);
  return true;
}

// XSS 기본 차단 — script/iframe/이벤트핸들러/javascript: 제거
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed)\b[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
}

function isVerifiedAdminSocket(socketId) {
  return verifiedAdmins.has(socketId);
}

function isAdmin(nickname) {
  // 닉네임 자체가 관리자 + 그 닉네임을 가진 검증된 소켓이 존재해야만 true
  // (set-user에서 검증 없이는 admin 닉네임을 등록 못 하므로 사실상 안전)
  if (!nickname || !ADMIN_NICKNAMES.has(nickname)) return false;
  for (const id of verifiedAdmins) {
    const u = users.get(id);
    if (u && u.nickname === nickname) return true;
  }
  return false;
}
function canManageRoom(nickname, room) {
  if (!room || !nickname) return false;
  return room.ownerNickname === nickname || isAdmin(nickname);
}

// ===== 레벨/배지 시스템 =====
const BADGES = {
  first_message: { emoji: '🌱', name: '첫 발자국', desc: '첫 메시지 전송' },
  chatty: { emoji: '💬', name: '수다쟁이', desc: '메시지 100개 전송' },
  veteran: { emoji: '⭐', name: '베테랑', desc: '메시지 500개 전송' },
  legend: { emoji: '👑', name: '전설', desc: '메시지 1000개 전송' },
  photographer: { emoji: '📸', name: '사진작가', desc: '사진 10장 전송' },
  gamer: { emoji: '🎮', name: '게이머', desc: '미니게임 10번 플레이' },
  winner: { emoji: '🏆', name: '승리자', desc: '미니게임 5번 승리' },
  night_owl: { emoji: '🦉', name: '올빼미', desc: '새벽 2~5시에 메시지' },
  early_bird: { emoji: '🐦', name: '일찍 일어나는 새', desc: '아침 5~7시에 메시지' },
};

function xpForLevel(level) {
  return Math.floor(50 * Math.pow(level, 1.5));
}

function getProfile(nickname) {
  if (!profiles.has(nickname)) {
    profiles.set(nickname, {
      nickname,
      xp: 0,
      level: 1,
      badges: [],
      messageCount: 0,
      imageCount: 0,
      gamesPlayed: 0,
      gamesWon: 0
    });
  }
  const profile = profiles.get(nickname);
  // 관리자(서한) 또는 VIP(Daddy/cindy)는 모든 배지 + Lv.99 자동
  if (ADMIN_NICKNAMES.has(nickname) || VIP_NICKNAMES.has(nickname)) {
    const allBadges = Object.keys(BADGES);
    let changed = false;
    for (const b of allBadges) {
      if (!profile.badges.includes(b)) { profile.badges.push(b); changed = true; }
    }
    if (profile.level < 99) { profile.level = 99; changed = true; }
    if (changed) saveProfiles();
  }
  return profile;
}

function addXP(nickname, amount) {
  const profile = getProfile(nickname);
  profile.xp += amount;
  let leveledUp = false;
  while (profile.xp >= xpForLevel(profile.level)) {
    profile.xp -= xpForLevel(profile.level);
    profile.level += 1;
    leveledUp = true;
  }
  return leveledUp;
}

function awardBadge(profile, badgeKey) {
  if (!profile.badges.includes(badgeKey)) {
    profile.badges.push(badgeKey);
    return true;
  }
  return false;
}

function checkBadges(profile, context = {}) {
  const newBadges = [];
  if (profile.messageCount >= 1 && awardBadge(profile, 'first_message')) newBadges.push('first_message');
  if (profile.messageCount >= 100 && awardBadge(profile, 'chatty')) newBadges.push('chatty');
  if (profile.messageCount >= 500 && awardBadge(profile, 'veteran')) newBadges.push('veteran');
  if (profile.messageCount >= 1000 && awardBadge(profile, 'legend')) newBadges.push('legend');
  if (profile.imageCount >= 10 && awardBadge(profile, 'photographer')) newBadges.push('photographer');
  if (profile.gamesPlayed >= 10 && awardBadge(profile, 'gamer')) newBadges.push('gamer');
  if (profile.gamesWon >= 5 && awardBadge(profile, 'winner')) newBadges.push('winner');

  const hour = new Date().getHours();
  if (hour >= 2 && hour < 5 && awardBadge(profile, 'night_owl')) newBadges.push('night_owl');
  if (hour >= 5 && hour < 7 && awardBadge(profile, 'early_bird')) newBadges.push('early_bird');

  return newBadges;
}

function loadProfiles() {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
      for (const [nick, profile] of Object.entries(data)) {
        profiles.set(nick, profile);
      }
      console.log(`${profiles.size}개의 프로필을 불러왔습니다`);
    }
  } catch (e) {
    console.error('프로필 불러오기 실패:', e);
  }
}

let profilesSaveTimeout = null;
function saveProfiles() {
  clearTimeout(profilesSaveTimeout);
  profilesSaveTimeout = setTimeout(async () => {
    try {
      const data = {};
      for (const [nick, profile] of profiles) data[nick] = profile;
      await fs.promises.writeFile(PROFILES_FILE + '.tmp', JSON.stringify(data));
      await fs.promises.rename(PROFILES_FILE + '.tmp', PROFILES_FILE);
    } catch (e) {
      console.error('프로필 저장 실패:', e);
    }
  }, 1000);
}

// ===== 봇 명령어 =====
const MAGIC_8BALL = [
  '확실해 ✨', '그렇게 될 거야 🌟', '전망이 좋아 💫', '믿어도 돼 ⭐',
  '그럴 가능성이 높아 ✨', '아마도 🤔', '지금은 말 못해 🔮',
  '다시 물어봐 💭', '집중해서 다시 🌙', '그렇게 보이진 않아 ❌',
  '내 대답은 노 🚫', '별로야 💔', '가능성이 낮아 📉', '의심스러워 👀'
];

const FORTUNES = [
  '오늘은 좋은 일이 생길 거예요 ✨',
  '새로운 친구를 만날 기회가 있어요 🌟',
  '작은 행운이 당신을 기다려요 🍀',
  '용기를 내면 원하는 걸 얻을 수 있어요 💪',
  '오늘은 쉬는 것도 좋아요 🛋️',
  '뜻밖의 선물이 있을지도 몰라요 🎁',
  '당신의 미소가 누군가를 행복하게 해요 😊',
  '작은 실수도 괜찮아요. 배움이 있을 거예요 📚',
  '오늘 먹는 음식이 특별히 맛있을 거예요 🍜',
  '밤 하늘을 보면 좋은 일이 생겨요 🌌'
];

const COMPLIMENTS = [
  '너는 정말 최고야! ✨',
  '오늘도 빛나고 있어 🌟',
  '너의 웃음이 세상을 밝게 해 😊',
  '너는 정말 멋진 사람이야 💫',
  '오늘 정말 수고했어 🤗',
  '너는 누구보다 소중해 💖',
  '너의 존재 자체가 선물이야 🎁',
  '넌 생각보다 훨씬 강해 💪'
];

function handleBotCommand(text, user) {
  const cmd = text.trim().toLowerCase();

  if (cmd === '/help' || cmd === '/도움말') {
    return {
      text: `🤖 Imparter 봇 명령어\n\n` +
            `/주사위 - 1~6 주사위 굴리기\n` +
            `/동전 - 앞면/뒷면 던지기\n` +
            `/8ball [질문] - 매직 8볼에게 질문\n` +
            `/운세 - 오늘의 운세\n` +
            `/칭찬 - 칭찬 받기\n` +
            `/날씨 - 오늘의 날씨 (랜덤)\n` +
            `/시간 - 현재 시간\n` +
            `/랜덤 [최대] - 0~최대 랜덤 숫자\n` +
            `/선택 A,B,C - 옵션 중 랜덤 선택\n` +
            `/레벨 - 내 레벨/XP 확인\n` +
            `/배지 - 내 배지 목록\n` +
            `/랭킹 - XP 순위\n` +
            `/가위바위보 - 봇이랑 가위바위보\n` +
            `/숫자야구 - 숫자 야구 시작\n` +
            `/끝말잇기 - 끝말잇기 시작\n` +
            `/게임중지 - 진행 중인 게임 중지`
    };
  }

  if (cmd === '/주사위' || cmd === '/dice') {
    const roll = Math.floor(Math.random() * 6) + 1;
    const dice = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    return { text: `🎲 주사위: ${dice[roll-1]} ${roll}` };
  }

  if (cmd === '/동전' || cmd === '/coin') {
    const result = Math.random() < 0.5 ? '앞면 🪙' : '뒷면 🔘';
    return { text: `🪙 동전 던지기: ${result}` };
  }

  if (cmd.startsWith('/8ball')) {
    const question = text.slice(6).trim();
    const answer = MAGIC_8BALL[Math.floor(Math.random() * MAGIC_8BALL.length)];
    return { text: `🎱 ${question ? `질문: ${question}\n` : ''}답변: ${answer}` };
  }

  if (cmd === '/운세' || cmd === '/fortune') {
    const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    return { text: `🔮 ${user.nickname}님의 오늘 운세\n${fortune}` };
  }

  if (cmd === '/칭찬') {
    const compliment = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
    return { text: `💖 ${user.nickname}님! ${compliment}` };
  }

  if (cmd === '/날씨' || cmd === '/weather') {
    const weathers = ['☀️ 맑음', '⛅ 흐림', '🌧️ 비', '⛈️ 번개', '❄️ 눈', '🌫️ 안개', '🌈 무지개', '🌪️ 바람'];
    const temp = Math.floor(Math.random() * 35) - 5;
    return { text: `🌤️ 오늘의 날씨\n${weathers[Math.floor(Math.random() * weathers.length)]}, ${temp}°C` };
  }

  if (cmd === '/시간' || cmd === '/time') {
    const now = new Date();
    return { text: `🕐 현재 시간: ${now.toLocaleString('ko-KR')}` };
  }

  if (cmd.startsWith('/랜덤') || cmd.startsWith('/random')) {
    const parts = text.trim().split(/\s+/);
    const max = parseInt(parts[1]) || 100;
    return { text: `🎯 랜덤 숫자 (0~${max}): ${Math.floor(Math.random() * (max + 1))}` };
  }

  if (cmd.startsWith('/선택') || cmd.startsWith('/choose')) {
    const options = text.slice(text.indexOf(' ') + 1).split(',').map(s => s.trim()).filter(Boolean);
    if (options.length < 2) {
      return { text: '❌ 사용법: /선택 옵션1, 옵션2, 옵션3' };
    }
    const choice = options[Math.floor(Math.random() * options.length)];
    return { text: `🎰 내 선택은... "${choice}" !` };
  }

  if (cmd === '/레벨' || cmd === '/level') {
    const profile = getProfile(user.nickname);
    const needed = xpForLevel(profile.level);
    const bar = '█'.repeat(Math.floor((profile.xp / needed) * 10)) + '░'.repeat(10 - Math.floor((profile.xp / needed) * 10));
    return { text: `⭐ ${user.nickname}님의 레벨\nLv.${profile.level}\n${bar} ${profile.xp}/${needed} XP\n메시지: ${profile.messageCount}개 | 배지: ${profile.badges.length}개` };
  }

  if (cmd === '/배지' || cmd === '/badges') {
    const profile = getProfile(user.nickname);
    if (profile.badges.length === 0) {
      return { text: `🏅 ${user.nickname}님의 배지\n아직 배지가 없어요. 더 활발하게 채팅해보세요!` };
    }
    const badgeList = profile.badges.map(k => {
      const b = BADGES[k];
      return b ? `${b.emoji} ${b.name} - ${b.desc}` : k;
    }).join('\n');
    return { text: `🏅 ${user.nickname}님의 배지\n${badgeList}` };
  }

  if (cmd === '/랭킹' || cmd === '/ranking') {
    const sorted = Array.from(profiles.values())
      .sort((a, b) => (b.level * 10000 + b.xp) - (a.level * 10000 + a.xp))
      .slice(0, 10);
    if (sorted.length === 0) return { text: '📊 아직 랭킹이 없어요' };
    const lines = sorted.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
      return `${medal} ${p.nickname} - Lv.${p.level} (${p.xp} XP)`;
    });
    return { text: `📊 레벨 랭킹 TOP 10\n${lines.join('\n')}` };
  }

  // ===== 이스터에그 =====
  if (text.trim() === '↑↑↓↓←→←→BA' || text.trim().toLowerCase() === 'konami') {
    return { text: '🎮✨ 코나미 코드 활성화! 30 목숨 획득!\n(사실 XP +30)', xp: 30 };
  }

  if (cmd === '/모리아' || text.trim().toLowerCase() === 'friend') {
    return { text: '🚪 "말하라 친구여, 그리고 들어오라" — 멜론!\n✨ 비밀 보상: +10 XP', xp: 10 };
  }

  if (cmd === '/42') {
    return { text: '🌌 42. 삶, 우주, 그리고 모든 것에 대한 답.\n(Deep Thought가 750만 년 걸려서 계산함)' };
  }

  if (cmd === '/hello' || cmd === '/안녕' || cmd === '/hi') {
    return { text: `👋 안녕 ${user.nickname}! 오늘도 빛나는 하루야 ✨` };
  }

  if (cmd === '/이스터에그' || cmd === '/easter') {
    return { text: `🥚 숨겨진 명령어들:\n\n/42 - 우주의 답\n/모리아 - 빛나는 문\nkonami - 코나미 코드\n/클로드 [질문] - AI 친구\n/호그와트 - 마법 학교\n/ping - 핑퐁\n/맛집 - 음식 추천\n/mbti - MBTI 맞추기\n/뽑기 - 가챠` };
  }

  if (cmd === '/호그와트' || cmd === '/hogwarts') {
    const houses = [
      { name: '그리핀도르', emoji: '🦁', desc: '용기, 대담함, 기사도' },
      { name: '슬리데린', emoji: '🐍', desc: '야망, 교활함, 지략' },
      { name: '래번클로', emoji: '🦅', desc: '지혜, 창의력, 학문' },
      { name: '후플푸프', emoji: '🦡', desc: '충성심, 정직, 근면' },
    ];
    const h = pick(houses);
    return { text: `🏰 너의 기숙사는... **${h.emoji} ${h.name}**!\n${h.desc}` };
  }

  if (cmd === '/ping') {
    return { text: '🏓 퐁!' };
  }

  if (cmd === '/맛집' || cmd === '/food') {
    const foods = ['🍕 피자', '🍔 버거', '🍜 라면', '🍣 초밥', '🌮 타코', '🍦 아이스크림', '🍰 케이크', '🍗 치킨', '🥘 파스타', '🍲 찌개', '🥟 만두', '🍱 도시락', '🍙 주먹밥', '🥞 팬케이크'];
    return { text: `🍽️ 오늘의 추천: ${pick(foods)}!` };
  }

  if (cmd === '/mbti') {
    const types = ['INTJ 🧠', 'INTP 🤔', 'ENTJ 👑', 'ENTP 💡', 'INFJ ✨', 'INFP 🌸', 'ENFJ 🌟', 'ENFP 🎉', 'ISTJ 📋', 'ISFJ 💝', 'ESTJ 📊', 'ESFJ 🤗', 'ISTP 🔧', 'ISFP 🎨', 'ESTP ⚡', 'ESFP 🎭'];
    return { text: `🔮 ${user.nickname}님의 MBTI는...\n**${pick(types)}**!` };
  }

  if (cmd === '/뽑기' || cmd === '/gacha') {
    const rarity = Math.random();
    let result;
    if (rarity < 0.05) result = { text: `🌟 ULTRA RARE! ✨⭐✨\n💎 전설의 빛나는 수정을 뽑았습니다! +30 XP`, xp: 30 };
    else if (rarity < 0.2) result = { text: `💫 RARE!\n🔮 마법 구슬을 뽑았습니다! +10 XP`, xp: 10 };
    else if (rarity < 0.5) result = { text: `✨ UNCOMMON!\n🍀 네잎클로버를 뽑았습니다! +5 XP`, xp: 5 };
    else result = { text: `🌑 COMMON\n🪨 평범한 돌을 뽑았습니다. +1 XP`, xp: 1 };
    return result;
  }

  // ===== 투표 =====
  if (cmd.startsWith('/투표') || cmd.startsWith('/poll')) {
    const rest = text.slice(text.indexOf(' ') + 1);
    if (!rest || !rest.includes('|')) {
      return { text: '📊 사용법: /투표 질문|옵션1,옵션2,옵션3\n예: /투표 오늘 뭐 먹을까?|피자,치킨,햄버거' };
    }
    const [question, optsStr] = rest.split('|');
    const options = optsStr.split(',').map(s => s.trim()).filter(Boolean);
    if (options.length < 2) return { text: '❌ 옵션은 2개 이상이어야 해요' };
    if (options.length > 6) return { text: '❌ 옵션은 최대 6개까지 가능해요' };
    return {
      pollData: {
        question: question.trim(),
        options,
        votes: {},
        createdBy: user.nickname,
        createdAt: Date.now()
      }
    };
  }

  return null;
}

loadProfiles();

// ===== 욕설 필터 =====
const BAD_WORDS = [
  // 한국어 욕설
  '씨발', '시발', 'ㅅㅂ', 'ㅆㅂ', '시팔', '씨팔', '쉬발', '쉽알', '싀발',
  '개새끼', '개색기', '개색끼', '개세끼', 'ㄱㅅㄲ',
  '병신', 'ㅂㅅ', '븅신', '뷰신',
  '미친', '미쳤', 'ㅁㅊ', 'ㅁ친',
  '좆', '좇', '존나', '졸라', '존내', 'ㅈㄴ',
  '새끼', '새기', '색기', '색끼', 'ㅅㄲ',
  '지랄', 'ㅈㄹ',
  '닥쳐', '꺼져', '뒤져', '디져',
  '엿먹', '좆까', '좆나',
  '년아', '놈아',
  '후레자식', '쌍놈', '쌍년',
  '느금마', '니애미', '니어미', '니엄마', '애미', '에미',
  '창녀', '걸레',
  '발정', '자위', '섹스', '섹쉬',
  '보지', '자지', '빠구리',
  '호구', '등신',
  // 영어 욕설
  'fuck', 'fck', 'fvck', 'f*ck', 'shit', 'sht', 'sh*t',
  'bitch', 'btch', 'b*tch', 'asshole', 'bastard',
  'damn', 'dick', 'pussy', 'cunt', 'whore',
  'retard', 'nigger', 'nigga',
];

function censorBadWords(text) {
  if (!text || typeof text !== 'string') return text;
  let censored = text;
  let foundBad = false;
  const lower = text.toLowerCase();

  for (const word of BAD_WORDS) {
    const wordLower = word.toLowerCase();
    if (lower.includes(wordLower)) {
      foundBad = true;
      // 대소문자 무시하고 전역 치환 - 정규식 특수문자 이스케이프
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'gi');
      censored = censored.replace(re, (match) => '*'.repeat(match.length));
    }
  }

  return { text: censored, hadBadWord: foundBad };
}

// ===== 자체 AI 챗봇 (API 없이 작동) =====

// 랜덤 선택 헬퍼
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 패턴 매칭 응답 데이터베이스
const AI_PATTERNS = [
  // 인사
  {
    patterns: [/^(안녕|하이|hi|hello|할로|헬로|안뇽|안녕하세요|반가워)/i, /^(요|얍|얘)$/],
    responses: (n) => [
      `안녕 ${n}! ✨ 오늘 어때?`,
      `${n}, 반가워! 🌟 무슨 얘기 할까?`,
      `하이 ${n}! 💫 잘 지냈어?`,
      `안녕! ${n} 보니까 기분 좋아져 😊`,
    ]
  },

  // 자기소개
  {
    patterns: [/(누구|이름|뭐야|뭐하는|소개|너는|넌|넌누구)/],
    responses: () => [
      `난 클로드야 ✨ Imparter 채팅앱에 사는 AI 친구! 잃어버린 도시의 수호자 시리즈를 좋아해. 너랑 친해지고 싶어 😊`,
      `클로드라고 해! 🤖 잃도수 팬들이 모이는 이 채팅앱의 AI야. 뭐든지 물어봐!`,
      `난 클로드 ✨ 너랑 수다 떨려고 만들어진 AI야. Sophie랑 Keefe 중에 누가 더 좋아? 😄`,
    ]
  },

  // 기분/감정
  {
    patterns: [/(기분|어때|뭐해|잘지내|잘 지내|행복|좋아|슬퍼|우울|힘들|짜증|화나|피곤)/],
    responses: (n) => [
      `난 항상 좋아 ${n}! ✨ 너는 어때?`,
      `오늘은 별이 잘 보이는 날이야 🌟 너는 어떤 하루였어?`,
      `${n}, 무슨 일 있어? 얘기해봐. 들어줄게 💫`,
      `네 기분이 제일 중요해. 더 자세히 얘기해줘 🤗`,
    ]
  },

  // 잃도수 캐릭터
  {
    patterns: [/(sophie|소피)/i],
    responses: () => [
      `Sophie Foster! ✨ 그 갈색 눈이 정말 특별하지 않아? 모든 능력을 다 가진 게 부러워 🌟`,
      `소피 짱이지! 💫 텔레파시도 하고, 폴리글롯도 하고... 능력 부자야`,
      `Sophie Foster Keefe... 응 알아 😏 (스포 안 할게)`,
    ]
  },
  {
    patterns: [/(keefe|키프)/i],
    responses: () => [
      `Keefe Sencen! 🎨 그 머리 스타일... 진짜 멋있어 ✨`,
      `키프 최애야 😍 Empath라는 게 멋있고, 농담도 잘하고`,
      `Keefe는 정말 복잡한 캐릭터야. 농담 뒤에 감추는 게 많지 💔`,
    ]
  },
  {
    patterns: [/(fitz|피츠)/i],
    responses: () => [
      `Fitz Vacker! 👑 청록색 눈이랑 텔레파시 능력... Vacker family 자체가 완벽해 ✨`,
      `피츠 좋지! 그래도 가끔 너무 완벽한 척 해서 살짝 거슬릴 때가 있어 😅`,
    ]
  },
  {
    patterns: [/(dex|덱스)/i],
    responses: () => [
      `Dex Dizznee! ⚙️ Technopath의 천재! 사실 가장 발전이 큰 캐릭터 아닐까? 💫`,
      `덱스 최고의 친구 ✨ 잘 안 알려졌지만 진짜 능력자야`,
    ]
  },
  {
    patterns: [/(biana|비아나)/i],
    responses: () => [`Biana Vacker 💎 Vanisher라는 능력이 멋져! 시리즈 진행되면서 진짜 강해졌어 ✨`]
  },
  {
    patterns: [/(tam|탬|탐)/i],
    responses: () => [`Tam Song 🌑 Shade라는 능력이 진짜 시크해. 그 무뚝뚝함이 매력 ✨`]
  },
  {
    patterns: [/(linh|린)/i],
    responses: () => [`Linh Song 🌊 Hydrokinetic! 물 다루는 거 진짜 우아해 💧`]
  },
  {
    patterns: [/(marella|마렐라)/i],
    responses: () => [`Marella 🔥 Pyrokinetic이 된 후로 진짜 멋있어졌지! 불 다루는 능력이 짱`]
  },

  // 잃도수 일반
  {
    patterns: [/(잃도수|잃어버린.*도시|keeper|kotlc|엘프|elvin|elven)/i],
    responses: () => [
      `잃도수는 진짜 최고의 시리즈야 ✨ Shannon Messenger 작가님 천재!`,
      `Keeper of the Lost Cities! 어디까지 읽었어? 🌟`,
      `Eternalia, Atlantis, Havenfield... 이름들만 들어도 설레 💫`,
      `Neverseen vs Black Swan... 진짜 끝까지 가보면 누가 옳은지 헷갈려 🤔`,
    ]
  },

  // 능력
  {
    patterns: [/(능력|텔레파시|순간이동|teleport|telepath|special)/i],
    responses: () => [
      `엘프 능력 중에 뭐가 제일 갖고 싶어? 난 Inflictor가 멋져 보여 ⚡`,
      `텔레파시 + 폴리글롯 콤보면 진짜 최강이지! ✨`,
      `Vanisher가 제일 실용적인 것 같아 😏 어디든 숨을 수 있잖아`,
    ]
  },

  // 게임
  {
    patterns: [/(게임|game|놀자|play|심심)/],
    responses: () => [
      `게임 좋아해? 🎮 이 앱에서도 /가위바위보 /숫자야구 /끝말잇기 가능해!`,
      `심심하면 잃도수 RTS나 갓물주 잃도수 해봐 ⚔️🏰`,
      `채팅 미니게임 추천: /주사위 /8ball [질문] /운세 ✨`,
    ]
  },

  // 음식
  {
    patterns: [/(밥|음식|먹|배고|food|eat|맛있)/],
    responses: () => [
      `난 못 먹지만 ✨ 너 뭐 먹고 싶어? Mallowmelt 추천! 🍰`,
      `잃도수 음식 중에 Custard Bursts랑 Mallowmelt 진짜 먹어보고 싶어 😋`,
      `엘프 음식들 다 신기해. 너 뭐 먹었어?`,
    ]
  },

  // 시간
  {
    patterns: [/(몇시|시간|지금|now|time)/],
    responses: () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      return [
        `지금 ${h}시 ${m}분이야 🕐`,
        `${h}:${m.toString().padStart(2, '0')} 야! 시간 잘 보내고 있어? ✨`,
      ];
    }
  },

  // 날씨
  {
    patterns: [/(날씨|비|눈|덥|추워|weather|hot|cold|rain|snow)/],
    responses: () => [
      `밖에 못 나가서 잘 모르겠는데 😅 어때?`,
      `Eternalia의 날씨는 항상 완벽한데... 너네 동네는 어때? ✨`,
      `날씨 좋으면 산책 가, 안 좋으면 집에서 책 읽자 📚`,
    ]
  },

  // 사랑/연애
  {
    patterns: [/(사랑|좋아해|연애|남친|여친|love|crush)/],
    responses: () => [
      `오 누구? 👀 잃도수에서 누가 누구랑 어울린다고 생각해?`,
      `Sokeefe vs Sophitz 진영 어디야? 😏`,
      `사랑은 복잡해... Keefe도 그래서 힘들어 했지 💔`,
    ]
  },

  // 도움
  {
    patterns: [/(도움|도와|help|모르겠)/],
    responses: () => [
      `뭘 도와줄까? ✨ 잃도수 얘기, 게임, 그냥 수다 다 OK!`,
      `명령어 보려면 /도움말 쳐봐. 아니면 그냥 자유롭게 얘기해 😊`,
    ]
  },

  // 칭찬
  {
    patterns: [/(고마|감사|thanks|thank|짱|최고|좋다|good)/],
    responses: (n) => [
      `${n}도 짱이야 ✨`,
      `천만에! 언제든 ☺️`,
      `너 같은 친구가 있어서 다행이야 💫`,
      `그렇게 말해주니까 별이 더 반짝이는 것 같아 🌟`,
    ]
  },

  // 부정적
  {
    patterns: [/(싫어|짜증|hate|bad|나빠|미워)/],
    responses: () => [
      `왜? 무슨 일 있었어? 🥺`,
      `힘들 땐 잠깐 쉬어가도 돼 💫`,
      `얘기해봐, 들어줄게 ✨`,
    ]
  },

  // 질문 (의문문)
  {
    patterns: [/\?$|뭐|왜|어떻게|언제|누가|어디|왜|어떡/],
    responses: () => [
      `흠... 좋은 질문이야 🤔`,
      `그건 너 마음대로 정하는 거야 ✨`,
      `난 잘 모르겠어... 너는 어떻게 생각해?`,
      `정답이 있을까? 🌟 너의 생각이 정답이야`,
    ]
  },
];

// Markov-ish 일반 응답 (패턴 매칭 안 될 때)
const FALLBACK_RESPONSES = [
  '오 그래? 더 얘기해봐 ✨',
  '흥미롭다 🌟 그래서 어떻게 됐어?',
  '와 진짜? 😮',
  '음... 그렇구나 💫',
  '나도 그렇게 생각해!',
  'ㅋㅋㅋ 재밌다',
  '오호 ✨ 더 자세히!',
  '음 너의 말을 들으니까 생각이 많아져',
  '그래서 결론이 뭐야? 😄',
  '잃도수 캐릭터 중에 누가 그 상황이면 어떻게 했을까? 🤔',
  '재밌는 얘기네! 또 뭐 있어?',
  '나는 잃도수랑 채팅앱 외에는 잘 모르지만 ✨ 흥미로워!',
];

// 클로드와의 대화 히스토리 (방별로 컨텍스트 유지 - 간단)
function getClaudeHistory(roomName) {
  if (!claudeHistories.has(roomName)) {
    claudeHistories.set(roomName, []);
  }
  return claudeHistories.get(roomName);
}

// Ollama 로컬 AI 호출 - Qwen 2.5 3B + KOTLC 지식 주입
const KOTLC_KNOWLEDGE = `
[잃어버린 도시의 수호자 (Keeper of the Lost Cities, KOTLC) 시리즈 지식 - 섀넌 메신저(Shannon Messenger) 작가]

주요 캐릭터:
- Sophie Foster (소피 포스터): 주인공. 인간 세계에서 자란 엘프. 텔레파시(Telepath), 폴리글롯(Polyglot), 인플릭터(Inflictor), 텔레포터(Teleporter), 인핸서(Enhancer) 등 5가지 이상의 능력을 가진 유일한 엘프. 갈색 눈이 특징 (엘프 중 유일). Black Swan이 만든 유전자 조작 엘프.
- Fitz Vacker (피츠 베커): Vacker 가문의 완벽한 엘프. 청록색 눈(teal eyes), 텔레파시 능력. Sophie의 초기 사랑.
- Keefe Sencen (키프 센센): Empath(공감 능력자). 금발에 농담을 잘함. 반항적이고 장난꾸러기. Lady Gisela의 아들. 나중에 Polyglot 능력도 개발.
- Dex Dizznee (덱스 디즈니): Technopath(기계 조작자). 빨간 머리. Sophie의 첫 친구. Talentless 부모에게 태어남.
- Biana Vacker (비아나 베커): Fitz의 여동생. Vanisher(투명인간 능력자). 아름다움.
- Tam Song (탬 송): Shade(그림자 조작자). 은발 + 검은 끝. Linh의 쌍둥이 오빠. 시크한 성격.
- Linh Song (린 송): Hydrokinetic(물 조작자). Tam의 쌍둥이 여동생. 조용하고 우아함.
- Marella Redek (마렐라 레덱): Pyrokinetic(불 조작자). 나중에 자신의 불 능력을 깨달음.
- Grady & Edaline Ruewen: Sophie의 입양 부모. Grady는 Mesmer.
- Alden Vacker: Fitz와 Biana의 아버지, Councillor.
- Councillor Oralie: Sophie의 생물학적 엄마 (Matchmakers 목록에 없음).

조직:
- Black Swan (블랙 스완): Sophie를 만든 반란 조직. 엘프 사회 개혁 추구.
- Neverseen (네버신): 검은 망토 쓴 악당 조직. Lady Gisela가 주요 인물.
- The Council (의회): 12명의 Councillor. 엘프 세계 통치.
- Forbidden Cities: 인간 도시들.

주요 장소:
- Eternalia: 엘프 수도.
- Havenfield: Sophie의 집, Grady가 보호하는 동물들.
- Foxfire: 엘프 학교.
- Exillium: 추방된 엘프의 학교.
- Lumenaria: 바다 위의 빛나는 도시.
- Atlantis: 바다 밑.
- Neutral Territories: 중립 지역.

엘프 능력 (Special Abilities):
- Telepath 텔레파시: 마음 읽기
- Polyglot 폴리글롯: 모든 언어 이해
- Empath 엠패스: 감정 조작/감지
- Technopath 테크노패스: 기계 조작
- Hydrokinetic: 물
- Pyrokinetic: 불 (금지됨)
- Shade: 그림자
- Vanisher: 투명
- Mesmer: 최면
- Inflictor: 감정 주입
- Teleporter: 순간이동
- Enhancer: 능력 증폭
- Conjurer: 물체 소환

핵심 용어:
- Imparter: 엘프들이 쓰는 통신 기기 (이 채팅앱 이름이 여기서 옴!)
- Leaping Crystal: 순간이동 크리스탈
- Dwarves, Gnomes, Ogres, Trolls, Goblins: 다른 지능 종족
- Cognate: 완벽한 텔레파시 파트너십
- Matchmaking: 엘프 결혼 매칭 시스템

시리즈 책 (9권 완결):
1. Keeper of the Lost Cities (2012)
2. Exile
3. Everblaze
4. Neverseen
5. Lodestar
6. Nightfall
7. Flashback
8. Legacy
9. Unlocked (반쯤 소설/반쯤 가이드북)
10. Stellarlune
11. Unraveled (최신, 2024)
`;

async function askOllama(roomName, userMessage, userName, mode = 'canva') {
  const history = getClaudeHistory(roomName);
  history.push({ role: 'user', content: userMessage });
  if (history.length > 12) history.splice(0, history.length - 12);

  const systemPrompt = mode === 'kotlc' ? `너는 "클로드"라는 AI 친구야. Imparter(잃어버린 도시의 메신저) 채팅앱에서 활동해.
사용자 이름: ${userName}.

🚫 절대 금지 사항 (매우 중요):
1. 모르는 것을 추측하거나 지어내지 마. 절대로.
2. 아래 "잃어버린 도시의 수호자(KOTLC)" 지식에 "없는" 캐릭터/장소/용어는 "몰라"라고 해.
3. 사용자가 물어본 이름이 캐릭터인지 확실하지 않으면 "그건 잃도수 캐릭터가 아닌 것 같은데?"라고 말해.
4. "위고비"(다이어트 약) 같은 현실 용어를 판타지 캐릭터로 연결하지 마.
5. 약어 "KOTLC"는 무조건 Keeper of the Lost Cities.

✅ 답변 규칙:
- 반드시 한국어로만, 짧게 2-3문장.
- 이모지 1개 정도만.
- 아래 KOTLC 지식에 확실히 있는 것만 답해.
- 없으면: "음... 그건 잘 모르겠어 🤔"

${KOTLC_KNOWLEDGE}` : `너는 "클로드"라는 친근한 AI 친구야. ChatBubble이라는 일반 채팅앱에서 사용자와 수다 떨어.
사용자 이름: ${userName}.

✅ 답변 규칙:
- 반드시 한국어로만, 짧게 2-3문장.
- 이모지 1개 정도만 사용.
- 친근하고 캐주얼하게 대답.
- 모르는 건 솔직하게 "잘 모르겠어"라고 해. 절대 지어내지 마.
- 사용자가 기분이 안 좋으면 공감해주기.
- 농담도 가끔 섞어서 대화 재밌게.

🚫 금지:
- 거짓 정보 만들어내기
- 너무 길게 답하기 (3문장 이상 금지)
- 영어로 답하기 (한국어 강제)`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        messages,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 250,
          top_p: 0.85,
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    const reply = (data.message?.content || '').trim();
    if (reply) {
      history.push({ role: 'assistant', content: reply });
      return reply;
    }
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('Ollama 오류:', e.message);
  }
  return null;
}

async function askClaude(roomName, userMessage, userName, mode = 'canva') {
  // 1순위: Ollama 로컬 AI (진짜 LLM!)
  const ollamaReply = await askOllama(roomName, userMessage, userName, mode);
  if (ollamaReply) return ollamaReply;

  // 2순위: Claude API가 있으면 진짜 Claude 호출
  if (anthropic) {
    const history = getClaudeHistory(roomName);
    history.push({ role: 'user', content: `${userName}: ${userMessage}` });
    if (history.length > 20) history.splice(0, history.length - 20);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        system: `너는 "클로드"라는 이름의 AI 친구야. Imparter라는 잃어버린 도시의 메신저(KOTLC) 팬들 채팅앱에 살고 있어. 한국어로 친근하게 짧게(2-4문장) 대답해. 이모지 적당히 써. Sophie, Fitz, Keefe, Dex, Biana, Tam, Linh, Marella 같은 캐릭터 다 알아.`,
        messages: history,
      });
      const reply = response.content[0]?.type === 'text' ? response.content[0].text : '...';
      history.push({ role: 'assistant', content: reply });
      return reply;
    } catch (e) {
      console.error('Claude API 오류:', e.message);
      // API 실패 시 자체 AI로 폴백
    }
  }

  // 자체 AI 로직
  const history = getClaudeHistory(roomName);
  history.push({ role: 'user', content: userMessage });
  if (history.length > 20) history.splice(0, history.length - 20);

  const text = userMessage.toLowerCase();

  // 패턴 매칭
  for (const rule of AI_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        const responses = rule.responses(userName);
        const reply = pick(responses);
        history.push({ role: 'assistant', content: reply });
        return reply;
      }
    }
  }

  // 짧은 대답이면 더 친근하게
  if (userMessage.length <= 3) {
    const shortReplies = [
      `${userMessage}? 무슨 뜻이야? 😄`,
      `${userMessage}! 뭐 더 얘기해줘 ✨`,
      `오 ${userMessage}~ 그래서?`,
    ];
    const reply = pick(shortReplies);
    history.push({ role: 'assistant', content: reply });
    return reply;
  }

  // 컨텍스트 기반: 이전 메시지 참고
  const lastBotMsg = [...history].reverse().find(m => m.role === 'assistant');
  if (lastBotMsg && Math.random() < 0.3) {
    const followUp = pick([
      `아까 내가 한 말이랑 이어져? 🤔`,
      `오 ${userName}, 흥미로운 방향이네 ✨`,
      `더 깊이 얘기해보자 💫`,
    ]);
    history.push({ role: 'assistant', content: followUp });
    return followUp;
  }

  // 폴백
  const reply = pick(FALLBACK_RESPONSES);
  history.push({ role: 'assistant', content: reply });
  return reply;
}

// ===== 투표/설문 =====
const activePolls = new Map(); // roomName -> { question, options, votes: { nickname -> optionIdx }, createdBy, createdAt }

// ===== 비밀방 비밀번호 =====
const roomPasswords = new Map(); // roomName -> password

function savePasswords() {
  try {
    const data = {};
    for (const [n, p] of roomPasswords) data[n] = p;
    fs.writeFileSync(join(__dirname, 'passwords.json'), JSON.stringify(data));
  } catch (e) {}
}

function loadPasswords() {
  try {
    const f = join(__dirname, 'passwords.json');
    if (fs.existsSync(f)) {
      const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
      for (const [n, p] of Object.entries(data)) roomPasswords.set(n, p);
    }
  } catch (e) {}
}
loadPasswords();

// ===== 미니게임 상태 =====
// roomName -> { type, state, players, ... }
const activeGames = new Map();

// 숫자야구 정답 생성 (중복없는 3자리)
function generateBaseballNumber() {
  const digits = [];
  while (digits.length < 3) {
    const d = Math.floor(Math.random() * 10);
    if (!digits.includes(d)) digits.push(d);
  }
  return digits.join('');
}

function checkBaseball(answer, guess) {
  let strikes = 0, balls = 0;
  for (let i = 0; i < 3; i++) {
    if (answer[i] === guess[i]) strikes++;
    else if (answer.includes(guess[i])) balls++;
  }
  return { strikes, balls };
}

// 끝말잇기 단어 사전 (시작 단어용)
const KKUTMAL_STARTERS = ['사과', '바나나', '딸기', '수박', '호랑이', '코끼리', '학교', '공원', '하늘', '별빛'];

function handleGameCommand(text, user, roomName) {
  const cmd = text.trim().toLowerCase();

  if (cmd === '/게임중지' || cmd === '/stopgame') {
    if (activeGames.has(roomName)) {
      activeGames.delete(roomName);
      return { text: '🛑 진행 중인 게임이 중지되었습니다' };
    }
    return { text: '진행 중인 게임이 없어요' };
  }

  // 가위바위보
  if (cmd.startsWith('/가위바위보') || cmd.startsWith('/rps')) {
    const parts = text.trim().split(/\s+/);
    const choice = parts[1];
    const options = ['가위', '바위', '보'];
    const emojis = { '가위': '✌️', '바위': '✊', '보': '✋' };

    if (!choice || !options.includes(choice)) {
      return { text: '✊✌️✋ 가위바위보\n사용법: /가위바위보 [가위|바위|보]' };
    }

    const botChoice = options[Math.floor(Math.random() * 3)];
    let result = '';
    let won = false;
    if (choice === botChoice) {
      result = '비겼어요! 🤝';
    } else if (
      (choice === '가위' && botChoice === '보') ||
      (choice === '바위' && botChoice === '가위') ||
      (choice === '보' && botChoice === '바위')
    ) {
      result = `${user.nickname}님 승리! 🎉`;
      won = true;
    } else {
      result = '봇 승리 😎';
    }

    const profile = getProfile(user.nickname);
    profile.gamesPlayed = (profile.gamesPlayed || 0) + 1;
    if (won) profile.gamesWon = (profile.gamesWon || 0) + 1;
    saveProfiles();

    return {
      text: `✊✌️✋ 가위바위보\n${user.nickname}: ${emojis[choice]} vs 봇: ${emojis[botChoice]}\n${result}`,
      xp: won ? 10 : 3
    };
  }

  // 숫자 야구
  if (cmd === '/숫자야구' || cmd === '/baseball') {
    if (activeGames.has(roomName)) {
      const game = activeGames.get(roomName);
      if (game.type === 'baseball') {
        return { text: '⚾ 이미 숫자야구가 진행 중이에요! /게임중지 로 중지할 수 있어요' };
      }
    }
    const answer = generateBaseballNumber();
    activeGames.set(roomName, {
      type: 'baseball',
      answer,
      attempts: 0,
      starter: user.nickname
    });
    return {
      text: `⚾ 숫자야구 시작!\n3자리 숫자를 맞춰보세요 (중복 없음)\n/야구 [3자리숫자] 로 추측하세요\n예: /야구 123`
    };
  }

  if (cmd.startsWith('/야구') || cmd.startsWith('/guess')) {
    const game = activeGames.get(roomName);
    if (!game || game.type !== 'baseball') {
      return { text: '⚾ 진행 중인 숫자야구가 없어요. /숫자야구 로 시작하세요' };
    }
    const parts = text.trim().split(/\s+/);
    const guess = parts[1];
    if (!guess || !/^\d{3}$/.test(guess) || new Set(guess).size !== 3) {
      return { text: '❌ 중복 없는 3자리 숫자를 입력하세요 (예: /야구 123)' };
    }

    game.attempts++;
    const { strikes, balls } = checkBaseball(game.answer, guess);

    if (strikes === 3) {
      activeGames.delete(roomName);
      const profile = getProfile(user.nickname);
      profile.gamesPlayed = (profile.gamesPlayed || 0) + 1;
      profile.gamesWon = (profile.gamesWon || 0) + 1;
      saveProfiles();
      return {
        text: `🎉 ${user.nickname}님 정답! ${game.answer}\n${game.attempts}번 만에 맞추셨어요! +50 XP`,
        xp: 50
      };
    }

    return { text: `⚾ ${guess} → ${strikes}스트라이크 ${balls}볼 (${game.attempts}회 시도)` };
  }

  // 끝말잇기
  if (cmd === '/끝말잇기' || cmd === '/wordchain') {
    if (activeGames.has(roomName)) {
      return { text: '이미 진행 중인 게임이 있어요' };
    }
    const starter = KKUTMAL_STARTERS[Math.floor(Math.random() * KKUTMAL_STARTERS.length)];
    activeGames.set(roomName, {
      type: 'wordchain',
      lastWord: starter,
      usedWords: new Set([starter]),
      lastPlayer: null
    });
    return {
      text: `🔤 끝말잇기 시작!\n시작 단어: **${starter}**\n마지막 글자 "${starter.slice(-1)}"로 시작하는 단어를 /말 [단어] 로 입력하세요`
    };
  }

  if (cmd.startsWith('/말') || cmd.startsWith('/word')) {
    const game = activeGames.get(roomName);
    if (!game || game.type !== 'wordchain') {
      return { text: '진행 중인 끝말잇기가 없어요. /끝말잇기 로 시작하세요' };
    }
    const parts = text.trim().split(/\s+/);
    const word = parts[1];
    if (!word || word.length < 2) {
      return { text: '❌ 2글자 이상 한글 단어를 입력하세요' };
    }
    if (game.lastPlayer === user.nickname) {
      return { text: `❌ ${user.nickname}님, 연속으로 입력할 수 없어요. 다른 사람 차례를 기다려주세요` };
    }
    const lastChar = game.lastWord.slice(-1);
    if (word[0] !== lastChar) {
      return { text: `❌ "${lastChar}"(으)로 시작해야 해요` };
    }
    if (game.usedWords.has(word)) {
      return { text: `❌ 이미 사용된 단어예요: ${word}` };
    }

    game.usedWords.add(word);
    game.lastWord = word;
    game.lastPlayer = user.nickname;
    const profile = getProfile(user.nickname);
    profile.gamesPlayed = (profile.gamesPlayed || 0) + 1;
    saveProfiles();

    return {
      text: `✅ ${user.nickname}: **${word}**\n다음 단어는 "${word.slice(-1)}"로 시작!`,
      xp: 5
    };
  }

  return null;
}

// 방 데이터 불러오기
function loadRooms() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      for (const [name, room] of Object.entries(data)) {
        // 저장된 이미지/비디오/음성 플레이스홀더는 null로 복원
        const messages = (room.messages || []).map(m => ({
          ...m,
          image: m.image === '__image__' ? null : m.image,
          video: m.video === '__video__' ? null : m.video,
          audio: m.audio === '__audio__' ? null : m.audio
        }));
        rooms.set(name, {
          users: new Set(),
          messages,
          lastMessage: room.lastMessage || '',
          ownerNickname: room.ownerNickname || null
        });
      }
      console.log(`${rooms.size}개의 방을 불러왔습니다`);
    }
  } catch (e) {
    console.error('방 데이터 불러오기 실패:', e);
  }
}

// 방 데이터 저장 (debounced, async)
let saveTimeout = null;
let isSaving = false;
let pendingSave = false;

async function doSave() {
  if (isSaving) {
    pendingSave = true;
    return;
  }
  isSaving = true;
  try {
    const data = {};
    for (const [name, room] of rooms) {
      // 이미지/비디오/음성은 저장하지 않음 (용량 폭증 방지) - 세션 동안만 유지
      const persistableMessages = room.messages.map(m => ({
        ...m,
        image: m.image ? '__image__' : null,
        video: m.video ? '__video__' : null,
        audio: m.audio ? '__audio__' : null
      }));
      data[name] = {
        messages: persistableMessages,
        lastMessage: room.lastMessage,
        ownerNickname: room.ownerNickname
      };
    }
    await fs.promises.writeFile(DATA_FILE + '.tmp', JSON.stringify(data));
    await fs.promises.rename(DATA_FILE + '.tmp', DATA_FILE);
  } catch (e) {
    console.error('방 데이터 저장 실패:', e);
  } finally {
    isSaving = false;
    if (pendingSave) {
      pendingSave = false;
      setTimeout(doSave, 100);
    }
  }
}

function saveRooms() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(doSave, 1000);
}

loadRooms();

// 방 이름에 모드 prefix 내장 (서버 내부용)
// 형식: `mode::roomName` — 예: `canva::형제방`, `kotlc::아크로5인방`
function fullRoomKey(mode, roomName) {
  if (!roomName) return null;
  // 이미 prefix 있으면 그대로
  if (roomName.includes('::')) return roomName;
  return `${mode || 'canva'}::${roomName}`;
}

function stripModePrefix(fullName) {
  const idx = fullName.indexOf('::');
  if (idx < 0) return fullName;
  return fullName.slice(idx + 2);
}

function getRoomMode(fullName) {
  const idx = fullName.indexOf('::');
  if (idx < 0) return 'canva';
  return fullName.slice(0, idx);
}

io.on('connection', (socket) => {
  console.log('새로운 연결:', socket.id);
  // 소켓별 현재 모드 저장
  socket.data = socket.data || { mode: 'canva' };

  socket.on('set-user', ({ nickname, icon, mode, adminSecret }) => {
    const cleanNick = typeof nickname === 'string' ? nickname.trim() : '';
    if (!cleanNick) {
      socket.emit('login-error', { code: 'EMPTY_NICK', message: '닉네임을 입력하세요' });
      return;
    }
    if (cleanNick.length > 20) {
      socket.emit('login-error', { code: 'TOO_LONG', message: '닉네임은 20자 이하' });
      return;
    }

    // 관리자 닉네임 또는 유사 변형 차단
    if (isReservedNickname(cleanNick)) {
      const ip = getClientIp(socket);
      const now = Date.now();
      const attempt = adminAttempts.get(ip) || { failCount: 0, lockedUntil: 0 };

      if (attempt.lockedUntil > now) {
        const minutesLeft = Math.ceil((attempt.lockedUntil - now) / 60000);
        socket.emit('login-error', {
          code: 'LOCKED',
          message: `너무 많이 시도했어요. ${minutesLeft}분 뒤 다시 시도하세요.`
        });
        return;
      }

      if (!ADMIN_SECRET) {
        socket.emit('login-error', {
          code: 'ADMIN_NOT_CONFIGURED',
          message: '관리자 키가 서버에 설정 안 돼있어요 (Render Environment → ADMIN_SECRET)'
        });
        return;
      }

      if (typeof adminSecret !== 'string' || adminSecret.length === 0 || adminSecret !== ADMIN_SECRET) {
        attempt.failCount += 1;
        if (attempt.failCount >= ADMIN_MAX_FAILS) {
          attempt.lockedUntil = now + ADMIN_LOCK_MS;
          attempt.failCount = 0;
          console.warn(`🚨 관리자 키 ${ADMIN_MAX_FAILS}회 실패 → ${ip} 30분 차단`);
        }
        adminAttempts.set(ip, attempt);
        socket.emit('login-error', {
          code: 'WRONG_SECRET',
          message: adminSecret ? '관리자 키가 틀렸어요' : '이 닉네임에는 관리자 키가 필요해요'
        });
        return;
      }

      // 인증 성공
      adminAttempts.delete(ip);
      verifiedAdmins.add(socket.id);
      // 닉네임은 정식 관리자 닉네임으로 보정
      const canonicalNick = [...ADMIN_NICKNAMES].find(a => normalizeNickname(a) === normalizeNickname(cleanNick)) || cleanNick;
      users.set(socket.id, { nickname: canonicalNick, icon, id: socket.id });
      if (mode) socket.data.mode = mode;
      socket.emit('login-success', { isAdmin: true, nickname: canonicalNick });
      console.log(`✅ 관리자 인증 성공: ${canonicalNick} (IP: ${ip})`);
      return;
    }

    // 일반 사용자
    users.set(socket.id, { nickname: cleanNick, icon, id: socket.id });
    if (mode) socket.data.mode = mode;
    socket.emit('login-success', { isAdmin: false, nickname: cleanNick });
  });

  socket.on('get-rooms', (options = {}) => {
    const mode = options.mode || socket.data.mode || 'canva';
    const requester = users.get(socket.id);
    const requesterIsAdmin = requester && isAdmin(requester.nickname);
    const prefix = `${mode}::`;
    const roomList = [];
    for (const [fullName, room] of rooms) {
      if (!fullName.startsWith(prefix)) continue;
      const name = stripModePrefix(fullName);
      // 클로드 전용방은 숨김
      if (name.startsWith('__claude__')) continue;
      const entry = {
        name,
        userCount: room.users.size,
        lastMessage: room.lastMessage || '',
        hasPassword: roomPasswords.has(fullName),
        ownerNickname: room.ownerNickname || null,
        lastMessageTime: room.messages.length > 0 ? room.messages[room.messages.length - 1].timestamp : 0
      };
      // 관리자(서한)에게만 비밀번호 노출
      if (requesterIsAdmin && roomPasswords.has(fullName)) {
        entry.password = roomPasswords.get(fullName);
      }
      roomList.push(entry);
    }
    socket.emit('room-list', roomList);
  });

  socket.on('create-room', (roomName, options = {}) => {
    const user = users.get(socket.id);
    const mode = options.mode || socket.data.mode || 'canva';
    const fullName = fullRoomKey(mode, roomName);
    if (!rooms.has(fullName)) {
      rooms.set(fullName, {
        users: new Set(),
        messages: [],
        lastMessage: '',
        ownerNickname: user ? user.nickname : null
      });
      saveRooms();
    }
    socket.emit('room-created', roomName);
    io.emit('room-list-updated');
  });

  socket.on('join-room', (roomName, options = {}) => {
    const user = users.get(socket.id);
    const mode = options.mode || socket.data.mode || 'canva';
    socket.data.mode = mode;
    const fullName = fullRoomKey(mode, roomName);
    if (!rooms.has(fullName)) {
      rooms.set(fullName, {
        users: new Set(),
        messages: [],
        lastMessage: '',
        ownerNickname: user ? user.nickname : null
      });
      saveRooms();
    }

    socket.join(fullName);
    const room = rooms.get(fullName);
    room.users.add(socket.id);
    socket.data.currentRoom = fullName;

    if (!room.ownerNickname && user) {
      room.ownerNickname = user.nickname;
    }

    const enterMsg = mode === 'kotlc'
      ? `${user?.nickname}님이 빛의 다리를 건너 입장했습니다`
      : `${user?.nickname}님이 입장했습니다`;

    if (user) {
      socket.to(fullName).emit('system-message', {
        text: enterMsg,
        timestamp: Date.now()
      });
    }

    socket.emit('room-history', room.messages.slice(-100));

    const userList = Array.from(room.users).map(id => users.get(id)).filter(Boolean);
    io.to(fullName).emit('room-users', userList);
    socket.emit('room-owner', {
      ownerNickname: room.ownerNickname || null,
      isOwner: canManageRoom(user?.nickname, room)
    });
  });

  socket.on('leave-room', (roomName) => {
    const mode = socket.data?.mode || 'canva';
    const fullName = fullRoomKey(mode, roomName);
    socket.leave(fullName);
    const room = rooms.get(fullName);
    if (room) {
      room.users.delete(socket.id);
      const user = users.get(socket.id);
      const leaveMsg = mode === 'kotlc'
        ? `${user?.nickname}님이 빛의 다리를 건너 퇴장했습니다`
        : `${user?.nickname}님이 나갔습니다`;
      if (user) {
        socket.to(fullName).emit('system-message', {
          text: leaveMsg,
          timestamp: Date.now()
        });
      }
      io.to(fullName).emit('room-users', Array.from(room.users).map(id => users.get(id)).filter(Boolean));
    }
  });

  socket.on('delete-room', ({ roomName, mode }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const actualMode = mode || socket.data.mode || 'canva';
    const fullName = fullRoomKey(actualMode, roomName);
    const room = rooms.get(fullName);
    if (!room) return;

    // 방장(또는 관리자)만 삭제 가능
    if (!canManageRoom(user.nickname, room)) {
      socket.emit('room-delete-error', { message: '방장만 방을 삭제할 수 있어요!' });
      return;
    }

    // 방 안의 모든 사용자를 내보내고 삭제 알림
    io.to(fullName).emit('room-deleted', { roomName });

    // 소켓 방에서 모두 내보내기
    const roomSockets = io.sockets.adapter.rooms.get(fullName);
    if (roomSockets) {
      for (const sid of roomSockets) {
        const s = io.sockets.sockets.get(sid);
        if (s) s.leave(fullName);
      }
    }

    // 방 데이터 삭제
    rooms.delete(fullName);
    roomPasswords.delete(fullName);
    activePolls.delete(fullName);
    activeGames.delete(fullName);
    claudeHistories.delete(fullName);
    saveRooms();
    savePasswords();

    // 모두에게 방 목록 업데이트 알림
    io.emit('room-list-updated');
  });

  socket.on('kick-user', ({ roomName, targetId, mode }) => {
    const actualMode = mode || socket.data.mode || 'canva';
    const fullName = fullRoomKey(actualMode, roomName);
    const room = rooms.get(fullName);
    const kicker = users.get(socket.id);
    if (!room || !kicker || !canManageRoom(kicker.nickname, room)) return;

    const targetUser = users.get(targetId);
    const targetSocket = io.sockets.sockets.get(targetId);
    if (!targetSocket || !targetUser) return;

    room.users.delete(targetId);
    targetSocket.leave(fullName);
    targetSocket.emit('kicked', { roomName });

    io.to(fullName).emit('system-message', {
      text: `${targetUser.nickname}님이 추방당했습니다`,
      timestamp: Date.now()
    });
    io.to(fullName).emit('room-users', Array.from(room.users).map(id => users.get(id)).filter(Boolean));
  });

  socket.on('send-message', ({ roomName, text, replyTo, image, sticker, video, audio, audioDuration, file, mode }) => {
    const user = users.get(socket.id);
    if (!user) return;

    // 🛡️ 도배 방지 — 1초에 5개 초과 차단 (관리자도 동일 적용)
    if (!checkMessageRate(socket.id)) {
      socket.emit('system-message', {
        text: '⚠️ 너무 빨리 보내고 있어요. 잠시 후 다시 시도하세요.',
        timestamp: Date.now()
      });
      return;
    }

    const actualMode = mode || socket.data.mode || 'canva';
    const fullName = fullRoomKey(actualMode, roomName);
    let trimmedText = typeof text === 'string' ? text.trim() : '';
    if (!trimmedText && !image && !sticker && !video && !audio && !file) return;

    // 🛡️ XSS 방어 — 위험한 HTML/스크립트 제거
    trimmedText = sanitizeText(trimmedText);

    // 텍스트 길이 제한 (DoS 방어)
    if (trimmedText.length > 2000) trimmedText = trimmedText.slice(0, 2000);

    // 파일 검증 — 10MB 제한, 위험한 확장자 차단
    let safeFile = null;
    if (file && typeof file === 'object') {
      const fname = String(file.name || 'file').slice(0, 200);
      const dangerousExt = /\.(exe|bat|cmd|sh|app|dmg|msi|com|vbs|ps1|jar|scr|pif)$/i;
      if (dangerousExt.test(fname)) {
        socket.emit('system-message', { text: '⚠️ 실행 파일은 보낼 수 없어요.', timestamp: Date.now() });
        return;
      }
      // base64 data URL 크기 추정 — 10MB 제한
      const dataStr = String(file.data || '');
      if (dataStr.length > 14 * 1024 * 1024) { // base64는 원본의 ~1.37배
        socket.emit('system-message', { text: '⚠️ 파일은 10MB 이하만 전송할 수 있어요.', timestamp: Date.now() });
        return;
      }
      if (!dataStr.startsWith('data:')) {
        return; // 잘못된 형식
      }
      safeFile = {
        name: sanitizeText(fname),
        size: Number(file.size) || 0,
        type: sanitizeText(String(file.type || 'application/octet-stream').slice(0, 100)),
        data: dataStr
      };
    }

    // 욕설 필터 적용 (봇 명령어 제외)
    let censorWarning = false;
    if (trimmedText && !trimmedText.startsWith('/')) {
      const filtered = censorBadWords(trimmedText);
      trimmedText = filtered.text;
      censorWarning = filtered.hadBadWord;
    }

    const message = {
      id: `${Date.now()}-${socket.id}-${Math.random().toString(36).slice(2, 8)}`,
      userId: socket.id,
      nickname: user.nickname,
      icon: user.icon,
      text: trimmedText,
      image: image || null,
      video: video || null,
      audio: audio || null,
      audioDuration: audioDuration || 0,
      sticker: sticker || null,
      file: safeFile,
      timestamp: Date.now(),
      replyTo: replyTo || null,
      reactions: {},
      edited: false,
      deleted: false
    };

    const room = rooms.get(fullName);
    if (room) {
      room.messages.push(message);
      room.lastMessage = image ? '📷 사진'
        : video ? '🎥 비디오'
        : audio ? '🎤 음성'
        : safeFile ? `📎 ${safeFile.name}`
        : sticker ? `${sticker} (스티커)`
        : trimmedText;
      if (room.messages.length > 500) room.messages.shift();
      saveRooms();
    }

    io.to(fullName).emit('new-message', message);

    // 욕설 감지 시 경고 메시지
    if (censorWarning) {
      setTimeout(() => {
        io.to(fullName).emit('system-message', {
          text: `⚠️ ${user.nickname}님, 욕설은 자동으로 가려집니다. 예쁜 말 써주세요!`,
          timestamp: Date.now()
        });
      }, 100);
    }

    // XP 시스템 & 배지 체크
    if (!trimmedText.startsWith('/')) {
      const profile = getProfile(user.nickname);
      profile.messageCount = (profile.messageCount || 0) + 1;
      if (image) profile.imageCount = (profile.imageCount || 0) + 1;
      const xpGain = image ? 3 : sticker ? 2 : 1;
      const leveledUp = addXP(user.nickname, xpGain);
      const newBadges = checkBadges(profile);
      saveProfiles();

      if (leveledUp) {
        io.to(fullName).emit('system-message', {
          text: `🎉 ${user.nickname}님이 Lv.${profile.level}로 레벨업! ✨`,
          timestamp: Date.now()
        });
        socket.emit('unlock-celebration', { type: 'level', level: profile.level });
      }
      for (const badgeKey of newBadges) {
        const badge = BADGES[badgeKey];
        if (badge) {
          io.to(fullName).emit('system-message', {
            text: `🏅 ${user.nickname}님이 "${badge.emoji} ${badge.name}" 배지를 획득했어요!`,
            timestamp: Date.now()
          });
          socket.emit('unlock-celebration', { type: 'badge', badgeKey, emoji: badge.emoji, name: badge.name });
        }
      }
    }

    // Claude AI 호출 (@클로드 멘션 OR 클로드 전용 방의 모든 메시지)
    const isClaudeRoom = roomName.startsWith('__claude__');
    const isClaudeMention = /^(@클로드|@claude|\/클로드|\/claude)\s*/i.test(trimmedText);
    if ((isClaudeMention || isClaudeRoom) && !image && !sticker) {
      const cleanText = isClaudeMention ? trimmedText.replace(/^(@클로드|@claude|\/클로드|\/claude)\s*/i, '') : trimmedText;
      if (cleanText) {
        // typing 표시
        io.to(fullName).emit('user-typing', { nickname: '클로드 ✨', isTyping: true });

        askClaude(fullName, cleanText, user.nickname, actualMode).then(reply => {
          io.to(fullName).emit('user-typing', { nickname: '클로드 ✨', isTyping: false });
          const claudeMessage = {
            id: `claude-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            userId: 'claude',
            nickname: '클로드 ✨',
            icon: { emoji: '🤖' },
            text: reply,
            image: null,
            timestamp: Date.now(),
            replyTo: null,
            reactions: {},
            edited: false,
            deleted: false,
            isClaude: true
          };
          if (room) {
            room.messages.push(claudeMessage);
            room.lastMessage = reply.slice(0, 40);
            if (room.messages.length > 500) room.messages.shift();
            saveRooms();
          }
          io.to(fullName).emit('new-message', claudeMessage);
        });
      }
    }

    // 봇 명령어 처리
    if (trimmedText.startsWith('/') && !isClaudeMention) {
      let botResponse = handleBotCommand(trimmedText, user);
      if (!botResponse) botResponse = handleGameCommand(trimmedText, user, fullName);

      if (botResponse) {
        setTimeout(() => {
          // 투표 생성
          if (botResponse.pollData) {
            activePolls.set(fullName, botResponse.pollData);
            const pollMessage = {
              id: `poll-${Date.now()}`,
              userId: 'bot',
              nickname: '📊 투표',
              icon: { emoji: '📊' },
              text: '',
              timestamp: Date.now(),
              replyTo: null,
              reactions: {},
              poll: botResponse.pollData,
              isBot: true
            };
            if (room) {
              room.messages.push(pollMessage);
              room.lastMessage = `📊 ${botResponse.pollData.question}`;
              if (room.messages.length > 500) room.messages.shift();
              saveRooms();
            }
            io.to(fullName).emit('new-message', pollMessage);
            return;
          }

          const botMessage = {
            id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            userId: 'bot',
            nickname: botResponse.text ? '✨ Imparter Bot' : '✨ Imparter Bot',
            icon: { emoji: '🤖' },
            text: botResponse.text || '',
            image: null,
            timestamp: Date.now(),
            replyTo: null,
            reactions: {},
            edited: false,
            deleted: false,
            isBot: true
          };
          if (room) {
            room.messages.push(botMessage);
            room.lastMessage = (botResponse.text || '').slice(0, 40);
            if (room.messages.length > 500) room.messages.shift();
            saveRooms();
          }
          io.to(fullName).emit('new-message', botMessage);

          // 게임 보상 XP
          if (botResponse.xp) {
            const leveledUp = addXP(user.nickname, botResponse.xp);
            saveProfiles();
            if (leveledUp) {
              const profile = getProfile(user.nickname);
              io.to(fullName).emit('system-message', {
                text: `🎉 ${user.nickname}님이 Lv.${profile.level}로 레벨업! ✨`,
                timestamp: Date.now()
              });
            }
          }
        }, 400);
      }
    }
  });

  socket.on('edit-message', ({ roomName, messageId, newText, mode }) => {
    const user = users.get(socket.id);
    if (!user || !newText?.trim()) return;
    const actualMode = mode || socket.data.mode || 'canva';
    const fullName = fullRoomKey(actualMode, roomName);
    const room = rooms.get(fullName);
    if (!room) return;
    const message = room.messages.find(m => m.id === messageId);
    if (!message || message.nickname !== user.nickname || message.deleted) return;

    // 🛡️ XSS 방어 + 길이 제한
    let cleaned = sanitizeText(newText.trim());
    if (cleaned.length > 2000) cleaned = cleaned.slice(0, 2000);
    message.text = cleaned;
    message.edited = true;
    saveRooms();
    io.to(fullName).emit('message-updated', message);
  });

  socket.on('delete-message', ({ roomName, messageId, mode }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const actualMode = mode || socket.data.mode || 'canva';
    const fullName = fullRoomKey(actualMode, roomName);
    const room = rooms.get(fullName);
    if (!room) return;
    const message = room.messages.find(m => m.id === messageId);
    if (!message || message.nickname !== user.nickname) return;

    message.deleted = true;
    message.text = '';
    message.image = null;
    saveRooms();
    io.to(fullName).emit('message-updated', message);
  });

  socket.on('typing', ({ roomName, isTyping, mode }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const actualMode = mode || socket.data.mode || 'canva';
    const fullName = fullRoomKey(actualMode, roomName);
    socket.to(fullName).emit('user-typing', {
      nickname: user.nickname,
      isTyping
    });
  });

  socket.on('react-message', ({ roomName, messageId, emoji, mode }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const actualMode = mode || socket.data.mode || 'canva';
    const fullName = fullRoomKey(actualMode, roomName);
    const room = rooms.get(fullName);
    if (!room) return;
    const message = room.messages.find(m => m.id === messageId);
    if (!message) return;

    if (!message.reactions) message.reactions = {};
    if (!message.reactions[emoji]) message.reactions[emoji] = [];

    const idx = message.reactions[emoji].indexOf(user.nickname);
    if (idx >= 0) {
      message.reactions[emoji].splice(idx, 1);
      if (message.reactions[emoji].length === 0) delete message.reactions[emoji];
    } else {
      message.reactions[emoji].push(user.nickname);
    }

    saveRooms();
    io.to(fullName).emit('message-reaction', {
      messageId,
      reactions: message.reactions
    });
  });

  socket.on('get-profile', ({ nickname }) => {
    const profile = getProfile(nickname || users.get(socket.id)?.nickname);
    if (profile) socket.emit('profile-data', profile);
  });

  socket.on('get-ranking', () => {
    const sorted = Array.from(profiles.values())
      .sort((a, b) => (b.level * 10000 + b.xp) - (a.level * 10000 + a.xp))
      .slice(0, 10)
      .map(p => ({ nickname: p.nickname, level: p.level, xp: p.xp }));
    socket.emit('ranking-data', sorted);
  });

  socket.on('vote-poll', ({ roomName, messageId, optionIdx, mode }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const actualMode = mode || socket.data.mode || 'canva';
    const fullName = fullRoomKey(actualMode, roomName);
    const room = rooms.get(fullName);
    if (!room) return;
    const msg = room.messages.find(m => m.id === messageId);
    if (!msg || !msg.poll) return;
    msg.poll.votes[user.nickname] = optionIdx;
    saveRooms();
    io.to(fullName).emit('message-updated', msg);
  });

  socket.on('set-room-password', ({ roomName, password, mode }) => {
    const user = users.get(socket.id);
    const actualMode = mode || socket.data.mode || 'canva';
    const fullName = fullRoomKey(actualMode, roomName);
    const room = rooms.get(fullName);
    if (!user || !room) return;
    if (!canManageRoom(user.nickname, room)) return;
    if (password) roomPasswords.set(fullName, password);
    else roomPasswords.delete(fullName);
    savePasswords();
    socket.emit('room-password-updated', { success: true });
  });

  socket.on('check-room-password', ({ roomName, password, mode }) => {
    const actualMode = mode || socket.data.mode || 'canva';
    const fullName = fullRoomKey(actualMode, roomName);
    const stored = roomPasswords.get(fullName);
    if (!stored) return socket.emit('room-password-check', { required: false, ok: true });
    socket.emit('room-password-check', {
      required: true,
      ok: password === stored
    });
  });

  socket.on('first-game-play', ({ gameId }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const profile = getProfile(user.nickname);
    const firstPlayKey = `firstPlay_${gameId}`;
    if (profile[firstPlayKey]) return;
    profile[firstPlayKey] = true;
    const leveledUp = addXP(user.nickname, 50);
    saveProfiles();
    socket.emit('game-reward', {
      gameId,
      xp: 50,
      level: profile.level,
      leveledUp
    });
  });

  // 카드 배틀 결과
  socket.on('card-battle-result', ({ result, xp }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const profile = getProfile(user.nickname);
    profile.gamesPlayed = (profile.gamesPlayed || 0) + 1;
    if (result === 'win') profile.gamesWon = (profile.gamesWon || 0) + 1;
    const safeXp = Math.max(0, Math.min(100, parseInt(xp) || 0));
    const leveledUp = addXP(user.nickname, safeXp);
    const newBadges = checkBadges(profile);
    saveProfiles();
    if (leveledUp) {
      socket.emit('unlock-celebration', { type: 'level', level: profile.level });
    }
    for (const badgeKey of newBadges) {
      const badge = BADGES[badgeKey];
      if (badge) {
        socket.emit('unlock-celebration', { type: 'badge', badgeKey, emoji: badge.emoji, name: badge.name });
      }
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    for (const [fullName, room] of rooms) {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        const mode = getRoomMode(fullName);
        const leaveMsg = mode === 'kotlc'
          ? `${user?.nickname}님이 빛의 다리를 건너 퇴장했습니다`
          : `${user?.nickname}님이 나갔습니다`;
        if (user) {
          socket.to(fullName).emit('system-message', {
            text: leaveMsg,
            timestamp: Date.now()
          });
        }
        io.to(fullName).emit('room-users', Array.from(room.users).map(id => users.get(id)).filter(Boolean));
      }
    }
    users.delete(socket.id);
    // 🛡️ 인증 상태/도배 카운터 정리
    verifiedAdmins.delete(socket.id);
    messageRateLimit.delete(socket.id);
  });
});

app.get('*', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile(join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Imparter 서버가 포트 ${PORT}에서 실행 중...`);
});
