-- Demo seed: Bar "Mgzavrebi" (Тбилиси) — for screenshots
-- Run: psql $DATABASE_URL -f sql/seed_demo.sql
-- Safe to re-run: uses DO $$ blocks with existence checks

DO $$
DECLARE
  v_id       UUID;
  mgr_id     UUID;
  staff1_id  UUID;
  staff2_id  UUID;

  -- products
  p_beer_natakhtari  UUID; p_beer_kazbegi     UUID; p_beer_heineken    UUID;
  p_wine_rkatsiteli  UUID; p_wine_saperavi     UUID; p_wine_rose        UUID;
  p_chacha           UUID; p_whisky            UUID; p_gin_tonic        UUID;
  p_lemonade         UUID; p_water             UUID; p_juice            UUID;
  p_coffee           UUID; p_tea               UUID;
  p_khinkali         UUID; p_mtsvadi           UUID; p_lobiani          UUID;
  p_chips            UUID; p_nuts              UUID; p_cheese_plate     UUID;

  -- guests
  g_giorgi UUID; g_nino UUID; g_david UUID; g_ana UUID;
  g_lasha  UUID; g_mari UUID; g_table3 UUID; g_vip UUID;

  -- checks (open)
  ch_open1 UUID; ch_open2 UUID; ch_open3 UUID;

  -- checks (closed)
  ch1 UUID; ch2 UUID; ch3 UUID; ch4 UUID; ch5 UUID;
  ch6 UUID; ch7 UUID; ch8 UUID; ch9 UUID; ch10 UUID;
  ch11 UUID; ch12 UUID;

  -- procurement
  pr_order UUID;

BEGIN

-- ── VENUE ────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'mgzavrebi-bar') THEN
  INSERT INTO venues (slug, name, email, phone, is_active)
  VALUES ('mgzavrebi-bar', 'Mgzavrebi Bar', 'mgzavrebi@checki.ge', '+995 555 123 456', true)
  RETURNING id INTO v_id;
ELSE
  SELECT id INTO v_id FROM venues WHERE slug = 'mgzavrebi-bar';
END IF;

-- ── USERS ────────────────────────────────────────────────────────────────────
-- Manager
IF NOT EXISTS (SELECT 1 FROM users WHERE login = 'giorgi.m') THEN
  INSERT INTO users (venue_id, role, name, login, password_hash, email)
  VALUES (v_id, 'manager', 'Giorgi Maisuradze', 'giorgi.m',
          crypt('demo1234', gen_salt('bf')), 'giorgi@mgzavrebi.ge')
  RETURNING id INTO mgr_id;
ELSE
  SELECT id INTO mgr_id FROM users WHERE login = 'giorgi.m';
END IF;

-- Staff 1
IF NOT EXISTS (SELECT 1 FROM users WHERE login = 'nino.b') THEN
  INSERT INTO users (venue_id, role, name, login, password_hash, email)
  VALUES (v_id, 'staff', 'Nino Beridze', 'nino.b',
          crypt('demo1234', gen_salt('bf')), 'nino@mgzavrebi.ge')
  RETURNING id INTO staff1_id;
ELSE
  SELECT id INTO staff1_id FROM users WHERE login = 'nino.b';
END IF;

-- Staff 2
IF NOT EXISTS (SELECT 1 FROM users WHERE login = 'lasha.k') THEN
  INSERT INTO users (venue_id, role, name, login, password_hash, email, is_active)
  VALUES (v_id, 'staff', 'Lasha Kobakhidze', 'lasha.k',
          crypt('demo1234', gen_salt('bf')), null, false)
  RETURNING id INTO staff2_id;
ELSE
  SELECT id INTO staff2_id FROM users WHERE login = 'lasha.k';
END IF;

