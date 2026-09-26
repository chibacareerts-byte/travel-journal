// ダミーデータ。あとで Supabase のテーブルに置き換えます。
//
// 1件の記録のかたち:
//   id           : 記録の番号（文字列）
//   placeName    : 場所名
//   prefectureId : 都道府県の番号（prefectures.js の id）
//   visitedOn    : 訪問日 'YYYY-MM-DD'
//   photos       : 写真の配列（最大10枚）。src が null の間はプレースホルダー表示
//                  tone(0〜5) はプレースホルダーの色合いです
//   memo         : メモ
//   tags         : タグ名の配列

const ph = (recordId, tones) =>
  tones.map((tone, i) => ({ id: `${recordId}-p${i + 1}`, src: null, tone }))

export const DUMMY_RECORDS = [
  {
    id: 'r1',
    placeName: '萬福寺',
    prefectureId: 26,
    visitedOn: '2026-05-04',
    photos: ph('r1', [0, 3, 1, 4, 2, 5]),
    memo: '宇治にある黄檗宗の大本山。中国風の伽藍が回廊でつながっていて、京都の他のお寺とは空気がまったく違った。魚の形をした開梆（かいぱん）が回廊に吊るされていた。',
    tags: ['寺', '建築'],
  },
  {
    id: 'r2',
    placeName: '大徳寺',
    prefectureId: 26,
    visitedOn: '2026-04-12',
    photos: ph('r2', [2, 5, 0, 3]),
    memo: '塔頭をいくつか巡った。枯山水の前でしばらく座っていた。人が少ない朝のうちに行ってよかった。',
    tags: ['寺', '建築'],
  },
  {
    id: 'r3',
    placeName: '伏見稲荷大社',
    prefectureId: 26,
    visitedOn: '2025-11-03',
    photos: ph('r3', [4, 0, 2, 1, 3, 5, 0, 2]),
    memo: '千本鳥居を上まで歩いた。奥へ進むほど静かになる。山頂からの京都の街並みが小さく見えた。',
    tags: ['神社', '自然'],
  },
  {
    id: 'r4',
    placeName: '清水寺',
    prefectureId: 26,
    visitedOn: '2025-04-06',
    photos: ph('r4', [1, 3, 5, 2, 0]),
    memo: '桜の季節。舞台から見下ろす景色は、写真で見るよりずっと高くて広かった。',
    tags: ['寺', '建築'],
  },
  {
    id: 'r5',
    placeName: '金閣寺',
    prefectureId: 26,
    visitedOn: '2024-12-21',
    photos: ph('r5', [5, 2, 4]),
    memo: '冬の朝。鏡湖池に映る金色がやわらかく見えた。',
    tags: ['寺', '建築'],
  },
  {
    id: 'r6',
    placeName: '東大寺',
    prefectureId: 29,
    visitedOn: '2025-09-15',
    photos: ph('r6', [3, 1, 0, 4]),
    memo: '大仏殿の大きさに圧倒された。鹿に囲まれながら二月堂まで歩いた。',
    tags: ['寺', '建築'],
  },
  {
    id: 'r7',
    placeName: '姫路城',
    prefectureId: 28,
    visitedOn: '2024-03-30',
    photos: ph('r7', [2, 4, 1, 5, 3]),
    memo: '白漆喰の壁が青空にくっきり映えていた。天守の急な階段を息を切らして登った。',
    tags: ['城', '建築'],
  },
  {
    id: 'r8',
    placeName: '金沢21世紀美術館',
    prefectureId: 17,
    visitedOn: '2026-02-08',
    photos: ph('r8', [1, 5, 0]),
    memo: '円形の建物の中を、ぐるぐると迷いながら歩く。屋外の作品がとくに印象に残った。',
    tags: ['美術館', '建築'],
  },
  {
    id: 'r9',
    placeName: '地中美術館',
    prefectureId: 37,
    visitedOn: '2025-06-14',
    photos: ph('r9', [0, 2, 4, 1]),
    memo: '直島。地中に埋め込まれた美術館で、自然光だけで作品を見る時間がとても静かだった。',
    tags: ['美術館', '建築', '自然'],
  },
  {
    id: 'r10',
    placeName: '由布院',
    prefectureId: 44,
    visitedOn: '2024-10-12',
    photos: ph('r10', [5, 3, 1, 2, 4, 0, 5]),
    memo: '朝霧の金鱗湖を散歩して、そのあと温泉へ。帰り道に入った小さなカフェのプリンがおいしかった。',
    tags: ['温泉', '自然', 'カフェ'],
  },
  {
    id: 'r11',
    placeName: '厳島神社',
    prefectureId: 34,
    visitedOn: '2025-08-23',
    photos: ph('r11', [4, 2, 3, 0]),
    memo: '潮が満ちた時間に鳥居を見に行った。干潮になると歩いて近くまで行けるのも面白い。',
    tags: ['神社', '自然'],
  },
  {
    id: 'r12',
    placeName: '松本城',
    prefectureId: 20,
    visitedOn: '2026-08-16',
    photos: ph('r12', [3, 0, 5]),
    memo: '黒い天守と北アルプスの組み合わせがきれいだった。',
    tags: ['城'],
  },
  {
    id: 'r13',
    placeName: '小樽運河',
    prefectureId: 1,
    visitedOn: '2024-07-20',
    photos: ph('r13', [2, 1]),
    memo: '夕方の運河沿いを歩いた。古い倉庫を使ったカフェで休憩。',
    tags: ['カフェ'],
  },
  {
    id: 'r14',
    placeName: '熊野那智大社',
    prefectureId: 30,
    visitedOn: '2026-09-06',
    photos: ph('r14', [0, 4, 2, 5, 1]),
    memo: '石段を上がると、那智の滝が木々のあいだに見えた。雨上がりで空気が澄んでいた。',
    tags: ['神社', '自然'],
  },
]
