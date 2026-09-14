-- Trusted Wang Bi corpus release generated from a fixed, independently reviewed artifact.
-- document: wang-bi-2354026-document (0b68d774-0338-5232-b0ee-683af096050e)
-- Forward-only and scoped to dao_corpus_* tables; private account data is untouched.

insert into public.dao_corpus_versions (
  corpus_version, edition, source_url, source_revision, source_sha256, license,
  review_status, manifest_path, reviewed_by, reviewed_at
) values (
  'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026',
  '2354026', '4827E5A84B37FDEAA99706B7505B3719B5EB40E2DA8E7B8A0A499944051AF611', 'CC-BY-SA-4.0',
  'approved', 'docs/redesign-v2/corpus/dao-de-jing-wang-bi-v1.release.json', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz
)
on conflict (corpus_version) do update set
  edition = excluded.edition,
  source_url = excluded.source_url,
  source_revision = excluded.source_revision,
  source_sha256 = excluded.source_sha256,
  license = excluded.license,
  review_status = excluded.review_status,
  manifest_path = excluded.manifest_path,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at;

insert into public.dao_corpus_documents (
  id, corpus_version, edition, source_url, source_revision, license, content_sha256,
  review_status, reviewed_by, reviewed_at
) values (
  '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）',
  'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0',
  '4827E5A84B37FDEAA99706B7505B3719B5EB40E2DA8E7B8A0A499944051AF611', 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz
)
on conflict (id) do update set
  corpus_version = excluded.corpus_version,
  edition = excluded.edition,
  source_url = excluded.source_url,
  source_revision = excluded.source_revision,
  license = excluded.license,
  content_sha256 = excluded.content_sha256,
  review_status = excluded.review_status,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at;