-- ── PRODUCTS (CATALOG) ────────────────────────────────────────────────────────
INSERT INTO products (venue_id, name, search_key, last_price, category) VALUES
  (v_id, 'Natakhtari Draft 0.5', 'natakhtari draft 05', 8.00,  'Beer'),
  (v_id, 'Kazbegi 0.5',          'kazbegi 05',          7.00,  'Beer'),
  (v_id, 'Heineken 0.33',        'heineken 033',         9.00,  'Beer'),
  (v_id, 'Rkatsiteli (glass)',    'rkatsiteli glass',    12.00, 'Wine'),
  (v_id, 'Saperavi (glass)',      'saperavi glass',      14.00, 'Wine'),
  (v_id, 'Rosé (glass)',          'rose glass',          13.00, 'Wine'),
  (v_id, 'Chacha 50ml',           'chacha 50ml',         10.00, 'Spirits'),
  (v_id, 'Whisky (J.Walker) 50ml','whisky jwalker 50ml', 18.00, 'Spirits'),
  (v_id, 'Gin Tonic',             'gin tonic',           16.00, 'Cocktails'),
  (v_id, 'Lemonade (house)',       'lemonade house',      8.00,  'Non-alcoholic'),
  (v_id, 'Water Borjomi 0.5',     'water borjomi 05',    5.00,  'Non-alcoholic'),
  (v_id, 'Fresh Juice',           'fresh juice',         9.00,  'Non-alcoholic'),
  (v_id, 'Espresso',              'espresso',            5.00,  'Hot drinks'),
  (v_id, 'Georgian Tea',          'georgian tea',        6.00,  'Hot drinks'),
  (v_id, 'Khinkali × 5',          'khinkali 5',         15.00, 'Food'),
  (v_id, 'Mtsvadi (pork)',         'mtsvadi pork',       22.00, 'Food'),
  (v_id, 'Lobiani',               'lobiani',             8.00,  'Food'),
  (v_id, 'Chips',                 'chips',               5.00,  'Snacks'),
  (v_id, 'Mixed Nuts',            'mixed nuts',          7.00,  'Snacks'),
  (v_id, 'Cheese Plate',          'cheese plate',       18.00, 'Snacks')
ON CONFLICT DO NOTHING;

SELECT id INTO p_beer_natakhtari FROM products WHERE venue_id=v_id AND search_key='natakhtari draft 05';
SELECT id INTO p_beer_kazbegi    FROM products WHERE venue_id=v_id AND search_key='kazbegi 05';
SELECT id INTO p_beer_heineken   FROM products WHERE venue_id=v_id AND search_key='heineken 033';
SELECT id INTO p_wine_rkatsiteli FROM products WHERE venue_id=v_id AND search_key='rkatsiteli glass';
SELECT id INTO p_wine_saperavi   FROM products WHERE venue_id=v_id AND search_key='saperavi glass';
SELECT id INTO p_wine_rose       FROM products WHERE venue_id=v_id AND search_key='rose glass';
SELECT id INTO p_chacha          FROM products WHERE venue_id=v_id AND search_key='chacha 50ml';
SELECT id INTO p_whisky          FROM products WHERE venue_id=v_id AND search_key='whisky jwalker 50ml';
SELECT id INTO p_gin_tonic       FROM products WHERE venue_id=v_id AND search_key='gin tonic';
SELECT id INTO p_lemonade        FROM products WHERE venue_id=v_id AND search_key='lemonade house';
SELECT id INTO p_water           FROM products WHERE venue_id=v_id AND search_key='water borjomi 05';
SELECT id INTO p_juice           FROM products WHERE venue_id=v_id AND search_key='fresh juice';
SELECT id INTO p_coffee          FROM products WHERE venue_id=v_id AND search_key='espresso';
SELECT id INTO p_tea             FROM products WHERE venue_id=v_id AND search_key='georgian tea';
SELECT id INTO p_khinkali        FROM products WHERE venue_id=v_id AND search_key='khinkali 5';
SELECT id INTO p_mtsvadi         FROM products WHERE venue_id=v_id AND search_key='mtsvadi pork';
SELECT id INTO p_lobiani         FROM products WHERE venue_id=v_id AND search_key='lobiani';
SELECT id INTO p_chips           FROM products WHERE venue_id=v_id AND search_key='chips';
SELECT id INTO p_nuts            FROM products WHERE venue_id=v_id AND search_key='mixed nuts';
SELECT id INTO p_cheese_plate    FROM products WHERE venue_id=v_id AND search_key='cheese plate';

