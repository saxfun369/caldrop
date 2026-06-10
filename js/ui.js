/**
 * UI モジュール
 * 画面の描画・更新・操作を担当する。
 * チェック・編集・登録済みなどの状態は parsedEvents（データ側）に持ち、
 * DOM は常に parsedEvents から描き直す（「データが正・画面は写し」の方針）。
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
 */
function renderCard(i) {
  const card = document.getElementById('card-' + i);
  if (!card) return;
  const ev = parsedEvents[i];

  const dateStr = ev.endDate ? ev.date + ' 〜 ' + ev.endDate : ev.date;
  const timeStr = ev.allDay
    ? '終日'
    : (ev.startTime ? ev.startTime + (ev.endTime ? ' – ' + ev.endTime : '') : '時間未定');
  // 絵文字は aria-hidden で隠し、スクリーンリーダーに読み上げさせない
  const icon = (e) => '<span aria-hidden="true">' + e + '</span> ';
  const locStr  = ev.location    ? '<span>' + icon('📍') + escHtml(ev.location)    + '</span>' : '';
  const descStr = ev.description ? '<span>' + icon('📝') + escHtml(ev.description) + '</span>' : '';

  card.className = 'event-card';
  card.innerHTML =
    '<input type="checkbox" class="event-check" id="chk-' + i + '" '
      + 'aria-label="「' + escHtml(ev.title) + '」を登録対象にする" '
      + (ev.checked ? 'checked' : '') + ' onchange="toggleCheck(' + i + ')">' +
    '<div class="event-info">' +
      '<p class="event-title">' + escHtml(ev.title) + '</p>' +
      '<p class="event-meta">' +
        '<span>' + icon('📅') + dateStr + '</span>' +
        '<span>' + icon('🕐') + timeStr + '</span>' +
        locStr + descStr +
      '</p>' +
    '</div>' +
    '<div class="card-actions">' +
      '<button class="edit-btn" onclick="editEvent(' + i + ')">編集</button>' +
      '<a href="' + makeGCalURL(ev) + '" target="_blank"'
        + ' class="add-btn' + (ev.registered ? ' done' : '') + '"'
        + ' id="addbtn-' + i + '" onclick="markDone(' + i + ')">'
        + (ev.registered ? '✓ 追加済み' : '＋ 個別追加') + '</a>' +
    '</div>';
}

/**
 * 解析済み予定の一覧カードを画面に描画する
 * 表示順（displayOrder）もここで sortByDate に応じて計算し直す
 */
function renderEvents() {
  const list = document.getElementById('eventsList');

  displayOrder = parsedEvents.map((_, i) => i);
  if (sortByDate) {
    displayOrder.sort((a, b) =>
      (parsedEvents[a].date || '').localeCompare(parsedEvents[b].date || '')
    );
  }

  // ヘッダー（件数ラベル + ソートトグル）
  list.innerHTML =
    '<div class="events-header">' +
      '<p class="section-label">' + parsedEvents.length + '件を解析しました — 確認してから登録してください</p>' +
      '<div class="sort-toggle">' +
        '<button class="sort-btn' + (!sortByDate ? ' sort-active' : '') + '" onclick="setSortOrder(false)">入力順</button>' +
        '<button class="sort-btn' + (sortByDate  ? ' sort-active' : '') + '" onclick="setSortOrder(true)">日付順</button>' +
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
  displayOrder.forEach(i => renderCard(i));

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-add-event';
  addBtn.textContent = '＋ 予定を追加';
  addBtn.onclick = addNewEvent;
  list.appendChild(addBtn);

  document.getElementById('bulkSection').style.display = 'block';
  resetRegisterBtn();
  showRegisterResult('', '');
  const calBtn = document.getElementById('openCalendarBtn');
  if (calBtn) calBtn.style.display = 'none';
  updateCount();
}

