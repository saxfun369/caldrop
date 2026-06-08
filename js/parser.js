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
  const m = str.match(/(\d{1,2})[時:](\d{0,2})/);
  if (!m) return null;
  return m[1].padStart(2, '0') + ':' + (m[2] || '00').padStart(2, '0');
}

/**
 * 解析した日付が7日以上前なら翌年に補正する
 * 例：6月に「1月5日」と入力した場合、来年1月5日と解釈する
 */
function adjustYear(dateStr, year) {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // (today - d) がミリ秒なので日数に変換
  if ((today - d) / (1000 * 60 * 60 * 24) > 7) {
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
  let title = '', location = null, allDay = false;
  let rest = line;

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
  if (!date) return null;

  // 時刻範囲（例: 10:00-15:00 / 15時〜17時）の検出
  const trM = rest.match(/(\d{1,2}(?:[時:：]\d{0,2})?)\s*[-〜~～ー]\s*(\d{1,2}(?:[時:：]\d{0,2})?)/);
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

  // 場所キーワードの検出（配列から部分一致を探す）
  const locKW = ['東京', '大阪', '京都', '名古屋', '福岡', '札幌', '横浜', '神戸', '沖縄', '仙台'];
  const parts = rest.split(/[\s　]+/);
  const li = parts.findIndex(p => locKW.some(k => p.includes(k)));
  if (li >= 0) location = parts.splice(li, 1)[0];

  title = parts.join(' ').trim() || '予定';

  // 過去日付は翌年に補正（年またぎ入力への対応）
  date    = adjustYear(date, year);
  endDate = adjustYear(endDate, year);

  return { title, date, endDate, startTime, endTime, location, allDay };
}
