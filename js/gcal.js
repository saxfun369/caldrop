/**
 * Google カレンダー連携モジュール
 * 予定オブジェクトを受け取り、登録用URLを返す。
 * 外部サービス固有のロジックをここに集約する。
 */

/**
 * 終了時刻が未指定のとき「開始の1時間後」を計算する
 * 23時台に開始する場合は日をまたぐため、終了日を翌日に繰り上げる
 * （繰り上げないと「24:30」のような不正な時刻になり登録に失敗する）
 * 戻り値: { date: 'YYYY-MM-DD', time: 'HH:MM' }
 */
function defaultEnd(dateStr, startTime) {
  const [h, mi] = startTime.split(':').map(Number);
  if (h >= 23) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const next = new Date(y, mo - 1, d + 1); // 日付の繰り上がりは Date が自動処理する
    return {
      date: next.getFullYear() + '-'
        + String(next.getMonth() + 1).padStart(2, '0') + '-'
        + String(next.getDate()).padStart(2, '0'),
      time: '00:' + String(mi).padStart(2, '0'),
    };
  }
  return {
    date: dateStr,
    time: String(h + 1).padStart(2, '0') + ':' + String(mi).padStart(2, '0'),
  };
}

/**
 * 予定オブジェクトから Google カレンダー登録用URLを生成する
 */
function makeGCalURL(ev) {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  let dates;

  if (ev.allDay) {
    // 終日イベント：YYYYMMDD/YYYYMMDD 形式で渡す
    // Google カレンダーの仕様で終了日は「翌日」を指定する必要がある
    const s = ev.date.replace(/-/g, '');
    // new Date("YYYY-MM-DD") はUTC基準になるため、タイムゾーンの影響を受けない
    // ローカルタイムのコンストラクタ new Date(y, m-1, d) を使って+1日する
    const [ey, em, ed] = (ev.endDate || ev.date).split('-').map(Number);
    const next = new Date(ey, em - 1, ed + 1);
    const e = String(next.getFullYear())
      + String(next.getMonth() + 1).padStart(2, '0')
      + String(next.getDate()).padStart(2, '0');
    dates = s + '/' + e;
  } else {
    // 時刻あり：YYYYMMDDTHHmmss/YYYYMMDDTHHmmss 形式で渡す
    // ダッシュ・コロンを含む形式は Google カレンダーが誤解析するため除去する
    const st  = ev.startTime || '09:00';
    const end = ev.endTime
      ? { date: ev.endDate || ev.date, time: ev.endTime } // endDate があれば日またぎ
      : defaultEnd(ev.date, st); // 終了未指定→1時間後（23時台は翌日へ繰り上げ）
    const sCompact = ev.date.replace(/-/g, '')   + 'T' + st.replace(':', '')       + '00';
    const eCompact = end.date.replace(/-/g, '')  + 'T' + end.time.replace(':', '') + '00';
    dates = sCompact + '/' + eCompact;
  }

  let url = base
    + '&text='  + encodeURIComponent(ev.title)
    + '&dates=' + dates;

  if (ev.location)    url += '&location=' + encodeURIComponent(ev.location);
  if (ev.description) url += '&details='  + encodeURIComponent(ev.description);

  return url;
}

// Node.js のテスト（node --test）から require できるようにする（parser.js と同じ仕組み）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { defaultEnd, makeGCalURL };
}
