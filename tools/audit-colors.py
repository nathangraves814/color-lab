#!/usr/bin/env python3
"""Audit every colour combination the app can produce.

Parses PAINTS, NAMES and the RYB cube straight out of app.js and replays the same
mixing and naming maths, so this cannot drift from the app. Run it after touching
either table:

    python3 tools/audit-colors.py

The number that must stay at zero is "named after an ingredient". It is checked
twice: over every free mix of two to four paints, and over counted recipes (every
pair at 4:1 through 1:4), which end with the lesson ladders from the research
packet. The script exits 1 if either count is not zero.
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
# The kid-familiar-word bonus, read from nameOf's table so the audit cannot drift from it.
CORE_BONUS, FAM_BONUS = (float(x) for x in re.search(
    r"CORE\.indexOf\(n\[0\]\) >= 0 \? ([\d.]+) : \(FAMILIAR\.indexOf\(n\[0\]\) >= 0 \? ([\d.]+)", src).groups())
ACHRO = set(x.strip().strip("'") for x in re.findall(r"([a-z' ]+):1", re.search(r"var ACHRO_SET = \{([^}]+)\}", src).group(1)))

SHADE=[0.07,0.06,0.07]
def ryb2rgb(r,y,b):
    o=[0,0,0]
    for c in CORNERS:
        w=(r if c[0] else 1-r)*(y if c[1] else 1-y)*(b if c[2] else 1-b)
        o[0]+=w*c[3]; o[1]+=w*c[4]; o[2]+=w*c[5]
    return o
def lerp(a,b,t): return [a[i]+(b[i]-a[i])*t for i in range(3)]
TINT = float(re.search(r"var TINT_STRENGTH = ([\d.]+);", src).group(1))
MUTE = float(re.search(r"var MUTE = ([\d.]+);", src).group(1))
def neutral(c):
    m=max(c); return min(c)/m if m>1e-6 else 0.0
def mix(ps):
    s=[1+(TINT-1)*(p['w']+p['k']) for p in ps]; S=sum(s)
    c=[sum(si*p['c'][i] for si,p in zip(s,ps))/S for i in range(3)]
    w=sum(si*p['w'] for si,p in zip(s,ps))/S; k=sum(si*p['k'] for si,p in zip(s,ps))/S
    ch=[(si,p) for si,p in zip(s,ps) if max(p['c'])>1e-6]; peak=max(c)
    if peak<=1e-6: return lerp([1,1,1],SHADE,k)
    cw=sum(si for si,_ in ch)
    c=[v*(sum(si*max(p['c']) for si,p in ch)/cw)/peak for v in c]
    rgb=ryb2rgb(*c)
    d=max(0.0, neutral(c)-sum(si*neutral(p['c']) for si,p in ch)/cw)
    m=MUTE*d**0.5*(1-d)**1.5/0.3248
    if m>0:
        y=0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2]; rgb=lerp(rgb,[y,y,y],m)
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
        'bonus': CORE_BONUS if n in CORE else (FAM_BONUS if n in FAM else 0.0)} for n,h,e in names]
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
violations=[]; counts=collections.Counter(); rows=[]; by_size=collections.defaultdict(collections.Counter)
for r in (2,3,4):
    for combo in itertools.combinations_with_replacement(ids,r):
        ps=[BY[i] for i in combo]
        banned=set(p['name'] for p in ps)
        if len(banned)==1: banned=set()   # a paint with itself keeps its own name
        rgb=mix(ps); nm=name_of(rgb, banned)
        counts[nm]+=1; by_size[r][nm]+=1; rows.append((combo,hexs(rgb),nm))
        if nm in banned: violations.append((combo,nm))
print("combos tested:", len(rows))
print("named after an ingredient:", len(violations), violations[:5])
print("distinct names used:", len(counts), "of", len(names))
print("unused:", sorted(set(n for n,_,_ in names)-set(counts)))
print("most common:", counts.most_common(10))
# More paints pull toward brown and beige; this is the number a ratio mode would move.
for r in (2,3,4):
    c=by_size[r]; tot=sum(c.values())
    print("  %d paints: %5d mixes, %3d names, top: %s" % (r, tot, len(c),
          ', '.join('%s %d%%' % (n, round(100*k/tot)) for n,k in c.most_common(4))))
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

# --- counted recipes, the way a ratio mode would build them ---
# A recipe repeats a paint: (red, 4), (white, 1) is four red drops and one white.
# Every pair of paints at each ratio, capped at 4 drops of a colour.
RATIOS=[(4,1),(2,1),(1,1),(1,2),(1,4)]
def recipe(a, na, b, nb):
    ps=[BY[a]]*na+[BY[b]]*nb
    rgb=mix(ps); return hexs(rgb), name_of(rgb, set(p['name'] for p in ps)), rgb
ratio_violations=[]; ratio_count=0
for a,b in itertools.combinations(ids,2):
    for na,nb in RATIOS:
        ratio_count+=1
        h,nm,_=recipe(a,na,b,nb)
        if nm in (BY[a]['name'],BY[b]['name']): ratio_violations.append((a,na,b,nb,nm))
print("\n=== counted recipes ===")
print("recipes tested: %d (every pair at %s)" % (ratio_count, ', '.join('%d:%d'%r for r in RATIOS)))
print("named after an ingredient:", len(ratio_violations), ratio_violations[:5])
violations += ratio_violations

# The lesson ladders from research/color-education-packet.md section 8.5: one start
# colour, a second colour added at each ratio (start : added).
LADDERS=[('red','white'),('red','black'),('red','yellow'),('red','blue'),('red','green'),
 ('yellow','white'),('yellow','black'),('yellow','red'),('yellow','blue'),('yellow','purple'),
 ('blue','white'),('blue','black'),('blue','yellow'),('blue','red'),('blue','orange'),
 ('green','white'),('green','black'),('green','yellow'),('green','blue'),('green','red'),
 ('orange','white'),('orange','black'),('orange','yellow'),('orange','red'),('orange','blue'),
 ('purple','white'),('purple','black'),('purple','red'),('purple','blue'),('purple','yellow')]
print("\n  %-16s %s" % ('start + added', '   '.join('%-20s' % ('%d:%d' % r) for r in RATIOS)))
for a,b in LADDERS:
    cells=[]
    for na,nb in RATIOS:
        h,nm,_=recipe(a,na,b,nb); cells.append('%-12s %s' % (nm, h))
    print("  %-16s %s" % (a+' + '+b, '  '.join(cells)))

if violations:
    sys.exit(1)
