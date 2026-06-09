/**
 * Google Calendar API モジュール
 *
 * 流れ（Python に例えると）：
 *   1. tokenClient = OAuth の「接続設定」を作る
 *   2. startRegistration() → requestAccessToken() でブラウザに認証ポップアップを出す
 *   3. 認証完了 → handleTokenResponse() が呼ばれてアクセストークンを受け取る
 *   4. registerAllEvents() → 予定を1件ずつ Google Calendar REST API に POST する
 */

let tokenClient       = null;
let accessToken       = null;
let tokenExpiry       = 0;   // トークンの有効期限（ミリ秒のタイムスタンプ）
let silentAuthTimeout = null; // スマホ対応：サイレント認証の無応答を検知するタイマー

/**
 * localStorage に保存したトークンをページ読み込み時に復元する
 * 有効なトークンが残っていれば requestAccessToken を呼ばずに済むのでポップアップが出ない
 */
function initTokenFromStorage() {
  const stored = localStorage.getItem('caldrop_token');
  const expiry = parseInt(localStorage.getItem('caldrop_token_expiry') || '0', 10);
  if (stored && Date.now() < expiry) {
    accessToken = stored;
    tokenExpiry = expiry;
  }
}

/**
 * GIS（Google Identity Services）トークンクライアントを初期化する
 * 初回の「登録」ボタンクリック時に一度だけ呼ばれる
 */
function initGoogleAuth() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    // calendar.events スコープ：予定の読み書き権限
    scope: 'https://www.googleapis.com/auth/calendar.events',
    callback: handleTokenResponse,
  });
}

/**
 * 認証完了後に Google から呼ばれるコールバック
 */
function handleTokenResponse(response) {
  // サイレント認証のタイムアウトタイマーをキャンセル（応答が来たので不要）
  if (silentAuthTimeout) { clearTimeout(silentAuthTimeout); silentAuthTimeout = null; }

  if (response.error) {
    // サイレント取得に失敗した場合（Google からログアウトしているなど）
    // → 通常フロー（アカウント選択あり）に自動でフォールバックする
    if (response.error === 'interaction_required'
     || response.error === 'login_required'
     || response.error === 'account_selection_required') {
      localStorage.removeItem('caldrop_authorized');
      tokenClient.requestAccessToken(); // 通常フローで再試行
      return;
    }
    showRegisterResult('Google認証がキャンセルされました', 'err');
    resetRegisterBtn();
    return;
  }
  accessToken = response.access_token;
  // expires_in は秒数（通常 3600 = 1時間）。60秒前に期限切れ扱いにしてバッファを持たせる
  tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;
  // トークン本体と有効期限を localStorage に保存する
  // → ページ再読み込み後も有効期限内ならポップアップなしで再利用できる
  localStorage.setItem('caldrop_authorized', '1');
  localStorage.setItem('caldrop_token', accessToken);
  localStorage.setItem('caldrop_token_expiry', tokenExpiry.toString());
  registerAllEvents();
}

/**
 * 「Googleカレンダーに登録」ボタンから呼ばれるエントリーポイント
 */
function startRegistration() {
  const checked = getCheckedEvents();
  if (!checked.length) {
    showRegisterResult('登録する予定を選択してください', 'err');
    return;
  }

  const btn = document.getElementById('registerBtn');
  btn.disabled = true;

  // 有効なトークンがあれば Google ライブラリが未ロードでも直接登録へ進める
  if (accessToken && Date.now() < tokenExpiry) {
    btn.textContent = '登録中...';
    registerAllEvents();
    return;
  }

  // GIS ライブラリがまだ読み込まれていなければ待つよう案内
  if (typeof google === 'undefined') {
    showRegisterResult('認証ライブラリを読み込み中です。少し待ってから再試行してください。', 'err');
    btn.disabled = false;
    return;
  }

  if (!tokenClient) initGoogleAuth();

  // トークンがない or 期限切れ → 認証が必要
  btn.textContent = '認証中...';

  // localStorage に「過去に認証済み」フラグがあればサイレント取得を試みる
  // prompt: 'none' = アカウント選択画面・同意画面を一切表示しない
  const hasAuthorized = localStorage.getItem('caldrop_authorized') === '1';
  if (hasAuthorized) {
    // スマホでは prompt:'none' が応答を返さず止まることがある
    // → 4秒以内に応答がなければ localStorage フラグを削除して通常フローに切り替える
    silentAuthTimeout = setTimeout(() => {
      silentAuthTimeout = null;
      localStorage.removeItem('caldrop_authorized');
      tokenClient.requestAccessToken();
    }, 4000);
    tokenClient.requestAccessToken({ prompt: 'none' });
  } else {
    // 初回のみ通常フロー（アカウント選択 + 同意画面あり）
    tokenClient.requestAccessToken();
  }
}

