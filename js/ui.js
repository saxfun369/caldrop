/**
 * UI モジュール
 * 画面の描画・更新・操作を担当する。
 */

/**
 * HTML 特殊文字をエスケープする（XSS対策）
 * ユーザー入力をそのまま innerHTML に埋め込むと
 * <script> などが実行されてしまうため必ずこれを通す
 */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}

/**
 * 1枚のカードを「表示モード」で描画する
 * i        : parsedEvents のインデックス
 * checked  : チェックボックスの状態（編集前の状態を引き継ぐ）
 */
function renderCard(i, checked = true) {
  const card = document.getElementById('card-' + i);
  if (!card) return;
  const ev = parsedEvents[i];

  const dateStr = ev.endDate ? ev.date + ' 〜 ' + ev.endDate : ev.date;
  const timeStr = ev.allDay
    ? '終日'
    : (ev.startTime ? ev.startTime + (ev.endTime ? ' – ' + ev.endTime : '') : '時間未定');
  const locStr  = ev.location    ? '<span>📍 ' + escHtml(ev.location)    + '</span>' : '';
  const descStr = ev.description ? '<span>📝 ' + escHtml(ev.description) + '</span>' : '';

  card.className = 'event-card';
  card.innerHTML =
    '<input type="checkbox" class="event-check" id="chk-' + i + '" '
      + (checked ? 'checked' : '') + ' onchange="updateCount()">' +
    '<div class="event-info">' +
      '<p class="event-title">' + escHtml(ev.title) + '</p>' +
      '<p class="event-meta">' +
        '<span>📅 ' + dateStr + '</span>' +
        '<span>🕐 ' + timeStr + '</span>' +
        locStr + descStr +
      '</p>' +
    '</div>' +
    '<div class="card-actions">' +
      '<button class="edit-btn" onclick="editEvent(' + i + ')">編集</button>' +
      '<a href="' + makeGCalURL(ev) + '" target="_blank" class="add-btn"'
        + ' id="addbtn-' + i + '" onclick="markDone(' + i + ')">＋ 個別追加</a>' +
    '</div>';
}

/**
 * 解析済み予定の一覧カードを画面に描画する
 */
function renderEvents() {
  const list = document.getElementById('eventsList');

  // ヘッダー（件数ラベル + ソートトグル）
  list.innerHTML =
    '<div class="events-header">' +
      '<p class="section-label">' + parsedEvents.length + '件を解析しました — 確認してから登録してください</p>' +
      '<div class="sort-toggle">' +
        '<button class="sort-btn sort-active" id="sortBtnInput" onclick="setSortOrder(false)">入力順</button>' +
        '<button class="sort-btn" id="sortBtnDate"  onclick="setSortOrder(true)">日付順</button>' +
      '</div>' +
    '</div>';

  const cards = document.createElement('div');
  cards.className = 'events-list';
  cards.id = 'cardsList';

  displayOrder.forEach(i => {
    const card = document.createElement('div');
    card.id = 'card-' + i;
    cards.appendChild(card);
  });

  list.appendChild(cards);
  displayOrder.forEach(i => renderCard(i, true));

  document.getElementById('bulkSection').style.display = 'block';
  resetRegisterBtn();
  updateCount();
}

/**
 * ソート順を切り替えてカード一覧を再描画する
 * sortByDate: true = 日付順 / false = 入力順
 */
function setSortOrder(sortByDate) {
  // 現在のチェック状態を保存（ソート前のインデックスで保持）
  const checkedState = parsedEvents.map((_, i) => {
    const chk = document.getElementById('chk-' + i);
    return chk ? chk.checked : true;
  });

  // displayOrder を更新
  displayOrder = parsedEvents.map((_, i) => i);
  if (sortByDate) {
    displayOrder.sort((a, b) =>
      (parsedEvents[a].date || '').localeCompare(parsedEvents[b].date || '')
    );
  }

  // ボタンのアクティブ状態を切り替え
  document.getElementById('sortBtnInput').classList.toggle('sort-active', !sortByDate);
  document.getElementById('sortBtnDate').classList.toggle('sort-active',  sortByDate);

  // カードリストだけ再構築（ヘッダーはそのまま）
  const cardsList = document.getElementById('cardsList');
  if (!cardsList) return;
  cardsList.innerHTML = '';
  displayOrder.forEach(i => {
    const card = document.createElement('div');
    card.id = 'card-' + i;
    cardsList.appendChild(card);
  });
  displayOrder.forEach(i => renderCard(i, checkedState[i]));
  updateCount();
}

