/**
 * UI モジュール
 * 画面の描画・更新・操作を担当する。
 */

/**
 * 解析済み予定の一覧カードを画面に描画する
 */
function renderEvents() {
  const list = document.getElementById('eventsList');
  list.innerHTML = '<p class="section-label">'
    + parsedEvents.length + '件を解析しました — 確認してから登録してください</p>';

  const cards = document.createElement('div');
  cards.className = 'events-list';

  parsedEvents.forEach((ev, i) => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.id = 'card-' + i;

    const dateStr = ev.endDate ? ev.date + ' 〜 ' + ev.endDate : ev.date;
    const timeStr = ev.allDay
      ? '終日'
      : (ev.startTime ? ev.startTime + (ev.endTime ? ' – ' + ev.endTime : '') : '時間未定');
    const locStr = ev.location ? '<span>📍 ' + ev.location + '</span>' : '';

    card.innerHTML =
      '<input type="checkbox" class="event-check" id="chk-' + i + '" checked onchange="updateCount()">' +
      '<div class="event-info">' +
        '<p class="event-title">' + ev.title + '</p>' +
        '<p class="event-meta">' +
          '<span>📅 ' + dateStr + '</span>' +
          '<span>🕐 ' + timeStr + '</span>' +
          locStr +
        '</p>' +
      '</div>' +
      '<a href="' + makeGCalURL(ev) + '" target="_blank" class="add-btn" ' +
        'id="addbtn-' + i + '" onclick="markDone(' + i + ')">＋ 個別追加</a>';

    cards.appendChild(card);
  });

  list.appendChild(cards);
  document.getElementById('bulkSection').style.display = 'block';
  resetRegisterBtn();
  updateCount();
}

/**
 * カードの「追加済み」表示に切り替える
 */
function markDone(i) {
  setTimeout(() => {
    const b = document.getElementById('addbtn-' + i);
    if (b) {
      b.textContent = '✓ 追加済み';
      b.classList.add('done');
    }
  }, 400);
}

/**
 * チェックされている件数を更新する
 */
function updateCount() {
  const checked = document.querySelectorAll('.event-check:checked').length;
  document.getElementById('selectedCount').textContent =
    checked + ' / ' + parsedEvents.length + ' 件選択中';
}

/**
 * 成功・エラーメッセージを表示する。msg が空なら非表示にする
 */
function showResult(msg, type) {
  const el = document.getElementById('resultMsg');
  if (!msg) { el.style.display = 'none'; return; }
  el.className = 'result-msg ' + (type === 'ok' ? 'result-ok' : 'result-err');
  el.textContent = msg;
  el.style.display = 'block';
}

/**
 * 画面をすべてリセットする
 */
function clearAll() {
  document.getElementById('inputText').value = '';
  document.getElementById('eventsList').innerHTML = '';
  document.getElementById('bulkSection').style.display = 'none';
  showResult('', '');
  parsedEvents = [];
}