-- ── GUESTS ────────────────────────────────────────────────────────────────────
INSERT INTO guests (venue_id, name, search_key, times_seen, last_seen_at) VALUES
  (v_id, 'Giorgi',  'giorgi',  12, now() - interval '2 hours'),
  (v_id, 'Nino',    'nino',     8, now() - interval '1 day'),
  (v_id, 'David',   'david',    5, now() - interval '3 days'),
  (v_id, 'Ana',     'ana',      3, now() - interval '5 days'),
  (v_id, 'Lasha',   'lasha',    7, now() - interval '1 hour'),
  (v_id, 'Mari',    'mari',     4, now() - interval '2 days'),
  (v_id, 'Стол 3',  'stol 3',  20, now() - interval '30 minutes'),
  (v_id, 'VIP зал', 'vip zal',  6, now() - interval '4 hours')
ON CONFLICT DO NOTHING;

SELECT id INTO g_giorgi FROM guests WHERE venue_id=v_id AND search_key='giorgi';
SELECT id INTO g_nino   FROM guests WHERE venue_id=v_id AND search_key='nino';
SELECT id INTO g_david  FROM guests WHERE venue_id=v_id AND search_key='david';
SELECT id INTO g_ana    FROM guests WHERE venue_id=v_id AND search_key='ana';
SELECT id INTO g_lasha  FROM guests WHERE venue_id=v_id AND search_key='lasha';
SELECT id INTO g_mari   FROM guests WHERE venue_id=v_id AND search_key='mari';
SELECT id INTO g_table3 FROM guests WHERE venue_id=v_id AND search_key='stol 3';
SELECT id INTO g_vip    FROM guests WHERE venue_id=v_id AND search_key='vip zal';

-- ── OPEN CHECKS ───────────────────────────────────────────────────────────────
INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, total)
VALUES (v_id, 101, 'open', g_table3, 'Стол 3',  staff1_id, now() - interval '45 minutes', 0)
RETURNING id INTO ch_open1;

INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch_open1, p_beer_natakhtari, 'Natakhtari Draft 0.5', 8.00, 3, 24.00),
  (ch_open1, p_khinkali,        'Khinkali × 5',         15.00, 2, 30.00),
  (ch_open1, p_chacha,          'Chacha 50ml',           10.00, 2, 20.00);
UPDATE checks SET total = 74.00 WHERE id = ch_open1;

INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, total)
VALUES (v_id, 102, 'open', g_lasha, 'Lasha', staff1_id, now() - interval '20 minutes', 0)
RETURNING id INTO ch_open2;

INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch_open2, p_wine_saperavi, 'Saperavi (glass)', 14.00, 2, 28.00),
  (ch_open2, p_cheese_plate,  'Cheese Plate',     18.00, 1, 18.00);
UPDATE checks SET total = 46.00 WHERE id = ch_open2;

INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, total)
VALUES (v_id, 103, 'open', g_vip, 'VIP зал', mgr_id, now() - interval '10 minutes', 0)
RETURNING id INTO ch_open3;

INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch_open3, p_whisky,      'Whisky (J.Walker) 50ml', 18.00, 3, 54.00),
  (ch_open3, p_gin_tonic,   'Gin Tonic',              16.00, 2, 32.00),
  (ch_open3, p_nuts,        'Mixed Nuts',              7.00,  2, 14.00);
UPDATE checks SET total = 100.00 WHERE id = ch_open3;

-- ── CLOSED CHECKS (архив — последние дни) ────────────────────────────────────
-- Сегодня
INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 95, 'closed', g_giorgi, 'Giorgi', staff1_id, now()-interval '6 hours', now()-interval '5 hours', 63.00, 'card')
RETURNING id INTO ch1;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch1, p_beer_natakhtari, 'Natakhtari Draft 0.5', 8.00, 3, 24.00),
  (ch1, p_wine_rkatsiteli, 'Rkatsiteli (glass)',   12.00, 2, 24.00),
  (ch1, p_chips,           'Chips',                 5.00, 3, 15.00);

INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 96, 'closed', g_nino, 'Nino', staff1_id, now()-interval '5 hours', now()-interval '4 hours', 37.00, 'cash')
RETURNING id INTO ch2;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch2, p_wine_rose,  'Rosé (glass)',   13.00, 2, 26.00),
  (ch2, p_lemonade,   'Lemonade',        8.00, 1,  8.00),
  (ch2, p_coffee,     'Espresso',        5.00, 1,  5.00) -- рядом закрытый -2 = 37 нет, пересчитаем
  ;
