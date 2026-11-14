import csv, io, zipfile, re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
archive=zipfile.ZipFile(root/'artifacts/food-assets/usda-sr-legacy.zip')
def rows(name):
    entry=next(x for x in archive.namelist() if x.endswith('/'+name))
    return csv.DictReader(io.TextIOWrapper(archive.open(entry),encoding='utf-8-sig'))
patterns=[r'chicken, broilers or fryers, breast, (meat only|skinless)',r'rice, white, long-grain, regular',r'rice, brown, long-grain',r'egg, whole, (raw|cooked, hard-boiled)',r'egg, white, raw',r'oats, raw',r'cereals, oats, regular and quick',r'sweet potato, (raw|cooked, boiled)',r'potatoes, boiled, cooked without skin',r'bananas, raw',r'broccoli, (raw|cooked, boiled)',r'fish, salmon, atlantic, (farmed|wild)',r'fish, tuna, light, canned in water',r'tofu, (raw, firm|firm, prepared)',r'milk, (reduced fat, fluid, 2%|nonfat, fluid)',r'yogurt, greek, plain, nonfat',r'beef, (ground, 90%|loin, top sirloin)',r'spinach, (raw|cooked, boiled)',r'tomatoes, red, ripe, raw',r'cucumber, with peel, raw',r'apples, raw, with skin',r'nuts, almonds',r'oil, olive',r'beverages, coffee, brewed',r'bread, whole-wheat',r'peanut butter, smooth',r'crustaceans, shrimp, cooked',r'pasta, cooked, unenriched',r'pasta, dry, unenriched',r'quinoa, (cooked|uncooked)',r'corn, sweet, yellow, (raw|cooked, boiled)',r'soybeans, green, cooked',r'avocados, raw',r'nuts, walnuts, english']
for r in rows('food.csv'):
    d=r['description'].lower()
    if any(re.search(p,d) for p in patterns):print(r['fdc_id'],r['description'])
print('NUTRIENTS')
for r in rows('nutrient.csv'):
    if r['id'] in ['1008','1003','1004','1005','1079','1093','1087','1089','1090','1091','1092','1095','1162','1114']:print(r)