/**
 * カードを「編集モード」に切り替える
 */
function editEvent(i) {
  const checked = document.getElementById('chk-' + i).checked;
  const ev = parsedEvents[i];
  const card = document.getElementById('card-' + i);
  card.className = 'event-card editing';

  // 終日の場合は時刻入力を最初から非表示にする
  const timeHidden = ev.allDay ? 'style="display:none"' : '';

  card.innerHTML =
    '<input type="checkbox" class="event-check" id="chk-' + i + '" '
      + (checked ? 'checked' : '') + ' onchange="updateCount()">' +
    '<div class="event-edit-form">' +
      '<div class="edit-row">' +
        '<label class="edit-label">タイトル</label>' +
        '<input type="text" class="edit-input" id="et-' + i + '"'
          + ' value="' + escHtml(ev.title) + '">' +
      '</div>' +
      '<div class="edit-row">' +
        '<label class="edit-label">日付</label>' +
        '<input type="date" class="edit-input-sm" id="ed-' + i + '"'
          + ' value="' + (ev.date || '') + '">' +
        '<span class="edit-sep">〜</span>' +
        '<input type="date" class="edit-input-sm" id="eed-' + i + '"'
          + ' value="' + (ev.endDate || '') + '" title="複数日の場合のみ入力">' +
      '</div>' +
      '<div class="edit-row">' +
        '<label class="edit-label">' +
          '<input type="checkbox" id="ead-' + i + '" '
            + (ev.allDay ? 'checked' : '')
            + ' onchange="toggleAlldayEdit(' + i + ')"> 終日' +
        '</label>' +
        '<span id="etime-' + i + '" class="edit-time-wrap" ' + timeHidden + '>' +
          '<input type="time" class="edit-input-sm" id="est-' + i + '"'
            + ' value="' + (ev.startTime || '') + '">' +
          '<span class="edit-sep">〜</span>' +
          '<input type="time" class="edit-input-sm" id="eet-' + i + '"'
            + ' value="' + (ev.endTime || '') + '">' +
        '</span>' +
      '</div>' +
      '<div class="edit-row">' +
        '<label class="edit-label">場所</label>' +
        '<input type="text" class="edit-input" id="eloc-' + i + '"'
          + ' value="' + escHtml(ev.location || '') + '" placeholder="任意">' +
      '</div>' +
      '<div class="edit-row">' +
        '<label class="edit-label">説明</label>' +
        '<input type="text" class="edit-input" id="edesc-' + i + '"'
          + ' value="' + escHtml(ev.description || '') + '" placeholder="任意">' +
      '</div>' +
      '<div class="edit-actions">' +
        '<button class="btn btn-primary btn-sm" onclick="saveEvent(' + i + ')">保存</button>' +
        '<button class="btn btn-sm" onclick="cancelEdit(' + i + ')">キャンセル</button>' +
      '</div>' +
    '</div>';
}

/**
 * 終日チェックを切り替えたとき時刻入力の表示を切り替える
 */
function toggleAlldayEdit(i) {
  const allDay = document.getElementById('ead-' + i).checked;
  document.getElementById('etime-' + i).style.display = allDay ? 'none' : '';
}

/**
 * 編集内容を parsedEvents に保存してカードを再描画する
 */
function saveEvent(i) {
  const checked   = document.getElementById('chk-' + i).checked;
  const allDay    = document.getElementById('ead-' + i).checked;
  const startTime = document.getElementById('est-' + i).value || null;
  const endTime   = document.getElementById('eet-' + i).value || null;
  const endDate   = document.getElementById('eed-' + i).value || null;

  parsedEvents[i] = {
    title:       document.getElementById('et-' + i).value.trim() || '予定',
    date:        document.getElementById('ed-' + i).value,
    endDate:     endDate,
    startTime:   allDay ? null : startTime,
    endTime:     allDay ? null : endTime,
    location:    document.getElementById('eloc-' + i).value.trim() || null,
    description: document.getElementById('edesc-' + i).value.trim() || null,
    allDay:      allDay || !startTime,
  };

  renderCard(i, checked);
  updateCount();
}

/**
 * 編集をキャンセルして元の表示に戻す
 */
function cancelEdit(i) {
  const checked = document.getElementById('chk-' + i).checked;
  renderCard(i, checked);
}

/**
 * カードの「追加済み」表示に切り替える
 */
function markDone(i) {
  setTimeout(() => {
    const b = document.getElementById('addbtn-' + i);
    if (b) { b.textContent = '✓ 追加済み'; b.classList.add('done'); }
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