insert into public.dao_corpus_chunks (
  chunk_id, document_id, corpus_version, edition, chapter, paragraph, kind, content,
  content_sha256, source_url, source_revision, license, theme_terms,
  review_status, reviewed_by, reviewed_at
) values
  ('wang-bi-01-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 1, null, 'original', '道可道，非常道，名可名，非常名；
無名，天地之始，有名，萬物之母。
故常無欲，以觀其妙，
常有欲，以觀其徼；
此兩者，同出而異名，同謂之玄。玄之又玄，眾妙之門。', '545910F22A30F5794D03D550C0913A9A852F2F28891A51E5468EDEAED8CACC1D', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['名与实', '欲望', '视角', '玄妙']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-02-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 2, null, 'original', '天下皆知美之為美，斯惡已。皆知善之為善，斯不善已。故有無相生，難易相成，長短相較，高下相傾，音聲相和，前後相隨。
是以聖人處無為之事，
行不言之教；萬物作焉而不辭，生而不有，為而不恃，
功成而弗居。
夫唯弗居，是以不去。', '52339E1C0C2EFC80E0C4493E9640101A9FA7D6A49817EFA099403B431D4F24AB', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['对立', '美丑', '善恶', '功成不居', '谦逊']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-03-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 3, null, 'original', '不尚賢，使民不爭；不貴難得之貨，使民不為盜；不見可欲，使民心不亂。
是以聖人之治，虛其心，實其腹，
弱其志，強其骨。
常使民無知無欲。
使夫智者不敢為也。
為無為，則無不治。', '35AAD43C25DD8BFB1F1CAD27B8F789CD57382F2483C0D12AC1C4F37423710039', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['竞争', '欲望', '诱惑', '治理', '少干预']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-04-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 4, null, 'original', '道沖而用之或不盈，淵兮似萬物之宗；挫其銳，解其紛，和其光，同其塵，湛兮似或存。吾不知誰之子，象帝之先。', '3087768A581733013BA07A3FB986E042C2B3ACE946D6AFDC70167032A30340DB', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['空虚', '锋芒', '解纷', '和光同尘']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-05-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 5, null, 'original', '天地不仁，以萬物為芻狗；
聖人不仁，以百姓為芻狗。
天地之間，其猶橐籥乎？虛而不屈，動而愈出。
多言數窮，不如守中。', '22065365FB00BE516943CCC99F7ED97A67088A8017DF92F7659B11B0594504E8', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['偏爱', '公平', '情绪', '守中', '少说']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-06-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 6, null, 'original', '谷神不死，是謂玄牝。玄牝之門，是謂天地根。緜緜若存，用之不勤。', 'ACD9DEE0AB39DCD0727015774EE13BB64EC8D081FEF071BE8981DDC5D5E789CD', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['谷神', '韧性', '女性力量', '生生不息']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-07-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 7, null, 'original', '天長地久。天地所以能長且久者，以其不自生，
故能長生。是以聖人後其身而身先；外其身而身存。非以其無私邪，故能成其私。', 'F92C4D80194A6700160EB4CE10503542F823C031365D7169B1A8DA6CF81E2107', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['无私', '长久', '利他', '自我中心']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-08-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 8, null, 'original', '上善若水。水善利萬物而不爭，處眾人之所惡，
故幾於道。
居善地，心善淵，與善仁，言善信，正善治，事善能，動善時。夫唯不爭，故無尤。', '3EAF78E1FDF53D5F41C7F29107A651DB32AB7B57C86E3E626C2B3EDE6546E566', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['上善若水', '不争', '柔和', '关系边界', '沟通', '利他']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-09-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 9, null, 'original', '持而盈之，不如其已；
揣而梲之，不可長保。
金玉滿堂，莫之能守；
富貴而驕，自遺其咎。
功遂身退，天之道。', '16E2191FC66D6678506B66C9BCC27E9DF18D197BC63C287FD0BC16D606525E40', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['见好就收', '功成身退', '停止扩张', '过度', '贪心']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-10-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 10, null, 'original', '載營魄抱一，能無離乎？
專氣致柔，能嬰兒乎？
滌除玄覽，能無疵乎？
愛國治民，能無知乎？
天門開闔，能為雌乎？
明白四達，能無為乎？
生之，
畜之。
生而不有，為而不恃，長而不宰，是謂玄德。', '9D0CC050ED2E2F1A0605AE2556D6C6E61A9B31C8106F4B40FBA7CADA664DD255', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['身心合一', '专注', '照顾', '不占有', '少控制']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-11-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 11, null, 'original', '三十輻共一轂，當其無，有車之用。
埏埴以為器，當其無，有器之用。鑿戶牖以為室，當其無，有室之用。故有之以為利，無之以為用。', '990D9FA1849A6B1E2E5A7402CBFD6D8009DEE6C5404778BA14534E46D6FB6285', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['留白', '空间', '空的价值', '工具', '房间']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-12-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 12, null, 'original', '五色令人目盲，五音令人耳聾，五味令人口爽，馳騁畋獵令人心發狂，
難得之貨令人行妨。
是以聖人為腹不為目，故去彼取此。', '662605055F9834FE17A4E91FD4C06319C59F4B982F2BF5B0E88E62139A416645', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['感官诱惑', '消费欲望', '分心', '取舍']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-13-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 13, null, 'original', '寵辱若驚，貴大患若身。何謂寵辱若驚？寵為下，得之若驚，失之若驚，是謂寵辱若驚。
何謂貴大患若身？
吾所以有大患者，為吾有身，
及吾無身，
吾有何患？故貴以身為天下，若可寄天下；
愛以身為天下，若可託天下。', 'A7260A0C164D5C49AB73E3DC91B934CA141353893C637504F144EEDEC5C43916', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['别人眼光', '评价', '得失', '内耗', '自我价值', '患得患失']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-14-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 14, null, 'original', '視之不見名曰夷，聽之不聞名曰希，搏之不得名曰微。此三者，不可致詰，故混而為一。
其上不皦，其下不昧。繩繩不可名，復歸於無物。是謂無狀之狀，無物之象，
是謂惚恍。
迎之不見其首，隨之不見其後。執古之道，以御今之有。
能知古始，是謂道紀。', 'EFEC5B1E5C91FF5A438B479DCB136BE412A85D4F37776E0F16B3E277DC0260A6', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['未知', '不确定', '看不见', '规律', '追根溯源']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-15-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 15, null, 'original', '古之善為士者，微妙玄通，深不可識。夫唯不可識，故強為之容。豫焉若冬涉川，
猶兮若畏四鄰，
儼兮其若容，渙兮若冰之將釋，敦兮其若樸，曠兮其若谷，混兮其若濁。
孰能濁以靜之徐清？孰能安以久動之徐生？
保此道者不欲盈，
夫唯不盈，故能蔽不新成。', '45E306B10E2A66AEE3225FE0040F5AB6DF8101B8BEA21F0BAD20A968561CBF52', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['耐心', '谨慎', '浑浊变清', '等待', '从容']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-16-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 16, null, 'original', '致虛極，守靜篤。
萬物並作，吾以觀復。
夫物芸芸，各復歸其根。歸根曰靜，是謂復命。復命曰常，
知常曰明。不知常，妄作凶。
知常容，
容乃公，
公乃全，
全乃天，
天乃道，
道乃久，
沒身不殆。', '31ABB0A7FD3FEC96B30883C231C5D2AEB27FE531FBB862D4F79B1617C3790B3B', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['安静', '焦虑', '静心', '回归根本', '复盘', '情绪平复']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-17-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 17, null, 'original', '太上，下知有之，
其次，親而譽之，
其次，畏之，
其次，侮之。
信不足焉，有不信焉。
悠兮其貴言，功成事遂，百姓皆謂：我自然。', '87B67674D42CBC22812FEFAA50354C4229ED3AC56D048A213E668C5023A73950', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['领导力', '团队自主', '信任', '少控制', '功劳归团队']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-18-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 18, null, 'original', '大道廢，有仁義；
智慧出，有大偽；
六親不和，有孝慈；國家昏亂，有忠臣。', '9AB511584D9D90BD9BFF5EA3FC73A5C3DE265D50CC4E543686CBFDB08F86EC85', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['家庭矛盾', '亲子', '虚伪', '关系失和']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-19-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 19, null, 'original', '絕聖棄智，民利百倍；絕仁棄義，民復孝慈；絕巧棄利，盜賊無有。此三者以為文不足，故令有所屬﹕見素抱樸，少私寡欲。', 'F444AE8002D0060927C62A168B2B79BC74526ECC2FD10DCD66D6C329AADECCAB', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['简单生活', '少私寡欲', '返璞归真', '放弃聪明']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-20-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 20, null, 'original', '絕學無憂，唯之與阿，相去幾何？善之與惡，相去若何？人之所畏，不可不畏。
荒兮其未央哉﹗
眾人熙熙，如享太牢，如春登臺。
我獨泊兮其未兆，如嬰兒之未孩；
儽儽兮若無所歸。
眾人皆有餘，而我獨若遺。
我愚人之心也哉﹗
沌沌兮，
俗人昭昭，
我獨昏昏。俗人察察，
我獨悶悶。澹兮其若海，
飂兮若無止。
眾人皆有以，
而我獨頑似鄙。
我獨異於人，而貴食母。', 'DBB58D6CABD8CCCABA18DC42885988069C5CE31B3292B5049BB5DAA7648E6026', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['孤独', '合群', '从众', '独立', '迷茫', '与众不同']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-21-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 21, null, 'original', '孔德之容，惟道是從。
道之為物，惟恍惟惚。
惚兮恍兮，其中有象；恍兮惚兮，其中有物。
窈兮冥兮，其中有精；
其精甚真，其中有信。
自今及古，其名不去，
以閱眾甫。
吾何以知眾甫之狀哉？以此。', '651AA984C70F29C4C24F3BBF264FCD62BEFC7F62BDF49B1C90241DB088D88DDF', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['恍惚', '信念', '真实', '观察', '规律']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-22-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 22, null, 'original', '曲則全，
枉則直，
窪則盈，
敝則新，
少則得，多則惑。
是以聖人抱一為天下式。
不自見故明，不自是故彰，不自伐故有功，不自矜故長。夫唯不爭，故天下莫能與之爭。古之所謂曲則全者，豈虛言哉！誠全而歸之。', '78B8F6D0FAF2789EA27B7B47F09DFC8F8D4608D586EB8041DCE677C74F80FF99', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['委屈求全', '不争', '谦逊', '自以为是', '冲突']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-23-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 23, null, 'original', '希言自然。
故飄風不終朝，驟雨不終日。孰為此者？天地。天地尚不能久，而況於人乎？
故從事於道者，道者同於道，
德者同於德，
失者同於失。
同於道者，道亦樂得之；同於德者，德亦樂得之；同於失者，失亦樂得之。
信不足焉，有不信焉。', 'DDEB356C6DF3F641D8586143B5B140D5B4232647C6BD4B728C9F33926498F09F', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['少说', '自然', '信任', '短暂波动', '顺势']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-24-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 24, null, 'original', '企者不立，
跨者不行，自見者不明，自是者不彰，自伐者無功，自矜者不長。其在道也，曰餘食贅行。
物或惡之，故有道者不處。', '60BF8E130B566AC96AEE5B3FC536D2726B860726A50EA488F99E858F0AADF302', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['逞强', '炫耀', '自以为是', '急躁', '站不稳']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-25-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 25, null, 'original', '有物混成，先天地生。
寂兮寥兮，獨立而不改，
周行而不殆，可以為天下母。
吾不知其名，
字之曰道，
強為之名曰大。
大曰逝，
逝曰遠，遠曰反。
故道大，天大，地大，王亦大。
域中有四大，
而王居其一焉。
人法地，地法天，天法道，道法自然。', '26512A77C227E74D24C7BFBF04F7A10237A44A6DBFA7295347B01FC219146BDC', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['自然规律', '天地', '长远', '独立', '道法自然']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-26-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 26, null, 'original', '重為輕根，靜為躁君。
是以聖人終日行不離輜重。
雖有榮觀，燕處超然。
奈何萬乘之主，而以身輕天下？輕則失本，躁則失君。', '9F222DC9E06DA0C14DAD14C73A94815D003550D1F90DBD2D3B93B19B6048A777', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['稳重', '急躁', '优先级', '轻率', '保持根基']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-27-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 27, null, 'original', '善行無轍迹，
善言無瑕讁；
善數不用籌策；
善閉無關楗而不可開，善結無繩約而不可解。
是以聖人常善救人，故無棄人；
常善救物，故無棄物，是謂襲明。故善人者，不善人之師；
不善人者，善人之資。
不貴其師，不愛其資，雖智大迷，
是謂要妙。', '7D4CC535C1C2A1635371AD764A38E8888232049A2C888FA0DBE36C84019E7CBE', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['沟通', '不留把柄', '救人', '导师', '善用人才']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-28-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 28, null, 'original', '知其雄，守其雌，為天下谿。為天下谿，常德不離，復歸於嬰兒。
知其白，守其黑，為天下式。
為天下式，常德不忒，
復歸於無極。
知其榮，守其辱，為天下谷，常德乃足，復歸於樸。
樸散則為器，聖人用之，則為官長，
故大制不割。', '3D04F9F2D0C0CD12BC62EEAB3A9ABAA7746FF9EC9FEC04FA12EE4D67D17A8D27', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['刚柔', '荣辱', '包容', '守弱', '保持本真']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-29-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 29, null, 'original', '將欲取天下而為之，吾見其不得已。天下神器，
不可為也，為者敗之，執者失之。
故物或行或隨，或歔或吹。或強或羸，或挫或隳。是以聖人去甚，去奢，去泰。', 'D24C79FB1E63C7AC996D12DBA38D16D44BE8A0D37E7522FDF5074878FC3A3B65', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['强行掌控', '放手', '控制欲', '自然变化', '过度干预']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-30-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 30, null, 'original', '以道佐人主者，不以兵強天下。
其事好還。
師之所處，荊棘生焉。大軍之後，必有凶年。
善有果而已，不敢以取強。
果而勿矜，果而勿伐，果而勿驕。
果而不得已，果而勿強。
物壯則老，是謂不道，不道早已。', '8008A7A425760DB0C8345F83AA48A5CF30CD2C2A6262C8A33393ECF64C5FFB1F', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['武力', '强迫', '冲突', '停止扩张', '创业风险', '不得已']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-31-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 31, null, 'original', '夫佳兵者，不祥之器，物或惡之，故有道者不處。君子居則貴左，用兵則貴右。兵者不祥之器，非君子之器，不得已而用之，恬淡為上。勝而不美，而美之者，是樂殺人。夫樂殺人者，則不可以得志於天下矣。吉事尚左，凶事尚右。偏將軍居左，上將軍居右，言以喪禮處之。殺人之眾，以哀悲泣之，戰勝，以喪禮處之。', '82394F992733BB0B19B9D71136E1C721CC29A305D410B444881D1A46E1B81529', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['战争', '暴力', '胜利代价', '哀悼', '克制']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-32-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 32, null, 'original', '道常無名，樸雖小，天下莫能臣也。侯王若能守之，萬物將自賓。
天地相合，以降甘露，民莫之令而自均。
始制有名，名亦既有，夫亦將知止，知止所以不殆。
譬道之在天下，猶川谷之於江海。', 'E29BE8254D8E862C687C83C3A602422C776685EA4E141B2C9AF7397C25F17339', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['知止', '边界', '规则', '适可而止', '归顺']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-33-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 33, null, 'original', '知人者智，自知者明。
勝人者有力，自勝者強。
知足者富。
強行者有志。
不失其所者久。
死而不亡者壽。', '4B124D455734DFAEA0FD8EEC175BE2576AE5D41EE68E782C47B8246BC687B496', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['自知', '认识自己', '长处局限', '自胜', '知足', '信心']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-34-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 34, null, 'original', '大道氾兮，其可左右。
萬物恃之而生而不辭，功成不名有。衣養萬物而不為主，常無欲，可名於小；
萬物歸焉而不為主，可名為大。
以其終不自為大，故能成其大。', '40B10BC1F0701FDB10D29943DFA5633D8DAD3CF273FD3E1CCC7F62326D7B0143', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['成就不占有', '服务', '贡献', '不做主', '格局']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-35-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 35, null, 'original', '執大象，天下往。
往而不害，安平太。
樂與餌，過客止。道之出口，淡乎其無味，視之不足見，聽之不足聞，用之不足既。', '5C208DB1EA179225248D8978EED152F2732AE4CD295265B87033C5072559721A', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['吸引力', '安稳', '平淡', '感官', '长期价值']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-36-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 36, null, 'original', '將欲歙之，必固張之；將欲弱之，必固強之；將欲廢之，必固興之；將欲奪之，必固與之。是謂微明。
柔弱勝剛強。魚不可脫於淵，國之利器不可以示人。', '97599DC648180A3D537781B8C772BCD285C4A4C31E2348F5481533EE733EED83', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['柔胜刚', '策略', '时机', '先予后取', '关系边界']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-37-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 37, null, 'original', '道常無為
而無不為。
侯王若能守之，萬物將自化。化而欲作，吾將鎮之以無名之樸。
無名之樸，夫亦將無欲。
不欲以靜，天下將自定。', 'AA330A244AA572BF0B83B0D07D88488BC3CA470CCA999DE83BBB7751740CD041', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['无为', '等待', '行动时机', '不强求', '自我调节']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-38-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 38, null, 'original', '上德不德，是以有德；下德不失德，是以無德。上德無為而無以為，下德為之而有以為。上仁為之而無以為，上義為之而有以為。上禮為之而莫之應， 則攘臂而扔之。故失道而後德，失德而後仁，失仁而後義，失義而後禮。夫禮者，忠信之薄，而亂之首。前識者，道之華，而愚之始。是以大丈夫處其厚，不居其薄；處其實，不居其華。故去彼取此。', '06FF64F143ADE8A14698277DAD861E710B12D00D3DDD5B0DD57EAEE8A963894C', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['真正的德', '形式主义', '道德绑架', '忠信', '礼法']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-39-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 39, null, 'original', '昔之得一者，
天得一以清，地得一以寧，神得一以靈，谷得一以盈，萬物得一以生，侯王得一以為天下貞。其致之，
天無以清將恐裂，
地無以寧將恐發，神無以靈將恐歇，谷無以盈將恐竭，萬物無以生將恐滅，侯王無以貴高將恐蹶。故貴以賤為本，高以下為基。是以侯王自稱孤﹑寡﹑不穀。此非以賤為本邪？非乎？故致數輿無輿，不欲琭琭如玉，珞珞如石。', '558E8AC54827A92E5DE419F3A51C64D5C589811CEE3FFD16E7B5F92499572DC4', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['统一', '根基', '谦卑', '组织稳定', '高以下为基']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-40-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 40, null, 'original', '反者道之動，
弱者道之用。
天下萬物生於有，有生於無。', 'EF96EB77F1784321431B18BE146C269E6F05E0BF8CDDAA8FC65AD8FAC4BD0A7E', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['反转', '弱的力量', '有无', '变化规律']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-41-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 41, null, 'original', '上士聞道，勤而行之；
中士聞道，若存若亡；下士聞道，大笑之。不笑不足以為道。故建言有之﹕
明道若昧，
進道若退，
夷道若纇，
上德若谷，
大白若辱，
廣德若不足，
建德若偷，
質真若渝，
大方無隅，
大器晚成，
大音希聲，
大象無形，
道隱無名。夫唯道，善貸且成。', 'E615FF4B311D6E013C82D25B88CAF2A1482673CDE13929CFA8CE1D2B089CA9E2', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['被嘲笑', '坚持', '长期主义', '大器晚成', '行动']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-42-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 42, null, 'original', '道生一，一生二，二生三，三生萬物。萬物負陰而抱陽，沖氣以為和。人之所惡，唯孤﹑寡﹑不穀，而王公以為稱。故物或損之而益，或益之而損。
人之所教，我亦教之。
強梁者不得其死，吾將以為教父。', 'F4AE6540050E1D9EC99CBB4457A20947F19CA2FD55A8426066606D0749C53B6A', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['阴阳平衡', '得失', '损益', '孤独', '强横']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-43-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 43, null, 'original', '天下之至柔，馳騁天下之至堅。
無有入無間，吾是以知無為之有益。
不言之教，無為之益，天下希及之。', '861C824EB67DBB93369A08B2B2AB992860B03AFCBD42FCF7CF8A25B44C0113B3', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['以柔克刚', '无为', '不言之教', '无形影响']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-44-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 44, null, 'original', '名與身孰親？
身與貨孰多？
得與亡孰病？
是故甚愛必大費，多藏必厚亡，
知足不辱，知止不殆，可以長久。', '1CE27A3A9D3CB749AF8D37E947B893D3982EAE3CBE43B9271F5C2AABFC3D3A35', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['名利取舍', '健康', '止损', '知足', '内耗', '患得患失']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-45-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 45, null, 'original', '大成若缺，其用不弊。
大盈若沖，其用不窮。
大直若屈，其用不居。
大巧若拙，其用不輟。
大辯若訥，其用不差。
躁勝寒，靜勝熱。清靜為天下正。', '15317E360E11CCCB2D4828104FA8CE0CA8EEB711D032A43DC6546666D46D8C33', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['不完美', '笨拙', '安静', '躁动', '接受缺憾']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-46-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 46, null, 'original', '天下有道，卻走馬以糞。
天下無道，戎馬生於郊。
禍莫大於不知足；咎莫大於欲得。故知足之足，常足矣。', 'D35C1E41E135A25D86F1B99244ADB9974960BA80A8419335D2D5CBF43902EDA0', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['欲望', '知足', '攀比', '焦虑', '贪得无厌']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-47-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 47, null, 'original', '不出戶，知天下；不闚牖，見天道。
其出彌遠，其知彌少。
是以聖人不行而知，不見而名，
不為而成。', '785B454E16178176166573D82E2EAD8224ADBA9566098BB842DFEF30417A0356', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['向内求', '专注', '减少信息', '足不出户', '洞察']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-48-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 48, null, 'original', '為學日益，
為道日損。
損之又損，以至於無為。無為而無不為。
取天下常以無事，
及其有事，
不足以取天下。', '7CC5BE5E8FFBBBA818A78459C9F1EDF89CBEE6B717F52AE8CD94560F4906F8A7', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['做减法', '放下', '学习焦虑', '无为', '减少控制']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-49-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 49, null, 'original', '聖人無常心，以百姓心為心。
善者，吾善之；不善者，吾亦善之，
德善。
信者，吾信之；不信者，吾亦信之，德信。聖人在天下歙歙，為天下渾其心，
百姓皆注其耳目,
聖人皆孩之。', 'CFB0E3306C45080A8FD88EF75AE848DABB821C1B712581A066685F1F3F85B4A3', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['同理心', '信任', '包容', '换位思考', '人际关系']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-50-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 50, null, 'original', '出生入死。
生之徒，十有三；死之徒，十有三；人之生，動之死地，亦十有三。夫何故？以其生生之厚。蓋聞善攝生者，陸行不遇兕虎，入軍不被甲兵；兕無所投其角，虎無所措其爪，兵無所容其刃。夫何故？以其無死地。', '3ABC4CDA4FB956E73F5B02EE88EED0C79B65030094582FD843DCFA5AAF5DBEE7', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['生命风险', '怕死', '冒险', '保命', '过度求生']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-51-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 51, null, 'original', '道生之，德畜之，物形之，勢成之。
是以萬物莫不尊道而貴德。
道之尊，德之貴，夫莫之命而常自然。
故道生之，德畜之。長之育之，亭之毒之，蓋之覆之。
生而不有，為而不恃，
長而不宰。是謂玄德。', '41DE0E5F6E57750CDE1AA2FF7D520DD1EC2D06FF3A91AA5AD38320240D1AE204', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['养育', '不占有', '父母', '领导', '支持成长']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-52-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 52, null, 'original', '天下有始，以為天下母。
既得其母，以知其子，既知其子，復守其母，沒身不殆。
塞其兌，閉其門，
終身不勤。
開其兌，濟其事，終身不救。
見小曰明，守柔曰強。
用其光，
復歸其明，
無遺身殃，是為習常。', '5BD097D65BE9B948A3540F5F45D95E536C8050A8842B43B759A2C4D22D7ACCF6', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['回到源头', '守住边界', '关闭干扰', '敏锐', '自我保护']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-53-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 53, null, 'original', '使我介然有知，行於大道，唯施是畏。
大道甚夷，而民好徑。
朝甚除，
田甚蕪，倉甚虛；
服文綵，帶利劍，厭飲食，財貨有餘；是為盜夸。非道也哉！', '2C10999C7EEBA83F5EEE4A74832513A7CFCE7A1A4F79AE1C58F06A17E0FF2138', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['走捷径', '偏离正道', '奢侈', '贪腐', '组织问题']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-54-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 54, null, 'original', '善建者不拔，
善抱者不脫，
子孫以祭祀不輟。
修之於身，其德乃真；修之於家，其德乃餘；
修之於鄉，其德乃長；修之於國，其德乃豐；修之於天下，其德乃普。故以身觀身，以家觀家，以鄉觀鄉，以國觀國，
以天下觀天下。
吾何以知天下然哉？以此。', '8ED22015057C05F67F7ABD409557D22CB2834376DA56BCCF4E32B188C69FF187', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['扎根', '家庭建设', '组织文化', '长期积累', '以身作则']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-55-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 55, null, 'original', '含德之厚，比於赤子。蜂蠆虺蛇不螫，猛獸不據，攫鳥不搏。
骨弱筋柔而握固。
未知牝牡之合而全作，
精之至也。終日號而不嗄，
和之至也。知和曰常，
知常曰明。
益生曰祥。
心使氣曰強。
物壯則老，謂之不道，不道早已。', 'F9976B577265AE53A5BBAB04BA2BBEF20FC406AA74EEC19E85A10F1DE82A435E', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['婴儿', '柔软', '生命力', '和谐', '不逞强']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-56-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 56, null, 'original', '知者不言，
言者不知。
塞其兌，閉其門，挫其銳，
解其分，
和其光，
同其塵，
是謂玄同。故不可得而親，不可得而疏；
不可得而利，不可得而害；
不可得而貴，不可得而賤。
故為天下貴。', 'EE9CF29A85ADD6B32D880E719A0D195DFA8B237AF04E56FB51D3E7C6D4B2D4D5', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['沉默', '少说', '亲疏边界', '利益关系', '和光同尘']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-57-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 57, null, 'original', '以正治國，以奇用兵，以無事取天下。
吾何以知其然哉？以此。天下多忌諱，而民彌貧；民多利器，國家滋昬；
人多伎巧，奇物滋起；
法令滋彰，盜賊多有。
故聖人云﹕「我無為而民自化，我好靜而民自正，我無事而民自富，我無欲而民自樸。」', '8F6C922B263B9EF4AB02DD45187A0CF228726D6FECDF07A8CFC70CF23353BA50', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['少干预', '团队管理', '制度', '自主', '简单治理']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-58-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 58, null, 'original', '其政悶悶，其民淳淳；
其政察察，其民缺缺。
禍兮福之所倚，福兮禍之所伏。孰知其極？其無正。
正復為奇，
善復為妖。
人之迷，其日固久。
是以聖人方而不割，
廉而不劌，
直而不肆，
光而不燿。', 'C81548A476C333BEF6457CE891D6D7AE1BD36EAE3DF3F14F34059754294D5EAE', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['祸福相依', '不确定性', '宽容', '不走极端', '变化']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-59-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 59, null, 'original', '治人事天，莫若嗇。
夫唯嗇，是謂早服；
早服謂之重積德；
重積德則無不克，無不克則莫知其極；
莫知其極，可以有國；
有國之母，可以長久；
是謂深根固柢，長生久視之道。', 'C06A5EDF4B19B558A77BC9AC2507E28647E99C8470265CABB8E3BBC36E5FB825', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['节制', '积累', '预防', '长期根基', '管理']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-60-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 60, null, 'original', '治大國，若烹小鮮。
以道莅天下，其鬼不神；
非其鬼不神，其神不傷人；
非其神不傷人，聖人亦不傷人。
夫兩不相傷，故德交歸焉。', 'C52FD613A8A41FBCD3B100E0CD7A5BC13931A5504B8837CB737E267E6CD06C39', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['治大国若烹小鲜', '管理团队', '少折腾', '谨慎治理']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-61-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 61, null, 'original', '大國者下流，
天下之交。
天下之牝，
牝常以靜勝牡，以靜為下。
故大國以下小國，
則取小國；
小國以下大國，則取大國。
故或下以取，或下而取。
大國不過欲兼畜人，小國不過欲入事人。夫兩者各得其所欲，大者宜為下。', '2AFB3D0EDEB475C5806231D6E799CBFEEF3803C13324157CEE3178881646B652', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['谦下', '合作', '谈判', '伙伴关系', '大国小国']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-62-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 62, null, 'original', '道者萬物之奧。
善人之寶，
不善人之所保。
美言可以市，尊行可以加人。
人之不善，何棄之有？
故立天子，置三公，
雖有拱璧以先駟馬，不如坐進此道。
古之所以貴此道者何？不曰以求得，有罪以免邪？故為天下貴。', 'DE38B17AA85AFDA8DC1E44D068F6FAA90B9F0E683B7339682D7B4DB2601393A1', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['给人机会', '宽恕', '改过', '包容错误', '不抛弃']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-63-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 63, null, 'original', '為無為，事無事，味無味。
大小多少，報怨以德。
圖難於其易，為大於其細；天下難事必作於易，天下大事必作於細。是以聖人終不為大，故能成其大。夫輕諾必寡信，多易必多難。是以聖人猶難之，
故終無難矣', '9D3E6A60DA890E22EEAF36C5F8855EDBA6DAD420593046A0BF2BAF8A65D8F6A4', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['从小处做', '复杂任务', '执行', '轻诺', '困难分解', '报怨以德']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-64-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 64, null, 'original', '其安易持，其未兆易謀。
其脆易泮，其微易散。
為之於未有，
治之於未亂。
合抱之木，生於毫末；九層之臺，起於累土；千里之行，始於足下。為者敗之，執者失之。
是以聖人無為故無敗，無執故無失。民之從事，常於幾成而敗之。
慎終如始，則無敗事。是以聖人欲不欲，不貴難得之貨；
學不學，復眾人之所過。
以輔萬物之自然，而不敢為。', 'B819A2B8DA54B479867F23E86CBF9CC7DF21097E7D10CCB36A70874616285BFA', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['防患未然', '开始行动', '从零开始', '慎终如始', '项目执行', '坚持到底']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-65-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 65, null, 'original', '古之善為道者，非以明民，將以愚之。
民之難治，以其智多。
故以智治國，國之賊，
不以智治國，國之福。知此兩者亦稽式。常知稽式，是謂玄德。玄德深矣，遠矣，
與物反矣，
然後乃至大順。', 'DB7B190A13B35DF7ADF4C57F8FC91F868BEBCCEB2EA3430407D6E6F0DF2E8F71', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['反对卖弄', '简单治理', '聪明反被聪明误', '民智', '制度']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-66-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 66, null, 'original', '江海所以能為百谷王者，以其善下之，故能為百谷王。是以欲上民，必以言下之。欲先民，必以身後之。是以聖人處上而民不重，處前而民不害。是以天下樂推而不厭，以其不爭，故天下莫能與之爭。', '28FE9A3CD1533240E907153433816B5CF788D353ED7C030BC4F13D7287296CC0', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['领导在后', '谦下', '不压人', '团队拥护', '海纳百川']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-67-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 67, null, 'original', '天下皆謂我道大，似不肖。夫唯大，故似不肖。若肖，久矣其細也夫！
我有三寶，持而保之。一曰慈，二曰儉，三曰不敢為天下先。
慈故能勇，
儉故能廣，
不敢為天下先，故能成器長。
今舍慈且勇，
舍儉且廣，舍後且先，死矣！
夫慈以戰則勝，
以守則固。天將救之，以慈衛之。', '22612AD7C94C75EB94A098FE4B3FA5121B49DE9F65E268252B5E7898A3B32976', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['慈爱', '节俭', '不争先', '勇气', '领导原则']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-68-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 68, null, 'original', '善為士者不武，
善戰者不怒，
善勝敵者不與，
善用人者為之下，是謂不爭之德，是謂用人之力，
是謂配天古之極。', 'B447FB7EC2D10F12822F808AFA0868CF6F4DB4B6728055BB4A6576E5BDD08CBD', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['不争', '善战', '用人', '团队合作', '同事冲突']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-69-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 69, null, 'original', '用兵有言﹕「吾不敢為主而為客，不敢進寸而退尺。」是謂行無行，
攘無臂，扔無敵，
執無兵。
禍莫大於輕敵，輕敵幾喪吾寶。
故抗兵相加，哀者勝矣。', 'E3EDFF2380D487BF20005C086B424935835C3B78366AC9721F0E369D66752CCC', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['冲突', '退让', '轻敌', '哀兵', '防守']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-70-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 70, null, 'original', '吾言甚易知，甚易行。天下莫能知，莫能行。
言有宗，事有君。
夫唯無知，是以不我知。
知我者希，則我者貴。
是以聖人被褐懷玉。', 'EE1F836097B316B51450D417B5D6DB951117517068882F814C5425D7B3E68015', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['不被理解', '知行', '说到做到', '朴素', '少数人']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-71-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 71, null, 'original', '知不知上，不知知病。
夫唯病病，是以不病。聖人不病，以其病病，是以不病。', 'F22445A11DF185B41E3ED9EA1D77F40DC884485989B0C5D5A92A84592E316B56', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['承认无知', '认知局限', '自省', '不知道', '避免错误']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-72-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 72, null, 'original', '民不畏威，則大威至。無狎其所居，無厭其所生。
夫唯不厭，
是以不厭。
是以聖人自知不自見，
自愛不自貴；
故去彼取此。', '4F53057675F5B9382ED89E83DEA658ED552A92A88150FC2CA23D9A6AB3D5C652', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['压迫', '生存空间', '自尊', '不自厌', '边界']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-73-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 73, null, 'original', '勇於敢則殺，
勇於不敢則活。
此兩者，或利或害。
天之所惡，孰知其故？是以聖人猶難之。
天之道，不爭而善勝，
不言而善應，
不召而自來，
繟然而善謀。
天網恢恢，疏而不失。', 'B2BD89121AB4C578055F71E1471C8FD3FEA801F3B35FD9F8B5A6CED17620A1DB', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['勇气', '风险决策', '公平', '天网', '不确定']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-74-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 74, null, 'original', '民不畏死，奈何以死懼之？若使民常畏死，而為奇者，吾得執而殺之，孰敢？
常有司殺者殺，夫代司殺者殺，是謂代大匠斲。
夫代大匠斲者，希有不傷其手矣。', '285C95D1A6EA6271AEFFA8DB6EABB0A0919EC7FD18B6DD2F4CF6737ECABCFF24', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['惩罚', '恐惧管理', '越俎代庖', '制度边界']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-75-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 75, null, 'original', '民之饑，以其上食稅之多，是以饑。民之難治，以其上之有為，是以難治。民之輕死，以其上求生之厚，是以輕死。夫唯無以生為者，是賢於貴生。', '8642DDF605C9CE24C68EFCE21D00CED4A1C2F3169A8779FA3D88C1B24B39A5F5', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['税负', '民生', '组织负担', '过度管理', '求生']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-76-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 76, null, 'original', '人之生也柔弱，其死也堅強。
萬物草木之生也柔脆，其死也枯槁。
故堅強者死之徒，柔弱者生之徒。
是以兵強則不勝，
木強則兵。
強大處下，
柔弱處上。', 'F6702DEEDAEB898EB131983835DC8D5404FC82D66BCD0C88FA8EDD8835A47D13', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['柔软', '韧性', '僵化', '生命力', '以柔克刚']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-77-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 77, null, 'original', '天之道，其猶張弓與？高者抑之，下者舉之；有餘者損之，不足者補之。天之道，損有餘而補不足。
人之道則不然，
損不足以奉有餘。
孰能有餘以奉天下？唯有道者。
是以聖人為而不恃，功成而不處，其不欲見賢。', 'EBBE9D7D325685B8F10CCADBB685561274DA76B91AFA12FE57B09BC5FA3B0374', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['公平分配', '贫富', '平衡', '减少过剩', '补不足']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-78-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 78, null, 'original', '天下莫柔弱於水，而攻堅強者，莫之能勝，其無以易之。
弱之勝強，柔之勝剛，天下莫不知莫能行。是以聖人云﹕「受國之垢，是謂社稷主；受國不祥，是為天下王。」正言若反。', 'E7F92300EC33556E86A9FC6604160E1B39D59F09BB663DF85C58954ECF37E937', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['水的力量', '承担责任', '柔弱胜刚强', '受委屈', '真话逆耳']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-79-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 79, null, 'original', '和大怨，必有餘怨，
安可以為善？是以聖人執左契，
而不責於人。有德司契，
無德司徹。
天道無親，常與善人。', '24469A2E50D9BD38E4597C619DF41AEF62BF7D5221D0B0B7BA5E350CC2031744', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['化解怨恨', '和解', '公平', '契约', '关系修复']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-80-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 80, null, 'original', '小國寡民，
使有什伯之器而不用，
使民重死而不遠徙。
雖有舟輿，無所乘之；雖有甲兵，無所陳之。
使人復結繩而用之，甘其食，美其服，安其居，樂其俗。鄰國相望，雞犬之聲相聞，民至老死，不相往來。', 'F8B31B92E36250E82E1E9190BF2024F70F5EFCD8D3EAA500131525CFCA6767F2', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['简单生活', '知足', '少迁徙', '社区', '减少欲望']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz),
  ('wang-bi-81-original', '0b68d774-0338-5232-b0ee-683af096050e', 'dao-de-jing-wang-bi-v1', '道德經（王弼本·維基文庫固定版本2354026）', 81, null, 'original', '信言不美，
美言不信。
善者不辯，辯者不善。
知者不博，
博者不知。
聖人不積，
既以為人己愈有，
既以與人己愈多。
天之道，利而不害；
聖人之道，為而不爭。', '75796AB910ECCFB98491D20862859F8C2BD4ABC35C7F3F80ED3E77DE78278405', 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026', '2354026', 'CC-BY-SA-4.0', array['诚实表达', '善言', '不争辩', '分享', '助人', '不争']::text[], 'approved', 'independent_classics_reviewer:classics_corpus_review', '2026-09-14T21:08:11.788Z'::timestamptz)
on conflict (chunk_id) do update set
  document_id = excluded.document_id,
  corpus_version = excluded.corpus_version,
  edition = excluded.edition,
  chapter = excluded.chapter,
  paragraph = excluded.paragraph,
  kind = excluded.kind,
  content = excluded.content,
  content_sha256 = excluded.content_sha256,
  source_url = excluded.source_url,
  source_revision = excluded.source_revision,
  license = excluded.license,
  theme_terms = excluded.theme_terms,
  review_status = excluded.review_status,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at;

do $$
declare
  actual_chunks integer;
  actual_approved integer;
  actual_chapters integer;
  actual_documents integer;
begin
  select count(*), count(*) filter (where review_status = 'approved'), count(distinct chapter)
    into actual_chunks, actual_approved, actual_chapters
    from public.dao_corpus_chunks
    where corpus_version = 'dao-de-jing-wang-bi-v1';
  select count(*) into actual_documents
    from public.dao_corpus_documents
    where corpus_version = 'dao-de-jing-wang-bi-v1';
  if actual_chunks <> 81
    or actual_approved <> 81
    or actual_chapters <> 81
    or actual_documents <> 1
    or not exists (
      select 1 from public.dao_corpus_versions
      where corpus_version = 'dao-de-jing-wang-bi-v1' and review_status = 'approved'
    ) then
    raise exception 'CORPUS_POSTCONDITION_FAILED version=% chunks=% approved=% chapters=% documents=%',
      'dao-de-jing-wang-bi-v1', actual_chunks, actual_approved, actual_chapters, actual_documents;
  end if;
end $$;
