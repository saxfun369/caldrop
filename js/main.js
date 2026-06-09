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

