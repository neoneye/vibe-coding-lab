"""Loss curves (validation bits/char vs training step) from the training logs; writes loss_curves.png."""
import re, glob, collections
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt

def curves(pattern):
    out = collections.defaultdict(dict)
    for f in glob.glob(pattern):
        for line in open(f):
            m = re.match(r"(\w+) seed=(\d+) step=(\d+) val_bpc=([\d.]+)", line)
            if m: out[(m[1], int(m[2]))][int(m[3])] = float(m[4])
    return out

panels = [
    ("Full pyramid model (radius 12 → 6 → 3)", curves("logs/e3_*.log"),
     [("base2", "standard transformer", "#2a78d6"), ("tri", "triangle", "#eb6834"),
      ("triR", "tri. reversed", "#1baf7a"), ("triRN", "tri. reversed, avg 1", "#eda100")]),
    ("Single triangle layer (tiny model)", curves("logs/tiny_*.log"),
     [("tri", "unscaled", "#eb6834"), ("triSN", "centre lowered, avg 1", "#e87ba4"),
      ("triRN", "reversed, avg 1", "#eda100"), ("triW", "wrap", "#008300")]),
]
plt.rcParams.update({"font.family": "sans-serif", "font.size": 10, "axes.edgecolor": "#cfccc2", "axes.labelcolor": "#4a4740",
                     "xtick.color": "#6b6558", "ytick.color": "#6b6558"})
fig, axes = plt.subplots(1, 2, figsize=(15, 5.6), dpi=150, sharey=False)
for ax, (title, data, series) in zip(axes, panels):
    ends = []
    for key, label, color in series:
        runs = [data[(key, s)] for s in (0, 1) if (key, s) in data]
        if not runs: continue
        steps = sorted(set.intersection(*[set(r) for r in runs]))
        for r in runs: ax.plot(steps, [r[s] for s in steps], color=color, lw=1, alpha=0.35)
        mean = [sum(r[s] for r in runs) / len(runs) for s in steps]
        ax.plot(steps, mean, color=color, lw=2.2, marker="o", ms=4)
        ends.append([mean[-1], mean[-1], label, color, steps[-1]])   # [label y, true value, ...]
    ends.sort(); lo, hi = ax.get_ylim(); gap = 0.055 * (hi - lo)   # direct labels at the right end, nudged apart
    for i in range(1, len(ends)):
        if ends[i][0] - ends[i - 1][0] < gap: ends[i][0] = ends[i - 1][0] + gap
    for ly, val, label, color, x in ends:
        ax.annotate("", xy=(x, val), xytext=(x + 40, ly), arrowprops=dict(arrowstyle="-", color=color, lw=1.2), annotation_clip=False)
        ax.annotate(f"■ {label}  {val:.3f}", xy=(x + 40, ly), xytext=(4, 0), textcoords="offset points", va="center",
                    fontsize=9, color="#2b2924", annotation_clip=False)
        ax.texts[-1].set_text(f"{label}  {val:.3f}")
        ax.plot([x + 44, x + 70], [ly, ly], color=color, lw=3, clip_on=False, solid_capstyle="round")
        ax.texts[-1].set_position((34, 0))
    ax.set_title(title, loc="left", fontsize=11, color="#1d1b16", pad=10)
    ax.set_xlabel("training step"); ax.set_ylabel("validation bits per character (lower is better)")
    ax.grid(axis="y", color="#ece8de", lw=0.8); ax.set_axisbelow(True)
    for side in ("top", "right"): ax.spines[side].set_visible(False)
    ax.set_xlim(150, 1000)
fig.text(0.01, 0.005, "Thin lines: individual seeds. Bold: mean of 2 seeds. Validation loss was logged every 200 steps (5 points per run).",
         fontsize=8.5, color="#6b6558")
fig.tight_layout(rect=(0, 0.03, 0.86, 1)); fig.subplots_adjust(wspace=0.95)
fig.savefig("loss_curves.png", bbox_inches="tight")
print("written loss_curves.png")