UPDATE checks SET total = 39.00 WHERE id = ch2;

INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 97, 'closed', g_table3, 'Стол 3', staff1_id, now()-interval '4 hours', now()-interval '3 hours', 114.00, 'card')
RETURNING id INTO ch3;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch3, p_beer_kazbegi, 'Kazbegi 0.5',     7.00, 4, 28.00),
  (ch3, p_mtsvadi,      'Mtsvadi (pork)',  22.00, 2, 44.00),
  (ch3, p_khinkali,     'Khinkali × 5',   15.00, 2, 30.00),
  (ch3, p_chacha,       'Chacha 50ml',     10.00, 1, 10.00);
UPDATE checks SET total = 112.00 WHERE id = ch3;

INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 98, 'closed', g_david, 'David', mgr_id, now()-interval '3 hours', now()-interval '2 hours', 52.00, 'cash')
RETURNING id INTO ch4;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch4, p_wine_saperavi, 'Saperavi (glass)', 14.00, 2, 28.00),
  (ch4, p_beer_heineken,  'Heineken 0.33',    9.00, 2, 18.00),
  (ch4, p_nuts,           'Mixed Nuts',        7.00, 1,  7.00);
UPDATE checks SET total = 53.00 WHERE id = ch4;

-- Вчера
INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 88, 'closed', g_ana, 'Ana', staff1_id, now()-interval '1 day 5 hours', now()-interval '1 day 4 hours', 44.00, 'card')
RETURNING id INTO ch5;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch5, p_gin_tonic,  'Gin Tonic',          16.00, 2, 32.00),
  (ch5, p_lobiani,    'Lobiani',             8.00, 1,  8.00),
  (ch5, p_water,      'Water Borjomi 0.5',   5.00, 1,  5.00);
UPDATE checks SET total = 45.00 WHERE id = ch5;

INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 89, 'closed', g_giorgi, 'Giorgi', staff1_id, now()-interval '1 day 4 hours', now()-interval '1 day 3 hours', 88.00, 'card')
RETURNING id INTO ch6;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch6, p_whisky,      'Whisky (J.Walker) 50ml', 18.00, 2, 36.00),
  (ch6, p_beer_natakhtari, 'Natakhtari Draft 0.5', 8.00, 3, 24.00),
  (ch6, p_cheese_plate,'Cheese Plate',            18.00, 1, 18.00),
  (ch6, p_chips,       'Chips',                    5.00, 2, 10.00);
UPDATE checks SET total = 88.00 WHERE id = ch6;

INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 90, 'closed', g_table3, 'Стол 3', staff1_id, now()-interval '1 day 3 hours', now()-interval '1 day 2 hours', 67.00, 'cash')
RETURNING id INTO ch7;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch7, p_wine_rkatsiteli,'Rkatsiteli (glass)', 12.00, 3, 36.00),
  (ch7, p_khinkali,        'Khinkali × 5',      15.00, 2, 30.00);
UPDATE checks SET total = 66.00 WHERE id = ch7;

-- 2 дня назад
INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 81, 'closed', g_lasha, 'Lasha', staff1_id, now()-interval '2 days 6 hours', now()-interval '2 days 5 hours', 55.00, 'card')
RETURNING id INTO ch8;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch8, p_beer_kazbegi, 'Kazbegi 0.5',    7.00, 4, 28.00),
  (ch8, p_chacha,       'Chacha 50ml',   10.00, 2, 20.00),
  (ch8, p_lobiani,      'Lobiani',        8.00, 1,  8.00);
UPDATE checks SET total = 56.00 WHERE id = ch8;

INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 82, 'closed', g_mari, 'Mari', staff1_id, now()-interval '2 days 4 hours', now()-interval '2 days 3 hours', 32.00, 'cash')
RETURNING id INTO ch9;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch9, p_wine_rose, 'Rosé (glass)',   13.00, 2, 26.00),
  (ch9, p_juice,     'Fresh Juice',     9.00, 1,  9.00);
UPDATE checks SET total = 35.00 WHERE id = ch9;

INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 83, 'closed', g_vip, 'VIP зал', mgr_id, now()-interval '2 days 2 hours', now()-interval '2 days 1 hour', 142.00, 'card')
RETURNING id INTO ch10;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch10, p_whisky,      'Whisky (J.Walker) 50ml', 18.00, 3, 54.00),
  (ch10, p_gin_tonic,   'Gin Tonic',              16.00, 3, 48.00),
  (ch10, p_cheese_plate,'Cheese Plate',            18.00, 2, 36.00);
UPDATE checks SET total = 138.00 WHERE id = ch10;

-- 5 дней назад
INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 74, 'closed', g_david, 'David', staff1_id, now()-interval '5 days 5 hours', now()-interval '5 days 4 hours', 76.00, 'card')
RETURNING id INTO ch11;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch11, p_wine_saperavi,'Saperavi (glass)', 14.00, 3, 42.00),
  (ch11, p_mtsvadi,      'Mtsvadi (pork)',   22.00, 1, 22.00),
  (ch11, p_beer_natakhtari,'Natakhtari Draft 0.5', 8.00, 1, 8.00);
UPDATE checks SET total = 72.00 WHERE id = ch11;

INSERT INTO checks (venue_id, number, status, guest_id, guest_name_snapshot, opened_by, opened_at, closed_at, total, payment_method)
VALUES (v_id, 75, 'closed', g_nino, 'Nino', staff1_id, now()-interval '5 days 3 hours', now()-interval '5 days 2 hours', 41.00, 'cash')
RETURNING id INTO ch12;
INSERT INTO check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total) VALUES
  (ch12, p_gin_tonic, 'Gin Tonic',    16.00, 1, 16.00),
  (ch12, p_lemonade,  'Lemonade',      8.00, 2, 16.00),
  (ch12, p_khinkali,  'Khinkali × 5', 15.00, 1, 15.00);
UPDATE checks SET total = 47.00 WHERE id = ch12;

-- ── PROCUREMENT (закупки) ─────────────────────────────────────────────────────
INSERT INTO procurement_orders (venue_id, title, status, created_at, closed_at)
VALUES (v_id, 'Закупка 20 марта', 'closed', now()-interval '3 days', now()-interval '3 days' + interval '2 hours')
RETURNING id INTO pr_order;

INSERT INTO procurement_items (order_id, venue_id, text, qty, is_checked) VALUES
  (pr_order, v_id, 'Natakhtari кег 30л',    '2',   true),
  (pr_order, v_id, 'Kazbegi кег 30л',       '1',   true),
  (pr_order, v_id, 'Heineken 0.33 (ящик)',  '2',   true),
  (pr_order, v_id, 'Rkatsiteli (коробка)',  '3',   true),
  (pr_order, v_id, 'Saperavi (коробка)',    '2',   true),
  (pr_order, v_id, 'Chacha Shilda 0.5л',   '6',   true),
  (pr_order, v_id, 'J.Walker Red 0.7л',    '3',   true),
  (pr_order, v_id, 'Borjomi 0.5 (ящик)',   '4',   true),
  (pr_order, v_id, 'Орехи фасованные',     '10',  true),
  (pr_order, v_id, 'Чипсы',               '20',  true);

-- Текущая открытая закупка
INSERT INTO procurement_orders (venue_id, title, status, created_at)
VALUES (v_id, 'Закупка 23 марта', 'open', now()-interval '1 hour')
RETURNING id INTO pr_order;

INSERT INTO procurement_items (order_id, venue_id, text, qty, is_checked) VALUES
  (pr_order, v_id, 'Natakhtari кег 30л',   '2',  true),
  (pr_order, v_id, 'Heineken 0.33 (ящик)', '1',  true),
  (pr_order, v_id, 'J.Walker Red 0.7л',   '4',  false),
  (pr_order, v_id, 'Gin Beefeater 0.7л',  '2',  false),
  (pr_order, v_id, 'Лимонад домашний',    '20', false),
  (pr_order, v_id, 'Сыр сулугуни 1кг',   '3',  false);

RAISE NOTICE 'Demo venue created: slug=mgzavrebi-bar';
RAISE NOTICE 'Login: giorgi.m / Password: demo1234';

END $$;
