#!/usr/bin/env python3
"""Build Chrome Web Store visuals from current, unmodified popup screenshots."""

from pathlib import Path
import textwrap

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BACKGROUND = ROOT / 'assets/store-source/radar-gradient-v2.png'
SCREENSHOTS = {
    'main': ROOT / 'assets/store-source/popup-main-en.png',
    'filters': ROOT / 'assets/store-source/popup-filters-en.png',
    'stats': ROOT / 'assets/store-source/popup-stats-en.png',
}
OUT_SCREENSHOTS = ROOT / 'assets/store-screenshots'
OUT_PROMO = ROOT / 'assets/promo'

FONT_REGULAR = '/System/Library/Fonts/SFNS.ttf'
FONT_BOLD = '/System/Library/Fonts/SFNS.ttf'
INK = '#121826'
MUTED = '#4d6574'
BLUE = '#1d9bf0'
RED = '#d71920'
WHITE = '#ffffff'


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def cover(image, size):
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h)).convert('RGB')


def rounded_screenshot(canvas, screenshot, box, radius=28):
    x, y, width, height = box
    scale = min(width / screenshot.width, height / screenshot.height)
    shot = screenshot.resize((round(screenshot.width * scale), round(screenshot.height * scale)), Image.Resampling.LANCZOS)
    x += (width - shot.width) // 2
    y += (height - shot.height) // 2

    mask = Image.new('L', shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width, shot.height), radius=radius, fill=255)

    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    shadow_shape = Image.new('L', shot.size, 0)
    ImageDraw.Draw(shadow_shape).rounded_rectangle((0, 0, shot.width, shot.height), radius=radius, fill=150)
    shadow_shape = shadow_shape.filter(ImageFilter.GaussianBlur(18))
    shadow.paste((20, 35, 70, 125), (x + 10, y + 16), shadow_shape)
    canvas.alpha_composite(shadow)
    canvas.paste(shot.convert('RGBA'), (x, y), mask)


def draw_brand(draw, x, y, size=25):
    draw.ellipse((x, y + 2, x + size, y + size + 2), fill=RED)
    draw.text((x + size + 10, y), 'X Unfollow Radar', font=font(size - 2, True), fill=INK)


def draw_wrapped(draw, text, xy, width_chars, text_font, fill, spacing=8):
    wrapped = textwrap.wrap(text, width=width_chars)
    draw.multiline_text(xy, '\n'.join(wrapped), font=text_font, fill=fill, spacing=spacing)


def draw_chip(draw, x, y, text, accent=BLUE):
    chip_font = font(18, True)
    bbox = draw.textbbox((0, 0), text, font=chip_font)
    width = bbox[2] - bbox[0] + 34
    draw.rounded_rectangle((x, y, x + width, y + 38), radius=19, fill=(255, 255, 255, 220), outline=accent, width=2)
    draw.text((x + 17, y + 8), text, font=chip_font, fill=INK)
    return width


def store_visual(key, title, subtitle, chips, output_name):
    canvas = cover(Image.open(BACKGROUND), (1280, 800)).convert('RGBA')
    veil = Image.new('RGBA', canvas.size, (255, 255, 255, 25))
    canvas.alpha_composite(veil)
    draw = ImageDraw.Draw(canvas)

    draw_brand(draw, 74, 62, 28)
    draw.multiline_text((74, 150), title, font=font(54, True), fill=INK, spacing=4)
    draw_wrapped(draw, subtitle, (74, 322), 37, font(27), MUTED, 9)

    chip_x, chip_y = 74, 450
    for chip in chips:
        chip_width = draw_chip(draw, chip_x, chip_y, chip)
        chip_x += chip_width + 12
        if chip_x > 610:
            chip_x = 74
            chip_y += 52

    draw.rounded_rectangle((74, 668, 600, 726), radius=18, fill=(18, 24, 38, 225))
    draw.text((98, 684), 'Built for the X Following page', font=font(22, True), fill=WHITE)

    shot = Image.open(SCREENSHOTS[key]).convert('RGB')
    rounded_screenshot(canvas, shot, (750, 52, 458, 696), radius=25)

    output = OUT_SCREENSHOTS / output_name
    canvas.convert('RGB').save(output, 'PNG', optimize=True)


def small_tile():
    canvas = cover(Image.open(BACKGROUND), (440, 280)).convert('RGBA')
    draw = ImageDraw.Draw(canvas)
    draw_brand(draw, 28, 24, 20)
    draw.multiline_text((28, 76), 'Find non-followers.\nStay in control.', font=font(29, True), fill=INK, spacing=2)
    draw.text((28, 166), 'Preview • Filter • Unfollow', font=font(16, True), fill=MUTED)
    draw.rounded_rectangle((28, 211, 236, 250), radius=18, fill=BLUE)
    draw.text((48, 220), 'Made for Following', font=font(16, True), fill=WHITE)
    rounded_screenshot(canvas, Image.open(SCREENSHOTS['main']).convert('RGB'), (288, 28, 126, 224), radius=10)
    canvas.convert('RGB').save(OUT_PROMO / 'x-unfollow-radar-tile-en-440x280-v2.png', 'PNG', optimize=True)


def marquee():
    canvas = cover(Image.open(BACKGROUND), (1400, 560)).convert('RGBA')
    draw = ImageDraw.Draw(canvas)
    draw_brand(draw, 74, 54, 26)
    draw.multiline_text((74, 130), 'Find non-followers.\nStay in control.', font=font(58, True), fill=INK, spacing=0)
    draw_wrapped(
        draw,
        'Preview detected accounts, protect people with filters, and unfollow with controlled pacing.',
        (74, 286),
        53,
        font(24),
        MUTED,
        7,
    )

    chip_x = 74
    for chip in ['Preview mode', 'Smart filters', 'Rolling 24h limits']:
        chip_x += draw_chip(draw, chip_x, 406, chip) + 12

    rounded_screenshot(canvas, Image.open(SCREENSHOTS['main']).convert('RGB'), (1024, 38, 300, 484), radius=18)
    canvas.convert('RGB').save(OUT_PROMO / 'x-unfollow-radar-hero-en-1400x560-v2.png', 'PNG', optimize=True)


def main():
    OUT_SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    OUT_PROMO.mkdir(parents=True, exist_ok=True)

    store_visual(
        'main',
        'Preview before\nyou act',
        'Review detected accounts without unfollowing anyone.',
        ['No account changes', 'Separate preview stats'],
        'store-screenshot-main-en-1280x800-v2.png',
    )
    store_visual(
        'filters',
        'Protect the accounts\nthat matter',
        'Whitelist people you want to keep and skip profiles with keyword filters.',
        ['Whitelist', 'Keyword filters'],
        'store-screenshot-filters-en-1280x800-v2.png',
    )
    store_visual(
        'stats',
        'Know exactly\nwhat happened',
        'Review 30-day activity and export your real-action history with Pro.',
        ['30-day chart', 'Pro CSV export'],
        'store-screenshot-stats-en-1280x800-v2.png',
    )
    small_tile()
    marquee()


if __name__ == '__main__':
    main()
