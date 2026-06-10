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
  // 「14時半」→ 14:30（「半」は30分）。汎用パターンより先に判定する
  const hanM = str.match(/(\d{1,2})時半/);
  // 「10時30分」「10:30」など 時 or : を含む形式
  const m = str.match(/(\d{1,2})[時:](\d{0,2})/);
  if (hanM) {
    h  = parseInt(hanM[1], 10);
    mi = 30;
  } else if (m) {
    h  = parseInt(m[1], 10);
    mi = parseInt(m[2] || '0', 10);
  } else {
    // 「12」「9」など数字のみ（「12から15時」の「12」に対応）
    const n = str.match(/^(\d{1,2})$/);
    if (n) { h = parseInt(n[1], 10); mi = 0; }
  }
  if (h === null) return null;
  // 24〜29時は深夜表記（30時間制：26時=翌2時）として許容し、parseLine 側で日付に変換する。
  // 30時以降・分の60以上は実在しない時刻として弾く
  if (h > 29 || mi > 59) return null;
  return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
}

/**
 * ひらがな・全角数字の表記ゆれを正規化する（4がつ7にち → 4月7日）
 * 「数字の直後」のひらがな単位だけ変換するので、
 * タイトル中の通常のひらがな（「まじで」の「じ」など）には影響しない
 */
function normalizeKana(str) {
  // 全角数字 → 半角（４ → 4）。文字コードのオフセット分（0xFEE0）をずらすだけで変換できる
  str = str.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  return str
    .replace(/(\d)ねん/g, '$1年')
    .replace(/(\d)がつ/g, '$1月')
    .replace(/(\d)にち/g, '$1日')
    .replace(/(\d)じはん/g, '$1時半') // 「じはん」を先に処理しないと「じ」が先にマッチする
    .replace(/(\d)じ/g, '$1時')
    .replace(/(\d)ぷん/g, '$1分')
    .replace(/(\d)ふん/g, '$1分');
}

/**
 * 不正な日付のエラーメッセージを組み立てる
 */
function dateErrorMsg(month, day) {
  const mo = parseInt(month, 10);
  const d  = parseInt(day, 10);
  if (mo < 1 || mo > 12) return '「' + mo + '月」は存在しません';
  return '「' + mo + '月' + d + '日」は存在しません';
}

/**
 * "YYYY-MM-DD" に n 日を足す（月末・年末の繰り上がりは Date が処理する）
 */
