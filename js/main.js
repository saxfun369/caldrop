/**
 * エントリーポイント
 * アプリ全体で共有するデータと、各処理を束ねる関数を置く。
 * Python の if __name__ == "__main__": ブロックに相当。
 */

// アプリ全体で共有する予定データ（Python のグローバル変数に相当）
let parsedEvents  = [];
// 表示順を管理するインデックス配列（例: [0,2,1] = 0番・2番・1番の順で表示）
// parsedEvents 自体は並び替えず、こちらだけ変える
let displayOrder  = [];

/**
 * テキストエリアの内容を解析してカード一覧を表示する
 */
function parseEvents() {
  const text = document.getElementById('inputText').value.trim();
  if (!text) {
    showResult('予定を入力してください。', 'err');
    return;
  }

  const year = new Date().getFullYear().toString();
  const nonEmpty = text.split(/\n/).filter(l => l.trim());
  const results  = nonEmpty.map(l => ({ line: l, event: parseLine(l, year) }));

  parsedEvents  = results.filter(r => r.event).map(r => r.event);
  displayOrder  = parsedEvents.map((_, i) => i);

  if (!parsedEvents.length) {
    showResult('予定を認識できませんでした。書き方を確認してください。', 'err');
    return;
  }

  const failedLines = results.filter(r => !r.event).map(r => r.line);
  if (failedLines.length > 0) {
    const items = failedLines.map(l => `<li>${escHtml(l)}</li>`).join('');
    showResult(
      `${failedLines.length}行を認識できませんでした。認識できた予定のみ表示しています。`
      + `<ul style="margin-top:6px;padding-left:1.4em;opacity:0.85">${items}</ul>`,
      'warn', true
    );
  } else {
    showResult('', '');
  }

  renderEvents();
}

function addNewEvent() {
  const today = new Date();
  const dateStr = today.getFullYear() + '-'
    + String(today.getMonth() + 1).padStart(2, '0') + '-'
    + String(today.getDate()).padStart(2, '0');

  parsedEvents.push({
    title: '', date: dateStr, endDate: null,
    startTime: null, endTime: null,
    location: null, description: null, allDay: true,
  });

  const i = parsedEvents.length - 1;
  displayOrder.push(i);

  const cardsList = document.getElementById('cardsList');
  const card = document.createElement('div');
  card.id = 'card-' + i;
  cardsList.appendChild(card);

  renderCard(i, true);  // チェックボックスを含む初期描画が必要
  editEvent(i);
  updateCount();
}

// ===== デバッグ用：後で削除 =====
function fillDebugText() {
  document.getElementById('inputText').value = [
    // 日付形式（スラッシュ vs 漢字）
    '8/1 10:00-11:00 スラッシュ日付・コロン時刻',
    '8月2日 10:00-15:00 漢字日付・コロン時刻',
    '',
    // 時刻区切り文字
    '8/3 15時ー17時 長音符区切り',
    '8月4日 11:00〜14:00 波ダッシュ区切り',
    '8/5 10:00~12:00 半角チルダ',
    '8月6日 10:00～12:00 全角チルダ',
    '8月7日 10：00-12：00 全角コロン',
    '8月8日 12から15時 から区切り',
    '8月9日 10時　15時 全角スペース区切り',
    '8月15日 10:00 15:00 半角スペース区切り',
    '',
    // 開始時刻のみ（終了時刻なし）
    '8月8日 10:00 開始時刻のみ・コロン',
    '8月9日 14時 開始時刻のみ・漢字',
    '',
    // 終日イベント（時刻なし）
    '8月10日 休み',
    '8/11 祝日',
    '8月12日 誕生日パーティー',
    '',
    // 日付範囲（複数日）
    '8/20-22 夏休み旅行',
    '8/23-25 帰省 東京',
    '',
    // 場所キーワード（都市名）
    '8月26日 10:00-12:00 打ち合わせ 東京',
    '9月1日 13:00-15:00 会議 大阪',
    // @場所名 形式
    '9月10日 10:00-11:00 ミーティング @会議室A',
    '9月15日 14:00-15:00 ランチ @渋谷カフェ',
    // 場所：/ 会場：/ 住所：/ 集合：/ 開催地：形式（コロン必須で誤検出を防ぐ）
    '9月20日 10:00-12:00 打ち合わせ 場所：新宿オフィス',
    '10月10日 12:00-21:00 結婚式 会場：ホテルグランドパレス',
    '10月15日 09:00 ハイキング 集合：渋谷駅ハチ公前',
    // 説明あり
    '10月3日 09:00-17:00 研修 @福岡オフィス （持ち物：PC・名刺）',
    '11月20日 10:00-17:00 視察 京都 （事前にレポート提出）',
    '',
    // 相対日付（過去）
    '一昨昨日 終日 3日前',
    '一昨日 14:00 一昨日',
    '昨日 10:00-11:00 昨日の会議',
    // 相対日付（今日・未来）
    '今日 15:00 歯医者',
    '本日 13:00 ほんじつ',
    '明日 10:00-11:00 打ち合わせ @渋谷',
    '明後日 終日 有給',
    '明々後日 10:00 しあさって',
    '',
    // 年またぎ・過去日付の補正確認
    '1/15 10:00-11:00 年なし→来年になるはず',
    '4/5 14:00 年なし過去→来年になるはず',
    '2025/4/5 14:00 年明示→2025年のまま',
    '2025年4月6日 10:00-12:00 漢字年明示→2025年のまま',
  ].join('\n');
}
