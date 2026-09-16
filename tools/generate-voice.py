#!/usr/bin/env python3
"""Generate Color Lab's voice pack with Kokoro-82M.

Reads the paint and colour-name lists straight out of ../app.js so the clips can
never drift from what the app actually says. Writes one small AAC file per phrase
plus a manifest the service worker uses to precache them.

Setup (Nathan's Mac has Python 3.9 and no Homebrew, so use uv):
    curl -fsSL https://github.com/astral-sh/uv/releases/latest/download/uv-aarch64-apple-darwin.tar.gz | tar xz
    ./uv-aarch64-apple-darwin/uv venv --python 3.12 .venv
    ./uv-aarch64-apple-darwin/uv pip install --python .venv/bin/python kokoro-onnx soundfile "misaki[en]" pip
    .venv/bin/python -m spacy download en_core_web_sm

Model files (once, ~340MB, not committed):
    curl -fL -O https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -fL -O https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

Then:
    .venv/bin/python tools/generate-voice.py --voice af_heart

Swap --voice for any of Kokoro's 54 (af_bella, af_nicole, af_sarah, bf_emma, bf_alice...)
to re-cut the whole pack in a different voice.

NOTE: do not use espeak for phonemes. The espeakng-loader wheel is broken on macOS
arm64 (it ignores every data-path override and hard-exits), which is why this uses
misaki and feeds Kokoro IPA directly with is_phonemes=True.
"""
import argparse, json, os, re, subprocess, sys, unicodedata
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SR = 24000

# Phrases that are not colour names. Keys must match the ids used in app.js.
UI_PHRASES = {
    'welcome':          "Tap two colors to mix them!",
    'reset':            "Let's start over!",
    'sound-on':         "Sound on!",
    'album':            "Here are the colors you found!",
    'missions':         "Can you make these colors?",
    'mission-complete': "Mission complete!",
    'pick-one-more':    "Pick one more!",
    'two-colors':       "Two colors!",
    'three-colors':     "Three colors!",
}
# Two readings of every result so a hundredth mix does not sound like the first.
RESULT_TEMPLATES = ["That's {}!", "You made {}!"]

# Words misaki's dictionary does not carry. Left alone it emits a placeholder that
# synthesises as silence, so the clip says "That's ..." and stops. The app keeps the
# real spelling; only what we hand the synthesiser changes. Anything added here must
# survive the check in phonemes_for() below.
SPOKEN_AS = {
    'seafoam':    'sea foam',
    'terracotta': 'terra cotta',
    'ochre':      'ocher',
}


def spoken(text):
    for word, say_as in SPOKEN_AS.items():
        text = re.sub(r'\b%s\b' % re.escape(word), say_as, text, flags=re.I)
    return text


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def read_app_lists():
    src = open(os.path.join(ROOT, 'app.js'), encoding='utf-8').read()
    paints = re.findall(r"\{\s*id:'([^']+)',\s*name:'([^']+)'", src)
    names = re.findall(r"\['([^']+)','#[0-9a-f]{6}','[^']*'\]", src)
    if not paints or not names:
        sys.exit('Could not parse app.js. Did the PAINTS/NAMES format change?')
    return paints, names


def phonemes_for(g2p, text):
    """Phonemise, and refuse to return anything with a word silently missing."""
    ps, tokens = g2p(spoken(text))
    dropped = [t.text for t in tokens
               if re.search(r'[A-Za-z]', t.text or '') and not t.phonemes]
    if dropped or '\u2753' in ps:
        raise ValueError('no pronunciation for %s in %r (add it to SPOKEN_AS)'
                         % (dropped or ['?'], text))
    return ps


def encode(wav_path, out_path):
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', wav_path, out_path],
                   check=True, capture_output=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', default='af_heart')
    ap.add_argument('--speed', type=float, default=0.92)
    ap.add_argument('--model', default=os.path.join(ROOT, 'kokoro-v1.0.onnx'))
    ap.add_argument('--voices', default=os.path.join(ROOT, 'voices-v1.0.bin'))
    ap.add_argument('--outdir', default=os.path.join(ROOT, 'voice'))
    args = ap.parse_args()

    for p in (args.model, args.voices):
        if not os.path.exists(p):
            sys.exit('Missing %s. See the download commands in the docstring above.' % p)

    from kokoro_onnx import Kokoro
    from misaki import en
    kok = Kokoro(args.model, args.voices)
    g2p = en.G2P(trf=False, british=args.voice.startswith('b'), fallback=None)

    paints, names = read_app_lists()
    jobs = []   # (relative output path, text to speak)
    for pid, pname in paints:
        jobs.append(('paints/%s.m4a' % pid, pname.capitalize() + '.'))
    for cname in names:
        for i, tpl in enumerate(RESULT_TEMPLATES):
            jobs.append(('results/%s-%d.m4a' % (slug(cname), i), tpl.format(cname)))
    for key, text in UI_PHRASES.items():
        jobs.append(('ui/%s.m4a' % key, text))

    tmp = os.path.join(args.outdir, '_tmp.wav')
    os.makedirs(args.outdir, exist_ok=True)
    for sub in ('paints', 'results', 'ui'):
        os.makedirs(os.path.join(args.outdir, sub), exist_ok=True)

    fade = int(SR * 0.006)
    window = np.linspace(0, 1, fade, dtype=np.float32)
    written = []
    # Fail before synthesising anything rather than shipping a pack with silent clips.
    problems = []
    for rel, text in jobs:
        try:
            phonemes_for(g2p, text)
        except ValueError as err:
            problems.append(str(err))
    if problems:
        sys.exit('Cannot pronounce %d phrase(s):\n  ' % len(problems) + '\n  '.join(problems))

    for n, (rel, text) in enumerate(jobs, 1):
        phonemes = phonemes_for(g2p, text)
        samples, _ = kok.create(phonemes, voice=args.voice, speed=args.speed,
                                is_phonemes=True, trim=True)
        a = np.asarray(samples, dtype=np.float32)
        peak = float(np.abs(a).max())
        if peak > 0:
            a = a / peak * 0.90          # even loudness across the pack
        if len(a) > 2 * fade:            # kill the click at each edge
            a[:fade] *= window
            a[-fade:] *= window[::-1]
        sf.write(tmp, a, SR)
        encode(tmp, os.path.join(args.outdir, rel))
        written.append(rel)
        if n % 25 == 0 or n == len(jobs):
            print('  %d/%d' % (n, len(jobs)), flush=True)
    os.remove(tmp)

    manifest = {'voice': args.voice, 'files': sorted(written)}
    with open(os.path.join(args.outdir, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)

    total = sum(os.path.getsize(os.path.join(args.outdir, r)) for r in written)
    print('%d clips, %.0f KB total, voice=%s' % (len(written), total / 1024, args.voice))


if __name__ == '__main__':
    main()
