#!/usr/bin/env python3
"""生成应用图标 build/icon.png (1024x1024, 透明圆角) — v2 精致版
多层渐变背景 + 刻度表盘 + 光晕质感
"""
from PIL import Image, ImageDraw, ImageFilter
import math, os

S = 1024
C = S // 2

# ---------- 多停靠点对角线渐变背景 (indigo -> violet -> cyan) ----------
g = 128
stops = [(0.0, (91, 79, 232)), (0.55, (124, 108, 246)), (1.0, (76, 194, 255))]

def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))

def gradient_color(t):
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1:
            return lerp(c0, c1, (t - t0) / (t1 - t0))
    return stops[-1][1]

grad = Image.new("RGB", (g, g))
px = grad.load()
for y in range(g):
    for x in range(g):
        px[x, y] = gradient_color((x + y) / (2 * (g - 1)))
grad = grad.resize((S, S), Image.BICUBIC).convert("RGBA")

# ---------- macOS 圆角矩形掩码 + 内描边高光 ----------
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=232, fill=255)

icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
icon.paste(grad, (0, 0), mask)

# 左上柔光(大椭圆高光,营造玻璃质感)
hl = Image.new("L", (S, S), 0)
ImageDraw.Draw(hl).ellipse([-260, -420, S + 200, 480], fill=52)
hl = hl.filter(ImageFilter.GaussianBlur(60))
icon.paste(Image.new("RGBA", (S, S), (255, 255, 255, 255)), (0, 0),
           Image.composite(hl, Image.new("L", (S, S), 0), mask))

# 右下暗角(增加立体感)
vg = Image.radial_gradient("L").resize((int(S * 1.6), int(S * 1.6)))
vg = vg.crop((S // 3, S // 3, S // 3 + S, S // 3 + S))
vg = vg.point(lambda v: int(v * 0.30))
icon.paste(Image.new("RGBA", (S, S), (10, 8, 40, 255)), (0, 0),
           Image.composite(vg, Image.new("L", (S, S), 0), mask))

d = ImageDraw.Draw(icon)
# 1px 内描边高光
d.rounded_rectangle([8, 8, S - 9, S - 9], radius=226,
                    outline=(255, 255, 255, 70), width=5)

WHITE = (255, 255, 255, 255)

# ---------- 表盘:外柔光环 + 主环 + 刻度 ----------
R = 292
soft = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(soft).ellipse([C - R - 26, C - R - 26, C + R + 26, C + R + 26],
                             outline=(255, 255, 255, 34), width=52)
soft = soft.filter(ImageFilter.GaussianBlur(18))
icon.alpha_composite(soft)
d = ImageDraw.Draw(icon)

d.ellipse([C - R, C - R, C + R, C + R], outline=WHITE, width=34)

inner = R - 34
# 12 个刻度,四正位加长加粗
for i in range(12):
    a = math.radians(i * 30)
    major = i % 3 == 0
    ln = 52 if major else 34
    wd = 16 if major else 10
    r0 = inner - 26
    r1 = r0 - ln
    x0, y0 = C + r0 * math.sin(a), C - r0 * math.cos(a)
    x1, y1 = C + r1 * math.sin(a), C - r1 * math.cos(a)
    d.line([x0, y0, x1, y1], fill=WHITE, width=wd)
    rr = wd / 2
    d.ellipse([x1 - rr, y1 - rr, x1 + rr, y1 + rr], fill=WHITE)

# ---------- 指针(经典 10:10) ----------
def hand(angle_deg, length, width):
    a = math.radians(angle_deg)
    x2, y2 = C + length * math.sin(a), C - length * math.cos(a)
    d.line([C, C, x2, y2], fill=WHITE, width=width)
    r = width / 2
    d.ellipse([x2 - r, y2 - r, x2 + r, y2 + r], fill=WHITE)

hand(300, int(inner * 0.52), 58)   # 时针 -> 10
hand(60, int(inner * 0.80), 46)    # 分针 -> 2

# 中心帽:白圆 + 渐变色内点
d.ellipse([C - 44, C - 44, C + 44, C + 44], fill=WHITE)
d.ellipse([C - 20, C - 20, C + 20, C + 20], fill=(91, 79, 232, 255))

# ---------- 顶部表冠(秒表风格:竖柄 + 侧钮) ----------
d.rounded_rectangle([C - 40, C - R - 92, C + 40, C - R + 6], radius=28, fill=WHITE)
for sx in (-1, 1):
    bx = C + sx * 96
    by = C - R + 42
    d.ellipse([bx - 26, by - 26, bx + 26, by + 26], fill=WHITE)

os.makedirs("build", exist_ok=True)
icon.save("build/icon.png")
print("saved build/icon.png", icon.size)
