#!/usr/bin/env python3
"""Gera ableton-modelo.js a partir de um .als real do Live 12.

Uso: python3 ferramentas/montar-modelo-als.py "~/Desktop/ClassicHouse2.als" [id da faixa de audio sem devices]

Pega o esqueleto do set (Main, PreHear, transporte, vistas), esvazia faixas, retornos, cenas e
marcadores, e deixa UMA faixa de audio como molde, com marcadores __X__ que o ableton.js preenche.
So stdlib. Nada do conteudo musical do .als de origem vai para o molde.
"""
import gzip, json, os, re, sys
import xml.etree.ElementTree as ET

origem = os.path.expanduser(sys.argv[1])
id_faixa = sys.argv[2] if len(sys.argv) > 2 else "15"
raiz = ET.fromstring(gzip.open(origem).read())
live = raiz.find("LiveSet")

faixa = next(t for t in live.find("Tracks") if t.tag == "AudioTrack" and t.get("Id") == id_faixa)

# ---- clipe de arranjo (molde) e esvaziar a faixa
eventos = faixa.find("DeviceChain/MainSequencer/Sample/ArrangerAutomation/Events")
clipe = list(eventos)[0]
for c in list(eventos):
    eventos.remove(c)
marc = ET.SubElement(eventos, "ZZCLIPES")

lista = faixa.find("DeviceChain/MainSequencer/ClipSlotList")
vazio = next(s for s in lista if s.find("ClipSlot/Value").find("AudioClip") is None)
for s in list(lista):
    lista.remove(s)
vazio.set("Id", "0")
lista.append(vazio)
# o FreezeSequencer tem a sua propria lista, com um slot por cena do set original: tambem precisa ter 1 (senao o Live recusa: "Slot count mismatch")
lf = faixa.find("DeviceChain/FreezeSequencer/ClipSlotList")
if lf is not None:
    vf = next((s for s in lf if s.find("ClipSlot/Value").find("AudioClip") is None), list(lf)[0])
    for s in list(lf):
        lf.remove(s)
    vf.set("Id", "0")
    lf.append(vf)

for env in faixa.iter("Envelopes"):
    for c in list(env):
        env.remove(c)
faixa.find("TrackGroupId").set("Value", "-1")
faixa.find("LinkedTrackGroupId").set("Value", "-1")
envs = faixa.find("DeviceChain/AutomationLanes")
if envs is not None:
    for ln in envs.iter("AutomationLanes"):
        for c in list(ln):
            ln.remove(c)
envs_ = faixa.find("DeviceChain/Mixer/Sends")
for c in list(envs_):
    envs_.remove(c)
for dev in faixa.findall("DeviceChain/DeviceChain/Devices"):
    for c in list(dev):
        dev.remove(c)

# ---- esqueleto do set
trs = live.find("Tracks")
for c in list(trs):
    trs.remove(c)
ET.SubElement(trs, "ZZFAIXAS")
for c in list(live.find("SendsPre")):
    live.find("SendsPre").remove(c)
cenas = live.find("Scenes")
for c in list(cenas)[1:]:
    cenas.remove(c)
live.find("HighlightedTrackIndex").set("Value", "0")
for d in live.find("MainTrack").findall("DeviceChain/DeviceChain/Devices"):
    for c in list(d):
        d.remove(c)
for c in list(live.find("MainTrack").find("DeviceChain/Mixer/Sends")):
    live.find("MainTrack").find("DeviceChain/Mixer/Sends").remove(c)
for k in ("Locators",):
    for c in list(live.find(k).iter("Locators")):
        for cc in list(c):
            c.remove(cc)
live.find("MainTrack").find("DeviceChain/Mixer/Tempo/Manual").set("Value", "__BPM__")

# ---- serializacao
def ser(e):
    return ET.tostring(e, encoding="unicode")

s_faixa = ser(faixa)
s_clipe = ser(clipe)

# ids de ponteiro (grandes e globais) da faixa viram __P0__, __P1__...
ids = []
for m in re.finditer(r'<(?:\w*Target|Pointee) Id="(\d+)"', s_faixa):
    if m.group(1) not in ids:
        ids.append(m.group(1))
for i, v in enumerate(ids):
    s_faixa = s_faixa.replace('"%s"' % v, '"__P%d__"' % i)

def troca(s, de, para, n=1):
    assert s.count(de) >= 1, de
    return s.replace(de, para) if n == 0 else s.replace(de, para, n)

s_faixa = re.sub(r'<AudioTrack Id="\d+"', '<AudioTrack Id="__TID__"', s_faixa)
s_faixa = re.sub(r'<EffectiveName Value="[^"]*"', '<EffectiveName Value="__NOME__"', s_faixa, count=1)
s_faixa = re.sub(r'<UserName Value="[^"]*"', '<UserName Value="__NOME__"', s_faixa, count=1)
s_faixa = re.sub(r'<MemorizedFirstClipName Value="[^"]*"', '<MemorizedFirstClipName Value="__NOME__"', s_faixa, count=1)
s_faixa = re.sub(r'<Color Value="\d+"', '<Color Value="__COR__"', s_faixa, count=1)
# ativador da faixa: <Mixer><On><Manual>
s_faixa = re.sub(r'(<Mixer>.*?<On>\s*<LomId Value="0" />\s*<Manual Value=")true(")', r'\1__ATIVA__\2', s_faixa, count=1, flags=re.S)
assert "__ATIVA__" in s_faixa
s_faixa = s_faixa.replace("<ZZCLIPES />", "__CLIPES__")
assert "__CLIPES__" in s_faixa

