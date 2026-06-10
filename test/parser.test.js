/**
 * parser.js / gcal.js のユニットテスト
 *
 * 実行方法：プロジェクト直下で
 *   node --test
 *
 * Node.js 標準のテストランナーを使用（Python の pytest に相当・追加インストール不要）。
 * assert.equal(a, b) は pytest の assert a == b に相当する。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { toHHMM, adjustYear, parseDate, parseLine } = require('../js/parser.js');
const { defaultEnd } = require('../js/gcal.js');

/** Date オブジェクトを "YYYY-MM-DD" に整形する（テスト内の期待値計算用） */
function fmtDate(d) {
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

// 年補正（adjustYear）の影響を受けないよう、解析テストには遠い未来の年を渡す
const YEAR = '2099';

// ---------------- toHHMM ----------------

test('toHHMM: 様々な表記を HH:MM に統一する', () => {
  assert.equal(toHHMM('10時30分'), '10:30');
  assert.equal(toHHMM('10:30'), '10:30');
  assert.equal(toHHMM('16時'), '16:00');
  assert.equal(toHHMM('14時半'), '14:30');
  assert.equal(toHHMM('9'), '09:00');
});

test('toHHMM: 実在しない時刻は null を返す', () => {
  assert.equal(toHHMM('25時'), null);
  assert.equal(toHHMM('10:75'), null);
});

// ---------------- parseDate ----------------

test('parseDate: 月日を YYYY-MM-DD に変換する', () => {
  assert.equal(parseDate('4/20', YEAR), '2099-04-20');
  assert.equal(parseDate('4月5日', YEAR), '2099-04-05');
});

test('parseDate: 実在しない月日は null を返す', () => {
  assert.equal(parseDate('13/4', YEAR), null);
  assert.equal(parseDate('4/45', YEAR), null);
});

// ---------------- parseLine: 時刻 ----------------

test('parseLine: 基本形（日付・時刻範囲・タイトル）', () => {
  const ev = parseLine('8/1 10:00-15:00 散髪', YEAR);
  assert.equal(ev.date, '2099-08-01');
  assert.equal(ev.startTime, '10:00');
  assert.equal(ev.endTime, '15:00');
  assert.equal(ev.title, '散髪');
  assert.equal(ev.allDay, false);
});

test('parseLine: 「から」区切り・時表記', () => {
  const ev = parseLine('8/3 15時から17時 ジム', YEAR);
  assert.equal(ev.startTime, '15:00');
  assert.equal(ev.endTime, '17:00');
  assert.equal(ev.title, 'ジム');
});

test('parseLine: 空白区切りの数字のみ時刻（17 21）', () => {
  const ev = parseLine('8/3 17 21 飲み会', YEAR);
  assert.equal(ev.startTime, '17:00');
  assert.equal(ev.endTime, '21:00');
  assert.equal(ev.title, '飲み会');
});

test('parseLine: 数字で終わるタイトルを時刻範囲と誤解釈しない', () => {
  // 修正前は「5」と「13時」が時刻範囲（05:00-13:00）と解釈されていた
  const ev = parseLine('10/15 会議室5 13時', YEAR);
  assert.equal(ev.title, '会議室5');
  assert.equal(ev.startTime, '13:00');
  assert.equal(ev.endTime, null);
});

test('parseLine: 単語に続けて書いた時刻範囲（夕食18時〜20時）', () => {
  const ev = parseLine('8/1 夕食18時〜20時', YEAR);
  assert.equal(ev.startTime, '18:00');
  assert.equal(ev.endTime, '20:00');
  assert.equal(ev.title, '夕食');
});

test('parseLine: 終了時刻が開始時刻より前の行は解析失敗（null）', () => {
  // 全角スペース・全角＠を含む実際の入力例
  assert.equal(parseLine('8月1日　17時から15時　水泳　＠大阪', YEAR), null);
  assert.equal(parseLine('8/1 10:00-10:00 無効', YEAR), null);
  // 日またぎ（22時〜翌2時）も現状は非対応としてエラー扱い
  assert.equal(parseLine('8/1 22時から2時 飲み会', YEAR), null);
});

test('parseLine: 全角＠でも場所を認識する', () => {
  const ev = parseLine('6月17日　16時から19時　夜ご飯　＠梅田アカス', YEAR);
  assert.equal(ev.location, '梅田アカス');
  assert.equal(ev.title, '夜ご飯');
  assert.equal(ev.startTime, '16:00');
  assert.equal(ev.endTime, '19:00');
});

test('parseLine: 「半」表記（14時半）に対応する', () => {
  const a = parseLine('8/1 14時半から16時 打ち合わせ', YEAR);
  assert.equal(a.startTime, '14:30');
  assert.equal(a.endTime, '16:00');
  assert.equal(a.title, '打ち合わせ');
  const b = parseLine('8/1 美容院 10時半', YEAR);
  assert.equal(b.startTime, '10:30');
  assert.equal(b.endTime, null);
  assert.equal(b.title, '美容院');
  const c = parseLine('8/1 9時半〜10時半 朝会', YEAR);
  assert.equal(c.startTime, '09:30');
  assert.equal(c.endTime, '10:30');
});

test('parseLine: 時刻なしは終日予定になる', () => {
  const ev = parseLine('8/10 健康診断', YEAR);
  assert.equal(ev.allDay, true);
  assert.equal(ev.startTime, null);
  assert.equal(ev.title, '健康診断');
});

// ---------------- parseLine: 日付 ----------------

test('parseLine: 日付範囲は複数日の終日予定になる', () => {
  const ev = parseLine('8/20-22 夏休み旅行', YEAR);
  assert.equal(ev.date, '2099-08-20');
  assert.equal(ev.endDate, '2099-08-22');
  assert.equal(ev.allDay, true);
  assert.equal(ev.title, '夏休み旅行');
});

test('parseLine: 年を明示すると過去日付でも補正しない', () => {
  const ev = parseLine('2020/4/5 14:00 過去の予定', YEAR);
  assert.equal(ev.date, '2020-04-05');
  assert.equal(ev.startTime, '14:00');
});

test('parseLine: 実在しない日付の行は解析失敗（null）', () => {
  assert.equal(parseLine('13/45 ありえない予定', YEAR), null);
});

test('parseLine: 相対日付（明日）', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ev = parseLine('明日 10:00-11:00 打ち合わせ', YEAR);
  assert.equal(ev.date, fmtDate(tomorrow));
  assert.equal(ev.title, '打ち合わせ');
});

