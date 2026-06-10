/**
 * エントリーポイント
 * アプリ全体で共有するデータと、各処理を束ねる関数を置く。
 * Python の if __name__ == "__main__": ブロックに相当。
 */

// アプリ全体で共有する予定データ（Python のグローバル変数に相当）
// 解析結果のフィールドに加えて、以下の管理用フィールドを持つ：
//   sourceLine : 由来するテキスト行（「＋ 予定を追加」による手動追加は null）
//   checked    : チェックボックスの状態
//   edited     : カード上で編集済みか（記録用）
//   registered : Googleカレンダー登録済みか
let parsedEvents = [];
// 表示順を管理するインデックス配列（例: [0,2,1] = 0番・2番・1番の順で表示）
// parsedEvents 自体は並び替えず、こちらだけ変える
let displayOrder = [];
// 現在のソート状態（true = 日付順）
let sortByDate = false;
// 一括登録の実行中フラグ。登録中にライブプレビューが画面を作り直すのを防ぐ
let isRegistering = false;

/**
 * テキストエリアの内容を解析してカード一覧を表示する
 * auto = true はライブプレビュー（入力中の自動解析）からの呼び出し。
 * 入力途中の行に警告を出さないなど、手動の「解析する」より控えめに振る舞う。
 */
function parseEvents(auto = false) {
  const ta = document.getElementById('inputText');
  const text = ta.value;

  if (!text.trim()) {
    if (auto) clearResults();
    else showResult('予定を入力してください。', 'err');
    return;
  }

  const year = new Date().getFullYear().toString();
  const lines = text.split(/\n/);

  // 既存カードの再利用マップ：行テキスト → その行から作ったイベントのキュー
  // 同じ行が再解析されたら既存オブジェクトを使い回し、編集・チェック状態を保持する
  // （Python の defaultdict(list) に近い使い方）
  const pool = new Map();
  for (const ev of parsedEvents) {
    if (ev.sourceLine === null) continue;
    if (!pool.has(ev.sourceLine)) pool.set(ev.sourceLine, []);
    pool.get(ev.sourceLine).push(ev);
  }
  // 手動追加のカードはテキストエリアと無関係なので常に残す
  const manualEvents = parsedEvents.filter(ev => ev.sourceLine === null);

  const lineEvents = [];
  const failed = []; // 解析できなかった行（行番号付き）
  lines.forEach((line, idx) => {
    if (!line.trim()) return;
    const queue = pool.get(line);
    if (queue && queue.length) {
      lineEvents.push(queue.shift());
      return;
    }
    const r = parseLineDetailed(line, year);
    if (r.event) {
      // スプレッド構文 {...obj, x: 1} は Python の {**d, "x": 1} に相当
      lineEvents.push({ ...r.event, sourceLine: line, checked: true, edited: false, registered: false });
    } else {
      failed.push({ line, idx, reason: r.error });
    }
  });

  parsedEvents = lineEvents.concat(manualEvents);

  if (!parsedEvents.length) {
    if (auto) clearResults();
    else showResult('予定を認識できませんでした。書き方を確認してください。', 'err');
    return;
  }

  // 認識できなかった行の警告。
  // 自動解析ではカーソルがある行（＝入力途中の行）を対象外にし、警告のチラつきを防ぐ
  let warns = failed;
  if (auto) {
    const cursorLine = text.slice(0, ta.selectionStart).split('\n').length - 1;
    warns = failed.filter(f => f.idx !== cursorLine);
  }
  if (warns.length > 0) {
    // 各行に「なぜ認識できなかったか」の理由を添えて表示する
    const items = warns.map(f =>
      `<li>${escHtml(f.line)}<span class="warn-reason"> — ${escHtml(f.reason || '認識できませんでした')}</span></li>`
    ).join('');
    showResult(
      `${warns.length}行を認識できませんでした。認識できた予定のみ表示しています。`
      + `<ul style="margin-top:6px;padding-left:1.4em;opacity:0.85">${items}</ul>`,
      'warn', true
    );
  } else {
    showResult('', '');
  }

  renderEvents();
}

/**
 * 解析結果まわりの表示と内部状態をすべて消す（テキストエリアは触らない）
 */
function clearResults() {
  document.getElementById('eventsList').innerHTML = '';
  document.getElementById('bulkSection').style.display = 'none';
  showResult('', '');
  parsedEvents = [];
  displayOrder = [];
}

/**
 * ページ読み込み完了時の初期化
 * DOMContentLoaded = HTML の解析が終わったタイミングで発火するイベント
 */
document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('inputText');

  // Cmd（Mac）/ Ctrl（Windows）+ Enter で即解析
  ta.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault(); // 改行が入力されるデフォルト動作を止める
      parseEvents();
    }
  });

  // ライブプレビュー：入力が止まって0.6秒たったら自動解析する
  // タイマーを毎回張り直して「最後の入力」だけ処理する手法（デバウンス）。
  // 1文字ごとに解析・再描画すると無駄が多いため
  let autoParseTimer = null;
  ta.addEventListener('input', () => {
    clearTimeout(autoParseTimer);
    autoParseTimer = setTimeout(() => {
      if (isRegistering) return; // 登録処理中は画面を作り直さない
      // カード編集中に再描画すると編集フォームが消えてしまうため見送る
      if (document.querySelector('.event-card.editing')) return;
      parseEvents(true);
    }, 600);
  });

  // PC（マウス等でホバーできる端末）のみ自動フォーカス。
  // スマホでフォーカスするとキーボードが勝手に開いてしまうため除外する
  if (window.matchMedia('(hover: hover)').matches) ta.focus();
});

function addNewEvent() {
  const today = new Date();
  const dateStr = today.getFullYear() + '-'
    + String(today.getMonth() + 1).padStart(2, '0') + '-'
    + String(today.getDate()).padStart(2, '0');

  parsedEvents.push({
    title: '', date: dateStr, endDate: null,
    startTime: null, endTime: null,
    location: null, description: null, allDay: true,
    sourceLine: null, checked: true, edited: true, registered: false,
  });

  const i = parsedEvents.length - 1;
  displayOrder.push(i);

  const cardsList = document.getElementById('cardsList');
  const card = document.createElement('div');
  card.id = 'card-' + i;
  cardsList.appendChild(card);

  renderCard(i);  // チェックボックスを含む初期描画が必要
  editEvent(i);
  updateCount();
}