/**
 * チェックされている全予定を Google Calendar に登録する
 * async/await は Python の asyncio に相当（非同期処理）
 */
async function registerAllEvents() {
  const checked = getCheckedEvents();
  const btn = document.getElementById('registerBtn');
  let doneCount = 0;
  let failCount = 0;

  for (let k = 0; k < checked.length; k++) {
    btn.textContent = `登録中... ${k + 1} / ${checked.length} 件`;
    try {
      await postCalendarEvent(buildCalendarEvent(checked[k].ev));
      markDone(checked[k].i);
      doneCount++;
    } catch (e) {
      failCount++;
      console.error('登録失敗:', checked[k].ev.title, e.message);
    }
  }

  if (failCount === 0) {
    btn.textContent = `✓ ${doneCount}件を登録しました`;
    showRegisterResult(`${doneCount}件をGoogleカレンダーに登録しました`, 'ok');
    const calBtn = document.getElementById('openCalendarBtn');
    if (calBtn) calBtn.style.display = 'inline-flex';
  } else {
    btn.textContent = `${doneCount}件登録・${failCount}件失敗`;
    showRegisterResult(`${failCount}件の登録に失敗しました。再試行してください。`, 'err');
  }
  btn.disabled = false;
}

/**
 * Google Calendar REST API に予定を1件 POST する
 * Python の requests.post() に相当
 */
async function postCalendarEvent(event) {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * 予定オブジェクトを Google Calendar API の形式に変換する
 * gcal.js の makeGCalURL とは別物（API用フォーマット）
 */
function buildCalendarEvent(ev) {
  const base = {
    summary: ev.title,
    ...(ev.location    && { location:    ev.location }),
    ...(ev.description && { description: ev.description }),
  };

  if (ev.allDay) {
    // 終日イベント：date 形式。end は「翌日」を指定する仕様
    const [ey, em, ed] = (ev.endDate || ev.date).split('-').map(Number);
    const next = new Date(ey, em - 1, ed + 1);
    const endDate = next.getFullYear() + '-'
      + String(next.getMonth() + 1).padStart(2, '0') + '-'
      + String(next.getDate()).padStart(2, '0');
    return { ...base, start: { date: ev.date }, end: { date: endDate } };
  } else {
    // 時刻あり：dateTime 形式。タイムゾーンは Asia/Tokyo を明示する
    const st = ev.startTime || '09:00';
    const h  = parseInt(st.split(':')[0]);
    const et = ev.endTime || (h + 1).toString().padStart(2, '0') + ':' + st.split(':')[1];
    return {
      ...base,
      start: { dateTime: ev.date + 'T' + st + ':00', timeZone: 'Asia/Tokyo' },
      end:   { dateTime: ev.date + 'T' + et + ':00', timeZone: 'Asia/Tokyo' },
    };
  }
}

/**
 * チェックされている予定を { ev, i } の配列で返す
 */
function getCheckedEvents() {
  return parsedEvents
    .map((ev, i) => ({ ev, i }))
    .filter(({ i }) => {
      const chk = document.getElementById('chk-' + i);
      return chk && chk.checked;
    });
}

/**
 * ボタン付近の結果メッセージを表示する（登録成功・失敗・認証エラー）
 */
function showRegisterResult(msg, type) {
  const el = document.getElementById('registerResult');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; return; }
  el.className = 'result-msg ' + (type === 'ok' ? 'result-ok' : 'result-err');
  el.textContent = msg;
  el.style.display = 'block';
}

/**
 * 登録ボタンを初期状態に戻す（認証キャンセル時など）
 */
function resetRegisterBtn() {
  const btn = document.getElementById('registerBtn');
  if (btn) {
    btn.textContent = 'Googleカレンダーに登録';
    btn.disabled = false;
  }
}

// ページ読み込み時にトークンを復元（有効期限内なら再認証不要）
initTokenFromStorage();