function addDays(dateStr, n) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, mo - 1, d + n);
  return dt.getFullYear() + '-'
    + String(dt.getMonth() + 1).padStart(2, '0') + '-'
    + String(dt.getDate()).padStart(2, '0');
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
  // 2月30日・4月31日など暦に存在しない日付は、Date が翌月に繰り上げる性質を使って検出する
  const dt = new Date(parseInt(year, 10), mo - 1, d);
  if (dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
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
 * テキストの1行を解析する（詳細版）
 * 成功: { event: {...} } / 失敗: { error: '理由' } を返す。
 * 失敗理由は画面の警告リストにそのまま表示される。
 */
function parseLineDetailed(line, year) {
  // 表記ゆれ（ひらがな・全角数字）を先に正規化してから解析する
  line = normalizeKana(line.trim());
  if (!line) return { error: '空行です' };

  let date = null, endDate = null, startTime = null, endTime = null;
  let title = '', location = null, description = null, allDay = false;
  let rest = line;
  let hasExplicitYear = false; // 年が明示されていたら adjustYear をスキップする
  let dateErr = null;          // 日付の具体的なエラー理由（「4月31日は存在しません」など）

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
      if (!date) dateErr = dateErrorMsg(yearSlashM[2], yearSlashM[3]);
      rest = rest.replace(yearSlashM[0], '').trim();
      hasExplicitYear = true;
    } else if (yearKanjiM) {
      date = buildDate(yearKanjiM[1], yearKanjiM[2], yearKanjiM[3]);
      if (!date) dateErr = dateErrorMsg(yearKanjiM[2], yearKanjiM[3]);
      rest = rest.replace(yearKanjiM[0], '').trim();
      hasExplicitYear = true;
    } else {
      // 日付範囲（例: 4/25-27）の検出
      const rangeDateM = rest.match(/(\d{1,2})[\/\-](\d{1,2})\s*[\-〜~～]\s*(\d{1,2})/);
      if (rangeDateM) {
        date    = buildDate(year, rangeDateM[1], rangeDateM[2]);
        endDate = buildDate(year, rangeDateM[1], rangeDateM[3]);
        if (!date)         dateErr = dateErrorMsg(rangeDateM[1], rangeDateM[2]);
        else if (!endDate) { dateErr = dateErrorMsg(rangeDateM[1], rangeDateM[3]); date = null; }
        rest = rest.replace(rangeDateM[0], '').trim();
        allDay = true;
      } else {
        // 単一日付の検出
        for (const pat of [/(\d{1,2})月(\d{1,2})日?/, /(\d{1,2})[\/](\d{1,2})/]) {
          const dm = rest.match(pat);
          if (dm) {
            date = parseDate(dm[0], year);
            if (!date) dateErr = dateErrorMsg(dm[1], dm[2]);
            rest = rest.replace(dm[0], '').trim();
            break;
          }
        }
      }
    }
  }
  if (!date) return { error: dateErr || '日付が見つかりません（例: 8/1、8月1日、明日）' };

  // 時刻範囲（例: 10:00-15:00 / 15時〜17時 / 12から15時 / 17 21）の検出
  // 区切り: ハイフン系・波ダッシュ系・から・空白（半角・全角）
  // ① 開始側に「時」かコロンを含む形式。「夕食18時〜20時」のように
  //    単語に続けて書かれても拾えるよう、直前の文字は問わない
  //    「時」の後ろは 半（=30分）または数字（14時半 / 14時30 / 14時）
  const trM = rest.match(/(\d{1,2}(?:時(?:半|\d{0,2})|[:：]\d{0,2}))\s*(?:[-〜~～ー]|から|[ 　])\s*(\d{1,2}(?:時(?:半|\d{0,2})|[:：]\d{0,2})?)/);
  if (trM) {
    startTime = toHHMM(trM[1]);
    endTime   = toHHMM(trM[2]);
    // 「時」やコロン付きで明示された時刻が範囲外（30時・10:75 など）→ 誤記として行ごとエラー
    if (!startTime || !endTime) {
      const bad = !startTime ? trM[1] : trM[2];
      return { error: '「' + bad + '」を時刻として認識できません（深夜表記は29時まで）' };
    }
    rest = rest.replace(trM[0], '').trim();
  } else {
    // ② 開始側が数字のみの形式（例: 17 21 / 12から15時）
    //    「会議室5 13時」の 5 を時刻と誤解釈しないよう、直前が行頭か空白の場合だけ許可する
    const bareM = rest.match(/(^|[\s　])(\d{1,2})\s*(?:[-〜~～ー]|から|[ 　])\s*(\d{1,2}(?:時(?:半|\d{0,2})|[:：]\d{0,2})?)/);
    if (bareM) {
      const s0 = toHHMM(bareM[2]);
      const e0 = toHHMM(bareM[3]);
      // 数字だけの組は、両方が時刻として妥当な場合のみ時刻範囲として扱う
      //（「30 40」のような数字はタイトルの一部としてそのまま残す）
      if (s0 && e0) {
        startTime = s0;
        endTime   = e0;
        rest = rest.replace(bareM[0], bareM[1]).trim();
      }
    }
    if (!startTime) {
      // 開始時刻のみの検出
      // 「16時」（分なし）「14時半」も拾えるよう 時 は 半|\d{0,2}、コロンは \d{2} を維持
      const stM = rest.match(/\d{1,2}時(?:半|\d{0,2})|\d{1,2}[：:]\d{2}/);
      if (stM) {
        startTime = toHHMM(stM[0]);
        if (!startTime) { // 「30時」など範囲外の明示時刻 → 誤記
          return { error: '「' + stM[0] + '」を時刻として認識できません（深夜表記は29時まで）' };
        }
        rest = rest.replace(stM[0], '').trim();
      }
    }
  }
  if (!startTime) allDay = true;

  // --- 深夜表記・日またぎの正規化 ---
  // ・24〜29時（30時間制）は翌日の 0〜5時に変換する（例: 26時 → 翌2時）
  // ・終了が開始以前でも、終了が深夜帯（0:00〜5:59）なら翌日とみなす（例: 22時から2時）
  //   それ以外（17時から15時 など）は誤記として行ごとエラー
  // 日付のずらし量だけここで計算し、年補正が終わった後（関数末尾）で適用する
  let dayShiftStart = 0; // 開始日のずらし日数（25時開始 → +1日）
  let overnightEnd  = 0; // 終了が開始の何日後か（13時〜翌0時 → 1）
  if (startTime) {
    // "HH:MM" ⇄ 0時からの通算分。数値にすると大小比較と日数計算が単純になる
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const fmt   = (min) => String(Math.floor(min / 60) % 24).padStart(2, '0')
                         + ':' + String(min % 60).padStart(2, '0');
    let s = toMin(startTime);
    let e = endTime !== null ? toMin(endTime) : null;

    if (e !== null && e <= s) {
      if (e < 6 * 60) {
        e += 24 * 60; // 深夜帯への日またぎとみなす
      } else {
        return { error: '終了時刻（' + endTime + '）が開始時刻（' + startTime + '）より前です' };
      }
    }
    dayShiftStart = Math.floor(s / (24 * 60));
    if (e !== null) overnightEnd = Math.floor(e / (24 * 60)) - dayShiftStart;
    startTime = fmt(s);
    if (e !== null) endTime = fmt(e);
  }

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
  const colonLocM = rest.match(new RegExp('(?:' + locKeywords + ')[：:]([^\\s　@＠（(]+)'));
  if (colonLocM) {
    location = colonLocM[1];
    rest = rest.replace(colonLocM[0], '').trim();
  }

  // @場所名 の検出（@以降の空白なしひとかたまりを場所として扱う）
  // 半角 @ と全角 ＠ の両方に対応する
  if (!location) {
    const atLocM = rest.match(/[@＠]([^\s　@＠（(]+)/);
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

  // 深夜表記・日またぎによる日付のずらしは、年補正が終わってから適用する
  // （先にずらすと「開始日は過去・終了日は今日」のように補正がちぐはぐになるため）
  if (dayShiftStart > 0) date    = addDays(date, dayShiftStart);
  if (overnightEnd  > 0) endDate = addDays(date, overnightEnd);

  return { event: { title, date, endDate, startTime, endTime, location, description, allDay } };
}

/**
 * テキストの1行を解析して予定オブジェクトに変換する（互換ラッパー）
 * Python の dict に相当するオブジェクトを返す。解析できなければ null。
 */
function parseLine(line, year) {
  return parseLineDetailed(line, year).event || null;
}

// Node.js のテスト（node --test）から require できるようにする。
// ブラウザには module が存在しないため、この if はブラウザでは実行されない。
// Python でいう if __name__ == "__main__": と似た「実行環境による分岐」
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toHHMM, adjustYear, buildDate, parseDate, parseLine, parseLineDetailed, normalizeKana };
}
