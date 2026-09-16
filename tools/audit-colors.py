#!/usr/bin/env python3
"""Audit every colour combination the app can produce.

Parses PAINTS, NAMES and the RYB cube straight out of app.js and replays the same
mixing and naming maths, so this cannot drift from the app. Run it after touching
either table:

    python3 tools/audit-colors.py

The number that must stay at zero is "named after an ingredient".
"""
import re, itertools, collections, json, sys
src = open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))),'app.js'), encoding='utf-8').read()

# --- parse the app's own tables ---
paints = []
for m in re.finditer(r"\{\s*id:'([^']+)',\s*name:'([^']+)',\s*c:\[([^\]]+)\](?:,\s*w:([0-9.]+))?(?:,\s*k:([0-9.]+))?\s*\}", src):
    pid, pname, c, w, k = m.groups()
    paints.append({'id':pid,'name':pname,'c':[float(x) for x in c.split(',')],
                   'w':float(w) if w else 0.0,'k':float(k) if k else 0.0})
names = re.findall(r"\['([^']+)','(#[0-9a-f]{6})','([^']*)'\]", src)
CORNERS = [[int(a),int(b),int(c2),float(r),float(g),float(bl)] for a,b,c2,r,g,bl in
  re.findall(r"\[(\d),(\d),(\d), ([\d.]+),([\d.]+),([\d.]+)\]", src)]
assert len(paints)==24 and len(CORNERS)==8, (len(paints), len(CORNERS))
CORE = set(re.search(r"var CORE = '([^']+)'", src).group(1).split())
fam_src = re.search(r"var FAMILIAR = \((.*?)\)\.split\(','\);", src, re.S).group(1)
FAM = set(x for part in re.findall(r"'([^']*)'", fam_src) for x in part.split(',') if x)
ACHRO = set(x.strip().strip("'") for x in re.findall(r"([a-z' ]+):1", re.search(r"var ACHRO_SET = \{([^}]+)\}", src).group(1)))

SHADE=[0.07,0.06,0.07]
def ryb2rgb(r,y,b):
    o=[0,0,0]
    for c in CORNERS:
        w=(r if c[0] else 1-r)*(y if c[1] else 1-y)*(b if c[2] else 1-b)
        o[0]+=w*c[3]; o[1]+=w*c[4]; o[2]+=w*c[5]
    return o
def lerp(a,b,t): return [a[i]+(b[i]-a[i])*t for i in range(3)]
def mix(ps):
    n=len(ps); c=[sum(p['c'][i] for p in ps)/n for i in range(3)]
    w=sum(p['w'] for p in ps)/n; k=sum(p['k'] for p in ps)/n
    ch=[p for p in ps if max(p['c'])>1e-6]; peak=max(c)
    if ch and peak>1e-6:
        t=sum(max(p['c']) for p in ch)/len(ch); c=[v*(t/peak) for v in c]
    rgb = ryb2rgb(*c) if peak>1e-6 else [1.0,1.0,1.0]
    return lerp(lerp(rgb,[1,1,1],w),SHADE,k)
def hexs(r): return '#%02x%02x%02x'%tuple(max(0,min(255,round(v*255))) for v in r)
def h2rgb(h):
    h=h.lstrip('#'); return [int(h[i:i+2],16)/255 for i in (0,2,4)]
def lab(rgb):
    def f(u): return u/12.92 if u<=0.04045 else ((u+0.055)/1.055)**2.4
    r,g,b=[f(v) for v in rgb]
    X=(0.4124*r+0.3576*g+0.1805*b)/0.95047; Y=0.2126*r+0.7152*g+0.0722*b
    Z=(0.0193*r+0.1192*g+0.9505*b)/1.08883
    def k(t): return t**(1/3) if t>0.008856 else 7.787*t+16/116
    fx,fy,fz=k(X),k(Y),k(Z); return (116*fy-16,500*(fx-fy),200*(fy-fz))
