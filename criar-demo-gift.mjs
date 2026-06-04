/**
 * criar-demo-gift.mjs
 * Cria o presente de demonstração direto no Supabase (sem precisar do fluxo de pagamento).
 *
 * Uso:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="sua_chave_aqui"
 *   node criar-demo-gift.mjs
 */

import { readFileSync } from 'fs';
import { randomUUID }   from 'crypto';

/* ── Config ──────────────────────────────────────────────────── */
const SUPABASE_URL = 'https://imiwhgrjwgydedbfdlkn.supabase.co';
const KEY          = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_EMAIL   = 'sturiaoeduardo@gmail.com';
const BUCKET       = 'gift-images';

/* ── Dados do presente ───────────────────────────────────────── */
const GIFT = {
  name1:       'Gustavo',
  name2:       'Luísa',
  title:       'Minha princesa ❤️‍🔥',  // ❤️‍🔥
  message:     'Há momentos na vida que a gente guarda pra sempre. Conhecer você foi um desses momentos. E eu não mudaria nada.',
  capsulas: [
    'Logo na primeira vez que te vi já sabia que era você!',
    'Essa música sempre me lembra da gente...',
    'Lembra daquele restaurante? Virou o meu favorito!',
    'Cada momento eu desejo que seja do seu lado, te amo.',
  ],
  youtube_id:  'V141wUSkTfk',   // BK' - Planos feat. Luccas Carlos
  song_name:   'Planos',
  artist_name: "BK'",
  gift_type:   'amoroso',
  plan:        'vitalicio',
  start_date:  '2023-06-14',
  city:        null,
};

/* Fotos — ordem: [0..4] galeria, [5] capa */
const PHOTO_PATHS = [
  'c:\\Users\\User\\Downloads\\WhatsApp Image 2026-06-04 at 13.38.42.jpeg',
  'c:\\Users\\User\\Downloads\\WhatsApp Image 2026-06-04 at 13.38.43.jpeg',
  'c:\\Users\\User\\Downloads\\WhatsApp Image 2026-06-04 at 13.38.43 (1).jpeg',
  'c:\\Users\\User\\Downloads\\WhatsApp Image 2026-06-04 at 13.38.43 (2).jpeg',
  'c:\\Users\\User\\Downloads\\WhatsApp Image 2026-06-04 at 13.38.43 (3).jpeg',
  'c:\\Users\\User\\Downloads\\WhatsApp Image 2026-06-04 at 13.43.31.jpeg',  // capa
];

/* ── Helpers ─────────────────────────────────────────────────── */
function authHeaders(extra = {}) {
  return {
    apikey:        KEY,
    Authorization: `Bearer ${KEY}`,
    ...extra,
  };
}

async function findUserId(email) {
  const res  = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Falha ao buscar usuários: ${JSON.stringify(body)}`);
  const user = body.users?.find(u => u.email === email);
  if (!user) throw new Error(`Usuário "${email}" não encontrado no Supabase`);
  return user.id;
}

async function uploadPhoto(localPath, storagePath) {
  const bytes = readFileSync(localPath);
  const res   = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method:  'POST',
    headers: authHeaders({ 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }),
    body:    bytes,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload falhou [${storagePath}]: ${err}`);
  }
}

async function insertRow(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body:    JSON.stringify(row),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Insert em ${table} falhou: ${err}`);
  }
}

function publicUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

/* ── Main ────────────────────────────────────────────────────── */
async function main() {
  if (!KEY) {
    console.error('\n❌  Defina a variável de ambiente SUPABASE_SERVICE_ROLE_KEY antes de rodar:\n');
    console.error('   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
    console.error('   node criar-demo-gift.mjs\n');
    process.exit(1);
  }

  console.log('\n🔍  Buscando conta do usuário...');
  const userId = await findUserId(USER_EMAIL);
  console.log(`✅  user_id: ${userId}`);

  const giftId    = randomUUID();
  const photoRows = [];

  console.log('\n📸  Fazendo upload das fotos...');
  for (let i = 0; i < 5; i++) {
    const storagePath = `${userId}/${giftId}/photo-${i}.jpg`;
    process.stdout.write(`   [${i + 1}/6] galeria... `);
    await uploadPhoto(PHOTO_PATHS[i], storagePath);
    photoRows.push({ gift_id: giftId, storage_path: storagePath, is_extra: false, position: i });
    console.log('ok');
  }

  const coverPath = `${userId}/${giftId}/cover.jpg`;
  process.stdout.write(`   [6/6] capa...    `);
  await uploadPhoto(PHOTO_PATHS[5], coverPath);
  photoRows.push({ gift_id: giftId, storage_path: coverPath, is_extra: true, position: 0 });
  console.log('ok');

  console.log('\n💾  Salvando presente no banco...');
  await insertRow('gifts', {
    id:             giftId,
    user_id:        userId,
    name1:          GIFT.name1,
    name2:          GIFT.name2,
    title:          GIFT.title,
    message:        GIFT.message,
    capsulas:       GIFT.capsulas,
    youtube_id:     GIFT.youtube_id,
    song_name:      GIFT.song_name,
    artist_name:    GIFT.artist_name,
    gift_type:      GIFT.gift_type,
    plan:           GIFT.plan,
    paid:           true,
    start_date:     GIFT.start_date,
    city:           GIFT.city,
    preview_url:    null,
    music_duration: null,
    photo_captions: [],
    template:       null,
  });

  console.log('💌  Salvando fotos...');
  await insertRow('gift_photos', photoRows);

  const giftUrl = `https://soulmates-bice.vercel.app/presente.html?id=${giftId}`;
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(giftUrl)}`;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  ✅  PRESENTE CRIADO COM SUCESSO!                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n🔗  Link:    ${giftUrl}`);
  console.log(`📷  QR Code: ${qrUrl}`);
  console.log('\n(Abra o link do QR Code no browser para baixar a imagem)\n');
}

main().catch(err => {
  console.error('\n❌  Erro:', err.message);
  process.exit(1);
});