/**
 * ソート順を切り替えて再描画する
 * 状態は sortByDate（main.js）に持つので、ここでは切り替えて描き直すだけ
 */
function setSortOrder(byDate) {
  sortByDate = byDate;
  renderEvents();
}

/**
 * チェックボックスの状態をデータ側（parsedEvents）に反映する
 */
function toggleCheck(i) {
  const chk = document.getElementById('chk-' + i);
  if (chk) parsedEvents[i].checked = chk.checked;
  updateCount();
}

/**
 * カードを「編集モード」に切り替える
 */
function editEvent(i) {
  const ev = parsedEvents[i];
  const card = document.getElementById('card-' + i);
  card.className = 'event-card editing';

  // 終日の場合は時刻入力を最初から非表示にする
  const timeHidden = ev.allDay ? 'style="display:none"' : '';

  card.innerHTML =
    '<input type="checkbox" class="event-check" id="chk-' + i + '" '
      + 'aria-label="「' + escHtml(ev.title) + '」を登録対象にする" '
      + (ev.checked ? 'checked' : '') + ' onchange="toggleCheck(' + i + ')">' +
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
  const allDay    = document.getElementById('ead-' + i).checked;
  const startTime = document.getElementById('est-' + i).value || null;
  const endTime   = document.getElementById('eet-' + i).value || null;
  const endDate   = document.getElementById('eed-' + i).value || null;
  const date      = document.getElementById('ed-' + i).value;

  // 保存前のバリデーション。問題があれば保存せず編集フォームに留まる
  if (!date) {
    alert('日付を入力してください');
    return;
  }
  if (endDate && endDate < date) {
    alert('終了日は開始日以降にしてください');
    return;
  }
  if (!allDay && startTime && endTime && endTime <= startTime) {
    alert('終了時刻は開始時刻より後にしてください');
    return;
  }

  parsedEvents[i] = {
    ...parsedEvents[i],  // sourceLine・checked などの管理フィールドは引き継ぐ
    title:       document.getElementById('et-' + i).value.trim() || '予定',
    date:        date,
    endDate:     endDate,
    startTime:   allDay ? null : startTime,
    endTime:     allDay ? null : endTime,
    location:    document.getElementById('eloc-' + i).value.trim() || null,
    description: document.getElementById('edesc-' + i).value.trim() || null,
    allDay:      allDay || !startTime,
    edited:      true,
    registered:  false,  // 内容が変わったので「追加済み」表示は解除する
  };

  renderCard(i);
  updateCount();
}

/**
 * 編集をキャンセルして元の表示に戻す
 */
function cancelEdit(i) {
  renderCard(i);
}

/**
 * 「追加済み」をデータに記録し、カードの表示を切り替える
 */
function markDone(i) {
  parsedEvents[i].registered = true;
  // リンクを開く動作を妨げないよう、表示の切り替えは少し遅らせる
  setTimeout(() => {
    const b = document.getElementById('addbtn-' + i);
    if (b) { b.textContent = '✓ 追加済み'; b.classList.add('done'); }
  }, 400);
}

/**
 * チェックされている件数を更新する
 */
function updateCount() {
  const checked = parsedEvents.filter(ev => ev.checked).length;
  document.getElementById('selectedCount').textContent =
    checked + ' / ' + parsedEvents.length + ' 件選択中';
}

/**
 * 成功・エラーメッセージを表示する。msg が空なら非表示にする
 */
function showResult(msg, type, html) {
  const el = document.getElementById('resultMsg');
  if (!msg) { el.style.display = 'none'; return; }
  const cls = type === 'ok' ? 'result-ok' : type === 'warn' ? 'result-warn' : 'result-err';
  el.className = 'result-msg ' + cls;
  if (html) { el.innerHTML = msg; } else { el.textContent = msg; }
  el.style.display = 'block';
}

/**
 * 画面をすべてリセットする
 */
function clearAll() {
  document.getElementById('inputText').value = '';
  clearResults();
}