NAMED=[{'name':n,'lab':lab(h2rgb(h)),'emoji':e,
        'bonus': 8.0 if n in CORE else (5.0 if n in FAM else 0.0)} for n,h,e in names]
def dE(a,b): return sum((a[i]-b[i])**2 for i in range(3))**0.5
def name_of(rgb, banned=None):
    L=lab(rgb); chroma=(L[1]**2+L[2]**2)**0.5
    best=None; bs=1e9; fb=NAMED[0]; fbs=1e9
    for n in NAMED:
        bonus = 0.0 if (n['name'] in ACHRO and chroma>10) else n['bonus']
        sc = dE(L,n['lab']) - bonus
        if sc<fbs: fbs=sc; fb=n
        if banned and n['name'] in banned: continue
        if sc<bs: bs=sc; best=n
    return (best or fb)['name']

BY={p['id']:p for p in paints}
ids=[p['id'] for p in paints]
violations=[]; counts=collections.Counter(); rows=[]
for r in (2,3):
    for combo in itertools.combinations(ids,r):
        ps=[BY[i] for i in combo]
        banned=set(p['name'] for p in ps)
        rgb=mix(ps); nm=name_of(rgb, banned)
        counts[nm]+=1; rows.append((combo,hexs(rgb),nm))
        if nm in banned: violations.append((combo,nm))
print("combos tested:", len(rows))
print("named after an ingredient:", len(violations), violations[:5])
print("distinct names used:", len(counts), "of", len(names))
print("unused:", sorted(set(n for n,_,_ in names)-set(counts)))
print("most common:", counts.most_common(10))
print()
anchors=[(('red','yellow'),'orange'),(('blue','yellow'),'green'),(('red','blue'),'purple'),
 (('red','white'),'pink'),(('white','black'),'gray'),(('red','yellow','blue'),None),
 (('red','orange'),None),(('lavender','blue'),None),(('blue','white'),None),
 (('red','black'),None),(('yellow','black'),None),(('green','white'),None),
 (('orange','yellow'),None),(('green','blue'),None),(('purple','blue'),None),
 (('red','pink'),None),(('silver','white'),None),(('gray','black'),None),
 (('teal','green'),None),(('navy','blue'),None),(('magenta','red'),None),
 (('brown','white'),None),(('mint','green'),None),(('gold','yellow'),None)]
for combo, want in anchors:
    ps=[BY[i] for i in combo]; banned=set(p['name'] for p in ps)
    nm=name_of(mix(ps), banned); h=hexs(mix(ps))
    flag='' if (want is None or nm==want) else '   <-- expected %s' % want
    print('  %-26s %s -> %s%s' % (' + '.join(combo), h, nm, flag))

print("\n=== two-colour pairs whose chosen name fits worst (dE to that name) ===")
def fit(rgb, nm):
    L=lab(rgb)
    for n in NAMED:
        if n['name']==nm: return dE(L,n['lab'])
    return 999
bad=[]
for combo in itertools.combinations(ids,2):
    ps=[BY[i] for i in combo]; banned=set(p['name'] for p in ps)
    rgb=mix(ps); nm=name_of(rgb,banned)
    bad.append((fit(rgb,nm), combo, hexs(rgb), nm))
bad.sort(reverse=True)
for d,c,h,n in bad[:14]:
    print('  %-26s %s -> %-14s dE %.0f' % (' + '.join(c), h, n, d))
print("\n  median fit dE: %.1f over %d pairs" % (sorted(x[0] for x in bad)[len(bad)//2], len(bad)))

print("\n=== every pair involving red, blue or white ===")
for combo in itertools.combinations(ids,2):
    if not ({'red','blue','white'} & set(combo)): continue
    ps=[BY[i] for i in combo]
    print('  %-26s %s -> %s' % (' + '.join(combo), hexs(mix(ps)),
          name_of(mix(ps), set(p['name'] for p in ps))))
