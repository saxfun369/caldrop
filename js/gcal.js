/**
 * Google カレンダー連携モジュール
 * 予定オブジェクトを受け取り、登録用URLを返す。
 * 外部サービス固有のロジックをここに集約する。
 */

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
    const st = ev.startTime || '09:00';
    const h  = parseInt(st.split(':')[0]);
    const et = ev.endTime || (h + 1).toString().padStart(2, '0') + ':' + st.split(':')[1];
    const dateCompact = ev.date.replace(/-/g, '');
    const stCompact   = st.replace(':', '') + '00'; // "10:00" → "100000"
    const etCompact   = et.replace(':', '') + '00';
    dates = dateCompact + 'T' + stCompact + '/' + dateCompact + 'T' + etCompact;
  }

  let url = base
    + '&text='  + encodeURIComponent(ev.title)
    + '&dates=' + dates;

  if (ev.location)    url += '&location=' + encodeURIComponent(ev.location);
  if (ev.description) url += '&details='  + encodeURIComponent(ev.description);

  return url;
}