test('parseLine: 行の途中にある相対日付も認識する', () => {
  // 修正前は行頭の相対日付しか認識されなかった
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ev = parseLine('歯医者 明日 15:00', YEAR);
  assert.equal(ev.date, fmtDate(tomorrow));
  assert.equal(ev.startTime, '15:00');
  assert.equal(ev.title, '歯医者');
});

test('parseLine: 「明日香」を相対日付と誤認しない', () => {
  const ev = parseLine('5/1 明日香村ツアー', YEAR);
  assert.equal(ev.date, '2099-05-01');
  assert.equal(ev.title, '明日香村ツアー');
});

// ---------------- parseLine: 場所・説明 ----------------

test('parseLine: @で場所を指定する', () => {
  const ev = parseLine('8/2 10:00-11:00 打ち合わせ @渋谷オフィス', YEAR);
  assert.equal(ev.location, '渋谷オフィス');
  assert.equal(ev.title, '打ち合わせ');
});

test('parseLine: キーワード＋コロンの場所と丸括弧の説明', () => {
  const ev = parseLine('9/10 結婚式 会場：ホテルグランド （スピーチあり）', YEAR);
  assert.equal(ev.location, 'ホテルグランド');
  assert.equal(ev.description, 'スピーチあり');
  assert.equal(ev.title, '結婚式');
});

test('parseLine: 都市名フォールバックは他にタイトルの単語が残る場合だけ', () => {
  // 単語が分かれていれば都市名を場所として抜き出す
  const a = parseLine('8/1 打ち合わせ 東京', YEAR);
  assert.equal(a.location, '東京');
  assert.equal(a.title, '打ち合わせ');
  // 修正前は「東京出張」全体が場所になりタイトルが「予定」になっていた
  const b = parseLine('8/1 東京出張', YEAR);
  assert.equal(b.location, null);
  assert.equal(b.title, '東京出張');
});

// ---------------- adjustYear ----------------

test('adjustYear: 昨日の日付は翌年に補正される', () => {
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const ds = fmtDate(yest);
  assert.equal(
    adjustYear(ds, String(yest.getFullYear())),
    (yest.getFullYear() + 1) + ds.slice(4)
  );
});

test('adjustYear: 今日の日付はそのまま', () => {
  const today = fmtDate(new Date());
  assert.equal(adjustYear(today, today.slice(0, 4)), today);
});

// ---------------- defaultEnd（gcal.js） ----------------

test('defaultEnd: 通常は開始の1時間後', () => {
  assert.deepEqual(defaultEnd('2099-08-01', '10:30'),
    { date: '2099-08-01', time: '11:30' });
});

test('defaultEnd: 23時台の開始は翌日0時台に繰り上げる', () => {
  // 修正前は「24:30」という不正な時刻が生成され登録に失敗していた
  assert.deepEqual(defaultEnd('2099-08-01', '23:30'),
    { date: '2099-08-02', time: '00:30' });
  // 年末は年も繰り上がる
  assert.deepEqual(defaultEnd('2099-12-31', '23:00'),
    { date: '2100-01-01', time: '00:00' });
});