# clipe
s_clipe = re.sub(r'<AudioClip Id="\d+" Time="[^"]*"', '<AudioClip Id="__CID__" Time="0"', s_clipe)
s_clipe = re.sub(r'<Name Value="[^"]*" />', '<Name Value="__NOME__" />', s_clipe, count=1)
s_clipe = re.sub(r'<Color Value="\d+" />', '<Color Value="__COR__" />', s_clipe, count=1)
s_clipe = re.sub(r'<CurrentEnd Value="[^"]*" />', '<CurrentEnd Value="__BEATS__" />', s_clipe)
s_clipe = re.sub(r'<LoopEnd Value="[^"]*" />', '<LoopEnd Value="__BEATS__" />', s_clipe)
s_clipe = re.sub(r'<OutMarker Value="[^"]*" />', '<OutMarker Value="__BEATS__" />', s_clipe)
s_clipe = re.sub(r'<HiddenLoopEnd Value="[^"]*" />', '<HiddenLoopEnd Value="__BEATS__" />', s_clipe)
s_clipe = re.sub(r'<RightTime Value="[^"]*" />', '<RightTime Value="__BEATS__" />', s_clipe)
s_clipe = re.sub(r'<LoopOn Value="[^"]*" />', '<LoopOn Value="false" />', s_clipe)
s_clipe = re.sub(r'<IsWarped Value="[^"]*" />', '<IsWarped Value="false" />', s_clipe)
s_clipe = re.sub(r'<SamplesToAutoWarp Value="[^"]*" />', '<SamplesToAutoWarp Value="0" />', s_clipe)
s_clipe = re.sub(r'<RelativePathType Value="\d+" />', '<RelativePathType Value="1" />', s_clipe)  # 1 = relativo ao .als (o que o Live 12.4 grava); o tipo 3 nao resolve no zip do Sidra
s_clipe = re.sub(r'<RelativePath Value="[^"]*" />', '<RelativePath Value="__CAMINHO__" />', s_clipe)
s_clipe = re.sub(r'<Path Value="[^"]*" />', '<Path Value="__CAMINHO__" />', s_clipe)
s_clipe = re.sub(r'<OriginalFileSize Value="[^"]*" />', '<OriginalFileSize Value="__BYTES__" />', s_clipe)
s_clipe = re.sub(r'<OriginalCrc Value="[^"]*" />', '<OriginalCrc Value="0" />', s_clipe)
s_clipe = re.sub(r'<LastModDate Value="[^"]*" />', '<LastModDate Value="__DATA__" />', s_clipe)
s_clipe = re.sub(r'<DefaultDuration Value="[^"]*" />', '<DefaultDuration Value="__AMOSTRAS__" />', s_clipe)
s_clipe = re.sub(r'<WarpMarkers>.*?</WarpMarkers>',
  '<WarpMarkers><WarpMarker Id="0" SecTime="0" BeatTime="0" /><WarpMarker Id="1" SecTime="__SEG__" BeatTime="__BEATS__" /></WarpMarkers>', s_clipe, count=1, flags=re.S)
for tok in ("__CID__", "__BEATS__", "__CAMINHO__", "__AMOSTRAS__", "__SEG__", "__BYTES__"):
    assert tok in s_clipe, tok

# esqueleto: coloca os marcadores de ids e NextPointeeId
live.find("NextPointeeId").set("Value", "__NEXT__")
cabeca = '<?xml version="1.0" encoding="UTF-8"?>\n'
doc = cabeca + ser(raiz)
# a automacao de tempo do Main tem o BPM do set de origem: troca pelo marcador
doc, n_bpm = re.subn(r'(<PointeeId Value="%s" />.*?<FloatEvent [^>]*Value=")[^"]*(")' % live.find("MainTrack").find("DeviceChain/Mixer/Tempo/AutomationTarget").get("Id"),
                     r'\1__BPM__\2', doc, count=1, flags=re.S)
assert n_bpm == 1, "automacao de tempo nao encontrada"
antes, depois = doc.split("<ZZFAIXAS />")
assert len(ids) > 0
saida = {
    "antes": antes, "depois": depois, "faixa": s_faixa, "clipe": s_clipe,
    "nPonteiros": len(ids),
}
destino = os.path.join(os.path.dirname(__file__), "..", "ableton-modelo.js")
with open(destino, "w") as f:
    f.write("// GERADO por ferramentas/montar-modelo-als.py a partir de um set do Live 12 (esqueleto, sem conteudo musical).\n")
    f.write("// Nao edite a mao: rode o montador de novo.\n")
    f.write("export const MODELO = " + json.dumps(saida, ensure_ascii=False) + ";\n")
print("ok", len(antes), len(depois), len(s_faixa), len(s_clipe), "ponteiros", len(ids))
