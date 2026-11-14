"""Build a small, traceable offline catalog from the official USDA CSV archive.
No nutrition values are supplied by an LLM or copied from secondary websites.
"""
import csv, io, zipfile, json, hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
archive_path=root/'artifacts/food-assets/usda-sr-legacy.zip'
archive=zipfile.ZipFile(archive_path)
def rows(name):
    entry=next(x for x in archive.namelist() if x.endswith('/'+name))
    return csv.DictReader(io.TextIOWrapper(archive.open(entry),encoding='utf-8-sig'))
# id, translated name, weighing state, category, visual group.
selected=[
 (171477,'去皮鸡胸肉 · 烤熟','cooked','优质蛋白','chicken'),
 (171478,'去皮鸡胸肉 · 炖熟','cooked','优质蛋白','chicken'),
 (173424,'鸡蛋 · 水煮全蛋','cooked','优质蛋白','eggs'),
 (171287,'鸡蛋 · 生全蛋','raw','优质蛋白','eggs'),
 (172183,'蛋清 · 生','raw','优质蛋白','eggwhite'),
 (174030,'牛肉糜 · 90% 瘦肉 · 生','raw','优质蛋白','beef'),
 (174031,'牛肉糜 · 90% 瘦肉 · 烤熟','cooked','优质蛋白','beef'),
 (172173,'西冷牛肉 · 去可见脂肪 · 生','raw','优质蛋白','beef'),
 (172170,'西冷牛肉 · 去可见脂肪 · 烤熟','cooked','优质蛋白','beef'),
 (175167,'大西洋三文鱼 · 养殖 · 生','raw','优质蛋白','salmon'),
 (175168,'大西洋三文鱼 · 养殖 · 烤熟','cooked','优质蛋白','salmon'),
 (175180,'虾仁 · 熟','cooked','优质蛋白','shrimp'),
 (173709,'金枪鱼罐头 · 水浸沥干','packaged','优质蛋白','tuna'),
 (172475,'硬豆腐 · 硫酸钙凝固 · 未烹调','raw','豆类乳品','tofu'),
 (171269,'脱脂牛奶 · 强化维生素 A/D','packaged','豆类乳品','milk'),
 (171267,'低脂牛奶 · 2% 脂肪 · 强化 A/D','packaged','豆类乳品','milk'),
 (170894,'希腊酸奶 · 原味脱脂','packaged','豆类乳品','yogurt'),
 (169283,'毛豆 · 水煮无盐','cooked','豆类乳品','edamame'),
 (169757,'白米饭 · 长粒米 · 无盐','cooked','主食碳水','rice'),
 (169756,'白米 · 长粒米 · 生','raw','主食碳水','rice'),
 (169704,'糙米饭 · 长粒米','cooked','主食碳水','rice'),
 (169703,'糙米 · 长粒米 · 生','raw','主食碳水','rice'),
 (173904,'原味燕麦片 · 干','raw','主食碳水','oats'),
 (173905,'燕麦粥 · 清水煮无盐','cooked','主食碳水','oatmeal'),
 (168482,'红薯 · 生','raw','主食碳水','sweetpotato'),
 (168484,'红薯 · 去皮水煮无盐','cooked','主食碳水','sweetpotato'),
 (170440,'土豆 · 去皮水煮无盐','cooked','主食碳水','potato'),
 (169999,'甜玉米粒 · 水煮无盐','cooked','主食碳水','corn'),
 (169998,'甜玉米粒 · 生','raw','主食碳水','corn'),
 (172688,'全麦面包 · 商售通用条目','packaged','主食碳水','bread'),
 (168928,'意大利面 · 清水煮无盐','cooked','主食碳水','pasta'),
 (168927,'意大利面 · 干','raw','主食碳水','pasta'),
 (168917,'藜麦 · 煮熟','cooked','主食碳水','quinoa'),
 (168874,'藜麦 · 生','raw','主食碳水','quinoa'),
 (173944,'香蕉 · 去皮可食部','raw','蔬菜水果','banana'),
 (171688,'苹果 · 带皮可食部','raw','蔬菜水果','apple'),
 (171705,'牛油果 · 去皮去核可食部','raw','蔬菜水果','avocado'),
 (169967,'西兰花 · 水煮沥干无盐','cooked','蔬菜水果','broccoli'),
 (170379,'西兰花 · 生','raw','蔬菜水果','broccoli'),
 (168462,'菠菜 · 生','raw','蔬菜水果','spinach'),
 (168463,'菠菜 · 水煮沥干无盐','cooked','蔬菜水果','spinach'),
 (170457,'番茄 · 生','raw','蔬菜水果','tomato'),
 (168409,'黄瓜 · 带皮生','raw','蔬菜水果','cucumber'),
 (170567,'杏仁 · 原味','raw','坚果油脂','almond'),
 (170187,'核桃仁 · 原味','raw','坚果油脂','walnut'),
 (172470,'花生酱 · 顺滑无盐','packaged','坚果油脂','peanutbutter'),
 (171413,'橄榄油','packaged','坚果油脂','oliveoil'),
 (171890,'黑咖啡 · 冲煮无糖无奶','cooked','饮品','coffee'),
]
ids={str(x[0]) for x in selected}
foods={r['fdc_id']:r for r in rows('food.csv') if r['fdc_id'] in ids}
assert len(foods)==len(selected), 'A selected USDA record is missing'
mapping={'1008':'kcal','1003':'protein','1005':'carbs','1004':'fat','1079':'fiber','1093':'sodium','1087':'calcium','1089':'iron','1095':'zinc','1090':'magnesium','1092':'potassium','1162':'vitaminC','1114':'vitaminD'}
values={fid:{k:None for k in mapping.values()} for fid in ids}
for r in rows('food_nutrient.csv'):
    if r['fdc_id'] in ids and r['nutrient_id'] in mapping:
        # Preserve a missing amount as unknown, never replace it with zero.
        values[r['fdc_id']][mapping[r['nutrient_id']]]=float(r['amount']) if r['amount'].strip() else None
