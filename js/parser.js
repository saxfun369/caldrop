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
  let h = null, mi = null;
  // 「10時30分」「10:30」など 時 or : を含む形式
  const m = str.match(/(\d{1,2})[時:](\d{0,2})/);
  if (m) {
    h  = parseInt(m[1], 10);
    mi = parseInt(m[2] || '0', 10);
  } else {
    // 「12」「9」など数字のみ（「12から15時」の「12」に対応）
    const n = str.match(/^(\d{1,2})$/);
    if (n) { h = parseInt(n[1], 10); mi = 0; }
  }
  if (h === null) return null;
  // 「25時」「10:75」など実在しない時刻は弾く
  if (h > 23 || mi > 59) return null;
  return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
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
 * 年・月・日の文字列から "YYYY-MM-DD" を組み立てる
 * 13月・45日など実在しない値は null を返す（その行は解析失敗として扱う）
 */
function buildDate(year, month, day) {
  const mo = parseInt(month, 10);
  const d  = parseInt(day, 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return year + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

/**
 * "4/20" "4月20日" などの文字列を "2026-04-20" 形式に変換する
 */
function parseDate(str, year) {
  str = str.trim();
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})/) || str.match(/(\d{1,2})月(\d{1,2})日?/);
  if (m) return buildDate(year, m[1], m[2]);
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

  // 相対日付の検出
  // 一昨昨日・一昨日など長い表現を先に書かないと、短い方が先にマッチしてしまう
  const relMap = {
    '今日': 0,  'きょう': 0,  '本日': 0,  'ほんじつ': 0,
    '明日': 1,  'あした': 1,  'あす': 1,  'みょうにち': 1,
    '明後日': 2, 'あさって': 2, 'みょうごにち': 2,
    '明々後日': 3, 'しあさって': 3,
    '昨日': -1, 'きのう': -1, 'さくじつ': -1,
    '一昨昨日': -3, 'さきおととい': -3,
    '一昨日': -2, 'おととい': -2, 'いっさくじつ': -2,
  };
  // 行頭または空白の直後でのみマッチさせる（絶対日付と同様に行の途中でも認識する）
  // 「明日(?!香)」は否定先読み：「明日香村」の「明日」を相対日付と誤認しないためのガード
  const relM = rest.match(/(^|[\s　])(一昨昨日|さきおととい|一昨日|おととい|いっさくじつ|昨日|きのう|さくじつ|明々後日|しあさって|明後日|みょうごにち|あさって|明日(?!香)|みょうにち|あした|あす|本日|ほんじつ|今日|きょう)/);
  if (relM) {
    const d = new Date();
    d.setDate(d.getDate() + relMap[relM[2]]);
    date = d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
    // relM[1]（直前の空白 or 空文字）は残して相対日付の単語だけ取り除く
    rest = rest.replace(relM[0], relM[1]).trim();
  }

  if (!date) {
    // 年付き日付の検出（例: 2025/4/6 / 2025年4月6日）→ adjustYear をスキップ
    const yearSlashM = rest.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    const yearKanjiM = rest.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);

    if (yearSlashM) {
      date = buildDate(yearSlashM[1], yearSlashM[2], yearSlashM[3]);
      rest = rest.replace(yearSlashM[0], '').trim();
      hasExplicitYear = true;
    } else if (yearKanjiM) {
      date = buildDate(yearKanjiM[1], yearKanjiM[2], yearKanjiM[3]);
      rest = rest.replace(yearKanjiM[0], '').trim();
      hasExplicitYear = true;
    } else {
      // 日付範囲（例: 4/25-27）の検出
      const rangeDateM = rest.match(/(\d{1,2})[\/\-](\d{1,2})\s*[\-〜~～]\s*(\d{1,2})/);
      if (rangeDateM) {
        date    = buildDate(year, rangeDateM[1], rangeDateM[2]);
        endDate = buildDate(year, rangeDateM[1], rangeDateM[3]);
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

  // 時刻範囲（例: 10:00-15:00 / 15時〜17時 / 12から15時 / 17 21）の検出
  // 区切り: ハイフン系・波ダッシュ系・から・空白（半角・全角）
  // ① 開始側に「時」かコロンを含む形式。「夕食18時〜20時」のように
  //    単語に続けて書かれても拾えるよう、直前の文字は問わない
  let trM = rest.match(/(\d{1,2}[時:：]\d{0,2})\s*(?:[-〜~～ー]|から|[ 　])\s*(\d{1,2}(?:[時:：]\d{0,2})?)/);
  let trPrefix = '';
  if (!trM) {
    // ② 開始側が数字のみの形式（例: 17 21 / 12から15時）
    //    「会議室5 13時」の 5 を時刻と誤解釈しないよう、直前が行頭か空白の場合だけ許可する
    const bareM = rest.match(/(^|[\s　])(\d{1,2})\s*(?:[-〜~～ー]|から|[ 　])\s*(\d{1,2}(?:[時:：]\d{0,2})?)/);
    if (bareM) {
      // ①と同じ形（[全体, 開始, 終了]）に組み替える。先頭の空白は replace 時に残す
      trM = [bareM[0], bareM[2], bareM[3]];
      trPrefix = bareM[1];
    }
  }
  if (trM) {
    startTime = toHHMM(trM[1]);
    endTime   = toHHMM(trM[2]);
    rest = rest.replace(trM[0], trPrefix).trim();
  } else {
    // 開始時刻のみの検出
    // 「16時」（分なし）も拾えるよう 時 は \d{0,2}、コロンは \d{2} を維持
    const stM = rest.match(/\d{1,2}時\d{0,2}|\d{1,2}[：:]\d{2}/);
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
    const parts = rest.split(/[\s　]+/).filter(p => p);
    const li = parts.findIndex(p => locKW.some(k => p.includes(k)));
    // 場所として抜き出すのは、タイトルになる単語が他に残る場合だけ。
    // 「東京出張」1語だけの行では「出張」がタイトルの一部なので場所扱いしない
    if (li >= 0 && parts.length >= 2) location = parts.splice(li, 1)[0];
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

// Node.js のテスト（node --test）から require できるようにする。
// ブラウザには module が存在しないため、この if はブラウザでは実行されない。
// Python でいう if __name__ == "__main__": と似た「実行環境による分岐」
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toHHMM, adjustYear, buildDate, parseDate, parseLine };
}
