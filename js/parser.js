/**
 * テキスト解析モジュール
 * DOM（画面）には一切触れない純粋な変換関数のみ置く。
 * Python でいう「引数を受け取って値を返すだけの関数」。
 */

/**
 * "10時30分" "10:30" などの文字列を "10:30" 形式に統一する
 */
function toHHMM(str) {
  if (!str) return null;
  str = str.replace(/：/g, ':').trim();
  // 「10時30分」「10:30」など 時 or : を含む形式
  const m = str.match(/(\d{1,2})[時:](\d{0,2})/);
  if (m) return m[1].padStart(2, '0') + ':' + (m[2] || '00').padStart(2, '0');
  // 「12」「9」など数字のみ（「12から15時」の「12」に対応）
  const n = str.match(/^(\d{1,2})$/);
  if (n) return n[1].padStart(2, '0') + ':00';
  return null;
}

/**
 * 解析した日付が昨日以前なら翌年に補正する
 * 例：6月に「1月5日」と入力した場合、来年1月5日と解釈する
 * 年を明示した場合（hasExplicitYear）はこの関数を呼ばない
 */
function adjustYear(dateStr, year) {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 昨日以前（1日以上過去）は翌年に補正。今日・未来はそのまま。
  if ((today - d) / (1000 * 60 * 60 * 24) >= 1) {
    return (parseInt(year) + 1) + dateStr.slice(4);
  }
  return dateStr;
}

/**
 * "4/20" "4月20日" などの文字列を "2026-04-20" 形式に変換する
 */
function parseDate(str, year) {
  str = str.trim();
  let m = str.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (m) return year + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
  m = str.match(/(\d{1,2})月(\d{1,2})日?/);
  if (m) return year + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
  return null;
}

/**
 * テキストの1行を解析して予定オブジェクトに変換する
 * Python の dict に相当するオブジェクトを返す。解析できなければ null。
 */
function parseLine(line, year) {
  line = line.trim();
  if (!line) return null;

  let date = null, endDate = null, startTime = null, endTime = null;
  let title = '', location = null, description = null, allDay = false;
  let rest = line;
  let hasExplicitYear = false; // 年が明示されていたら adjustYear をスキップする

  // 相対日付の検出（今日・明日・明後日）
  const relMap = { '今日': 0, 'きょう': 0, '明日': 1, 'あした': 1, 'あす': 1, '明後日': 2, 'あさって': 2 };
  const relM = rest.match(/^(今日|きょう|明日|あした|あす|明後日|あさって)/);
  if (relM) {
    const d = new Date();
    d.setDate(d.getDate() + relMap[relM[1]]);
    date = d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
    rest = rest.replace(relM[0], '').trim();
  }

  if (!date) {
    // 年付き日付の検出（例: 2025/4/6 / 2025年4月6日）→ adjustYear をスキップ
    const yearSlashM = rest.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    const yearKanjiM = rest.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);

    if (yearSlashM) {
      date = yearSlashM[1] + '-' + yearSlashM[2].padStart(2, '0') + '-' + yearSlashM[3].padStart(2, '0');
      rest = rest.replace(yearSlashM[0], '').trim();
      hasExplicitYear = true;
    } else if (yearKanjiM) {
      date = yearKanjiM[1] + '-' + yearKanjiM[2].padStart(2, '0') + '-' + yearKanjiM[3].padStart(2, '0');
      rest = rest.replace(yearKanjiM[0], '').trim();
      hasExplicitYear = true;
    } else {
      // 日付範囲（例: 4/25-27）の検出
      const rangeDateM = rest.match(/(\d{1,2})[\/\-](\d{1,2})\s*[\-〜~～]\s*(\d{1,2})/);
      if (rangeDateM) {
        const mo = rangeDateM[1].padStart(2, '0');
        date    = year + '-' + mo + '-' + rangeDateM[2].padStart(2, '0');
        endDate = year + '-' + mo + '-' + rangeDateM[3].padStart(2, '0');
        rest = rest.replace(rangeDateM[0], '').trim();
        allDay = true;
      } else {
        // 単一日付の検出
        for (const pat of [/(\d{1,2})月(\d{1,2})日?/, /(\d{1,2})[\/](\d{1,2})/]) {
          const dm = rest.match(pat);
          if (dm) {
            date = parseDate(dm[0], year);
            rest = rest.replace(dm[0], '').trim();
            break;
          }
        }
      }
    }
  }
  if (!date) return null;

  // 時刻範囲（例: 10:00-15:00 / 15時〜17時 / 12から15時 / 10時 15時）の検出
  // 区切り: ハイフン系・波ダッシュ系・から・空白（半角・全角）
  const trM = rest.match(/(\d{1,2}(?:[時:：]\d{0,2})?)\s*(?:[-〜~～ー]|から|[ 　])\s*(\d{1,2}(?:[時:：]\d{0,2})?)/);
  if (trM) {
    startTime = toHHMM(trM[1]);
    endTime   = toHHMM(trM[2]);
    rest = rest.replace(trM[0], '').trim();
  } else {
    // 開始時刻のみの検出
    const stM = rest.match(/\d{1,2}[時:：]\d{2}/);
    if (stM) {
      startTime = toHHMM(stM[0]);
      rest = rest.replace(stM[0], '').trim();
    }
  }
  if (!startTime) allDay = true;

  // 余分な区切り文字を除去
  rest = rest.replace(/^[\s　\-　]+/, '').replace(/[\s　\-　]+$/, '');

  // 説明の検出：（説明文）または (説明文) → description に取り出す
  const descM = rest.match(/[（(]([^）)]+)[）)]/);
  if (descM) {
    description = descM[1].trim();
    rest = rest.replace(descM[0], '').trim();
  }

  // 「場所：」「会場：」などのキーワード＋コロンで場所を検出
  // コロン必須にすることで「春場所」「会場入り」などの誤検出を防ぐ
  const locKeywords = '場所|会場|住所|集合|開催地';
  const colonLocM = rest.match(new RegExp('(?:' + locKeywords + ')[：:]([^\\s　@（(]+)'));
  if (colonLocM) {
    location = colonLocM[1];
    rest = rest.replace(colonLocM[0], '').trim();
  }

  // @場所名 の検出（@以降の空白なしひとかたまりを場所として扱う）
  if (!location) {
    const atLocM = rest.match(/@([^\s　@（(]+)/);
    if (atLocM) {
      location = atLocM[1];
      rest = rest.replace(atLocM[0], '').trim();
    }
  }

  // 都市キーワードによる場所検出（@指定がない場合のフォールバック）
  if (!location) {
    const locKW = ['東京', '大阪', '京都', '名古屋', '福岡', '札幌', '横浜', '神戸', '沖縄', '仙台'];
    const parts = rest.split(/[\s　]+/);
    const li = parts.findIndex(p => locKW.some(k => p.includes(k)));
    if (li >= 0) location = parts.splice(li, 1)[0];
    rest = parts.join(' ');
  }

  title = rest.trim() || '予定';

  // 過去日付は翌年に補正。ただし相対日付・年明示の場合はスキップ。
  if (!relM && !hasExplicitYear) {
    date    = adjustYear(date, year);
    endDate = adjustYear(endDate, year);
  }

  return { title, date, endDate, startTime, endTime, location, description, allDay };
}
