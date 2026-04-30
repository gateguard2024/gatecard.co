-- ─────────────────────────────────────────────────────────────────────────────
-- Demo seed: Parkview Apartments (48 units)
-- Slug: parkview-demo  →  gatecard.co/parkview-demo
-- Generated from property_48_units_split_names.csv
-- Phone numbers converted to E.164 (+1 prefix, dashes removed)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Site
insert into sites (slug, name, address, city, state, leasing_phone, active)
values (
  'parkview-demo',
  'Parkview Apartments',
  '4820 Roswell Road NE',
  'Atlanta',
  'GA',
  '+14045550120',
  true
)
on conflict (slug) do nothing;

-- 2. Residents (48 units from CSV)
do $$
declare
  sid uuid;
begin
  select id into sid from sites where slug = 'parkview-demo';

  insert into residents (site_id, unit_number, first_name, last_name, phone, email) values
  (sid, '101', 'John',      'Brown',      '+15555550010', 'john.brown88@example.com'),
  (sid, '102', 'Mark',      'Martin',     '+15555550011', 'mark.martin11@example.com'),
  (sid, '103', 'Paul',      'King',       '+15555550012', 'paul.king88@example.com'),
  (sid, '104', 'Nancy',     'Taylor',     '+15555550013', 'nancy.taylor99@example.com'),
  (sid, '105', 'David',     'Campbell',   '+15555550014', 'david.campbell83@example.com'),
  (sid, '106', 'Daniel',    'Hall',       '+15555550015', 'daniel.hall19@example.com'),
  (sid, '107', 'Robert',    'Scott',      '+15555550016', 'robert.scott80@example.com'),
  (sid, '108', 'Sandra',    'Hill',       '+15555550017', 'sandra.hill14@example.com'),
  (sid, '109', 'Michael',   'Walker',     '+15555550018', 'michael.walker70@example.com'),
  (sid, '110', 'Amanda',    'Robinson',   '+15555550019', 'amanda.robinson35@example.com'),
  (sid, '111', 'Amanda',    'Rodriguez',  '+15555550020', 'amanda.rodriguez78@example.com'),
  (sid, '112', 'Charles',   'Williams',   '+15555550021', 'charles.williams50@example.com'),
  (sid, '201', 'William',   'Garcia',     '+15555550022', 'william.garcia29@example.com'),
  (sid, '202', 'Charles',   'Brown',      '+15555550023', 'charles.brown89@example.com'),
  (sid, '203', 'Dorothy',   'Rivera',     '+15555550024', 'dorothy.rivera14@example.com'),
  (sid, '204', 'Joseph',    'Hall',       '+15555550025', 'joseph.hall92@example.com'),
  (sid, '205', 'Andrew',    'Jackson',    '+15555550026', 'andrew.jackson51@example.com'),
  (sid, '206', 'Betty',     'Hernandez',  '+15555550027', 'betty.hernandez93@example.com'),
  (sid, '207', 'Patricia',  'Hall',       '+15555550028', 'patricia.hall34@example.com'),
  (sid, '208', 'Donald',    'Hill',       '+15555550029', 'donald.hill83@example.com'),
  (sid, '209', 'Mark',      'Lee',        '+15555550030', 'mark.lee20@example.com'),
  (sid, '210', 'Karen',     'Allen',      '+15555550031', 'karen.allen56@example.com'),
  (sid, '211', 'Susan',     'Allen',      '+15555550032', 'susan.allen17@example.com'),
  (sid, '212', 'Nancy',     'Davis',      '+15555550033', 'nancy.davis43@example.com'),
  (sid, '301', 'Dorothy',   'Hernandez',  '+15555550034', 'dorothy.hernandez59@example.com'),
  (sid, '302', 'Amanda',    'Lee',        '+15555550035', 'amanda.lee70@example.com'),
  (sid, '303', 'Donna',     'Nguyen',     '+15555550036', 'donna.nguyen20@example.com'),
  (sid, '304', 'Michelle',  'Adams',      '+15555550037', 'michelle.adams73@example.com'),
  (sid, '305', 'James',     'Gonzalez',   '+15555550038', 'james.gonzalez80@example.com'),
  (sid, '306', 'Paul',      'Martin',     '+15555550039', 'paul.martin85@example.com'),
  (sid, '307', 'Lisa',      'Martinez',   '+15555550040', 'lisa.martinez10@example.com'),
  (sid, '308', 'Joseph',    'Flores',     '+15555550041', 'joseph.flores86@example.com'),
  (sid, '309', 'Anthony',   'Garcia',     '+15555550042', 'anthony.garcia52@example.com'),
  (sid, '310', 'Joseph',    'Brown',      '+15555550043', 'joseph.brown29@example.com'),
  (sid, '311', 'Mary',      'Baker',      '+15555550044', 'mary.baker17@example.com'),
  (sid, '312', 'Sandra',    'Moore',      '+15555550045', 'sandra.moore52@example.com'),
  (sid, '401', 'Jessica',   'Jackson',    '+15555550046', 'jessica.jackson96@example.com'),
  (sid, '402', 'Elizabeth', 'Martinez',   '+15555550047', 'elizabeth.martinez69@example.com'),
  (sid, '403', 'Steven',    'Mitchell',   '+15555550048', 'steven.mitchell14@example.com'),
  (sid, '404', 'Lisa',      'King',       '+15555550049', 'lisa.king99@example.com'),
  (sid, '405', 'Lisa',      'Wright',     '+15555550050', 'lisa.wright88@example.com'),
  (sid, '406', 'Jessica',   'Young',      '+15555550051', 'jessica.young42@example.com'),
  (sid, '407', 'Karen',     'Johnson',    '+15555550052', 'karen.johnson45@example.com'),
  (sid, '408', 'Carol',     'Thompson',   '+15555550053', 'carol.thompson45@example.com'),
  (sid, '409', 'Patricia',  'Campbell',   '+15555550054', 'patricia.campbell62@example.com'),
  (sid, '410', 'Ashley',    'Robinson',   '+15555550055', 'ashley.robinson62@example.com'),
  (sid, '411', 'James',     'Thompson',   '+15555550056', 'james.thompson99@example.com'),
  (sid, '412', 'John',      'Williams',   '+15555550057', 'john.williams37@example.com')
  on conflict do nothing;
end;
$$;