portions={fid:[] for fid in ids}
translations={'large':'大号','medium':'中等','small':'小号','extra large':'特大号','jumbo':'超大号','cup':'量杯','slice':'片','tablespoon':'汤匙','tbsp':'汤匙','teaspoon':'茶匙','tsp':'茶匙','oz':'盎司','fl oz':'液量盎司','egg':'鸡蛋','banana':'香蕉','apple':'苹果','whole':'整个','chopped':'切碎','sliced':'切片','mashed':'压泥','cubes':'切块','shelled':'去壳','drained':'沥干','nfs':'大小未注明'}
for r in rows('food_portion.csv'):
    if r['fdc_id'] not in ids or not r['gram_weight']:continue
    label=(r.get('modifier') or r.get('portion_description') or '').strip()
    if not label or 'yield' in label.lower() or 'with shell' in label.lower() or float(r['gram_weight'])<=0:continue
    translated=label.lower()
    for old,new in sorted(translations.items(),key=lambda x:-len(x[0])):translated=translated.replace(old,new)
    amount=float(r['amount']) if r['amount'] else 1
    portions[r['fdc_id']].append({'label':f'{amount:g} {translated}','originalLabel':label,'grams':float(r['gram_weight']),'sourcePortionId':r['id']})
entries=[]
for fid,name,state,category,visual in selected:
    k=str(fid);desc=foods[k]['description']
    entries.append({'id':f'usda-sr-{fid}','name':name,'state':state,'category':category,'visualGroup':visual,
     'source':f'USDA FoodData Central · SR Legacy 2018 · FDC {fid}',
     'sourceUrl':f'https://fdc.nal.usda.gov/food-details/{fid}/nutrients','sourceDescription':desc,'per100':values[k],
     'portions':portions[k][:5]})
result={'version':1,'dataset':'USDA FoodData Central SR Legacy, April 2018','license':'CC0-1.0','sourceUrl':'https://fdc.nal.usda.gov/download-datasets/','archiveSha256':hashlib.sha256(archive_path.read_bytes()).hexdigest(),'note':'一般食物平均参考值，不等同于具体品牌或实际菜肴；可食部克重。烹调油、盐和酱料另记。','foods':entries}
dest=root/'dist/foods.json';dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Built {len(entries)} traced USDA foods with six core and seven optional nutrients.')
print('Portion examples:',json.dumps({e['name']:e['portions'][:2] for e in entries if e['visualGroup'] in ['banana','eggs','rice']},ensure_ascii=False))
