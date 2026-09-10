#!/usr/bin/env python3
# VERSI GOOGLE COLAB - LANGSUNG TAMPIL TABEL & GRAFIK
# Fix: Colab arg -f, display Image, format 2.500.000 tanpa ,000
# Buat Bro William di Medan - Win7 -> Colab

import os
import sys
import csv
import math
from datetime import datetime, timedelta
from io import StringIO

# Deteksi Colab
IN_COLAB = 'google.colab' in sys.modules or os.path.exists('/content')

try:
    import requests
except:
    requests = None

import matplotlib
if IN_COLAB:
    matplotlib.use('Agg')
else:
    matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except:
    PIL_AVAILABLE = False

# Untuk Colab display
try:
    from IPython.display import display as colab_display, Image as ColabImage
    COLAB_DISPLAY = True
except:
    COLAB_DISPLAY = False

CSV_URL = 'https://raw.githubusercontent.com/wlmyaps/kurs/main/Data%20Historis%20GAU_IDR.csv'

HEADER_COLORS = [
    ('#1E88E5', '#0D47A1'), ('#66BB6A', '#2E7D32'), ('#FFA726', '#EF6C00'),
    ('#AB47BC', '#6A1B9A'), ('#FF7043', '#BF360C'), ('#FFD54F', '#F9A825'), ('#26A69A', '#00695C'),
]
CELL_COLORS = [
    ('#BBDEFB', '#90CAF9'), ('#C8E6C9', '#A5D6A7'), ('#FFE0B2', '#FFCC80'),
    ('#E1BEE7', '#CE93D8'), ('#FFCCBC', '#FFAB91'), ('#FFF9C4', '#FFF176'), ('#DCEDC8', '#AED581'),
]
CELL_COLORS_EVEN = [
    ('#C9E2FF', '#A8C8FF'), ('#D9EEDB', '#C5E1C5'), ('#FFE8C8', '#FFD9A0'),
    ('#EAD0EF', '#D9B3E0'), ('#FFD9CC', '#FFC2B0'), ('#FFF8D0', '#FFF0A0'), ('#E4EFD5', '#C5D9A0'),
]

def parse_number(s):
    if s is None or s == '':
        return float('nan')
    import re
    cleaned = re.sub(r'[^\d.,\-]', '', str(s).strip())
    if ',' in cleaned:
        cleaned = cleaned.replace('.', '').replace(',', '.')
    else:
        if cleaned.count('.') > 1:
            cleaned = cleaned.replace('.', '')
    try:
        return float(cleaned)
    except:
        return float('nan')

def format_rupiah(val):
    """FIX: 2500000 -> 2.500.000 (bukan 2.5.0.0, tanpa ,000)"""
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return '-'
    try:
        n = int(round(float(val)))
    except:
        return '-'
    s = str(abs(n))
    out = ''
    cnt = 0
    for i in range(len(s)-1, -1, -1):
        out = s[i] + out
        cnt += 1
        if cnt % 3 == 0 and i != 0:
            out = '.' + out
    if n < 0:
        out = '-' + out
    return out

def format_pct(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return '0,00%'
    sign = '▲ ' if val > 0.0001 else ('▼ ' if val < -0.0001 else '')
    return f"{sign}{abs(val):.2f}%".replace('.', ',')

def load_csv():
    print("⏳ Fetch CSV dari GitHub...")
    text = None
    # Coba lokal dulu (untuk offline)
    for lp in ['/content/Data Historis GAU_IDR.csv', 'Data Historis GAU_IDR.csv', '/mnt/data/Data Historis GAU_IDR.csv']:
        if os.path.exists(lp):
            try:
                with open(lp,'r',encoding='utf-8', errors='ignore') as f:
                    text = f.read()
                print(f"✅ Pakai CSV lokal: {lp}")
                break
            except:
                pass

    if text is None and requests:
        try:
            r = requests.get(CSV_URL, timeout=20)
            r.raise_for_status()
            text = r.text
        except Exception as e:
            print(f"⚠️ requests gagal: {e}")

    if text is None:
        try:
            import urllib.request
            with urllib.request.urlopen(CSV_URL, timeout=20) as resp:
                text = resp.read().decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"❌ Gagal fetch CSV: {e}")
            sys.exit(1)

    text = text.replace('\ufeff', '')
    rows = []
    reader = csv.DictReader(StringIO(text))
    headers = reader.fieldnames
    t_key = next((k for k in headers if 'tanggal' in k.lower()), None)
    close_key = next((k for k in headers if 'terakhir' in k.lower() or 'close' in k.lower()), None)
    open_key = next((k for k in headers if 'pembuka' in k.lower() or 'open' in k.lower()), None)
    high_key = next((k for k in headers if 'tertinggi' in k.lower() or 'high' in k.lower()), None)
    low_key = next((k for k in headers if 'terendah' in k.lower() or 'low' in k.lower()), None)

    for r in reader:
        t_val = r.get(t_key, '').strip()
        if not t_val:
            continue
        try:
            dt = datetime.strptime(t_val, '%d/%m/%Y')
        except:
            try:
                dt = datetime.strptime(t_val, '%d-%m-%Y')
            except:
                continue
        close = parse_number(r.get(close_key, ''))
        if math.isnan(close):
            continue
        open_ = parse_number(r.get(open_key, '')) if open_key else float('nan')
        high = parse_number(r.get(high_key, '')) if high_key else float('nan')
        low = parse_number(r.get(low_key, '')) if low_key else float('nan')
        rows.append({
            'Tanggal': t_val,
            'TanggalObj': dt,
            'Terakhir': close,
            'Pembukaan': open_,
            'Tertinggi': high,
            'Terendah': low,
        })

    # Hapus duplikat & sort today dulu
    seen = set()
    uniq = []
    for row in rows:
        if row['Tanggal'] not in seen:
            seen.add(row['Tanggal'])
            uniq.append(row)
    rows = uniq
    rows.sort(key=lambda x: x['TanggalObj'], reverse=True)

    # Hitung selisih
    for i in range(len(rows)):
        curr = rows[i]
        prev = rows[i+1] if i+1 < len(rows) else None
        if prev:
            curr['selisih'] = curr['Terakhir'] - prev['Terakhir']
            curr['perubahan'] = (curr['selisih'] / prev['Terakhir'] * 100) if prev['Terakhir'] != 0 else 0
            curr['prevTerakhir'] = prev['Terakhir']
        else:
            curr['selisih'] = 0
            curr['perubahan'] = 0
            curr['prevTerakhir'] = None

    print(f"✅ CSV loaded {len(rows)} baris, today dulu: {rows[0]['Tanggal']} -> {rows[-1]['Tanggal']}")
    return rows

def filter_periode(rows, periode='30'):
    # Fix untuk Colab: sys.argv ada -f, abaikan arg yang diawali -
    if isinstance(periode, str) and periode.startswith('-'):
        periode = '30'
    if not rows:
        return []
    last_date = rows[0]['TanggalObj']
    if periode == 'max':
        start = datetime.min
    else:
        try:
            days = int(periode)
            start = last_date - timedelta(days=days)
        except:
            start = datetime.min
    filtered = [r for r in rows if r['TanggalObj'] >= start]
    return filtered

def draw_table_image(rows, filename='tabel_gau_idr_heatmap3D.png', max_rows=40):
    display_rows = rows[:max_rows]
    col_names = ['Tanggal', 'Close', 'Open', 'High', 'Low', 'Perubahan (%)', 'Selisih Harga']
    col_widths = [110, 110, 100, 100, 100, 110, 115]
    row_height = 28
    header_height = 38
    table_width = sum(col_widths)
    table_height = header_height + len(display_rows) * row_height
    shadow_pad = 20
    img_w = table_width + shadow_pad*2 + 12
    img_h = table_height + shadow_pad*2 + 12

    if not PIL_AVAILABLE:
        return draw_table_matplotlib(rows, filename, max_rows)

    img = Image.new('RGB', (img_w, img_h), color='#e0eafc')
    draw = ImageDraw.Draw(img)
    draw.rectangle([shadow_pad-2, shadow_pad-2, shadow_pad+table_width+12+2, shadow_pad+table_height+12+2], fill='#a0a0a0')
    draw.rectangle([shadow_pad, shadow_pad, shadow_pad+table_width+12, shadow_pad+table_height+12], fill='white', outline='#cccccc', width=1)
    x0, y0 = shadow_pad+6, shadow_pad+6
    draw.rectangle([x0-2, y0-2, x0+table_width+2, y0+table_height+2], outline='#0D47A1', width=2)

    try:
        font_header = ImageFont.truetype("arialbd.ttf", 11)
        font_cell = ImageFont.truetype("arial.ttf", 10)
        font_bold = ImageFont.truetype("arialbd.ttf", 10)
    except:
        font_header = ImageFont.load_default()
        font_cell = ImageFont.load_default()
        font_bold = ImageFont.load_default()

    x = x0
    for i, name in enumerate(col_names):
        dark = HEADER_COLORS[i][1]
        draw.rectangle([x, y0, x+col_widths[i], y0+header_height], fill=dark, outline='#1a2a4a', width=1)
        try:
            text_w = draw.textlength(name, font=font_header)
        except:
            text_w = len(name)*6
        tx = x + (col_widths[i] - text_w)//2
        ty = y0 + (header_height - 12)//2
        draw.text((tx, ty), name, fill='white', font=font_header)
        x += col_widths[i]

    max_abs_pct = max([abs(r['perubahan']) for r in display_rows], default=1) or 1

    y = y0 + header_height
    for idx, row in enumerate(display_rows):
        x = x0
        is_even = idx % 2 == 1
        pct = row['perubahan']
        sel = row['selisih']

        if pct > 0.0001:
            close_bg = '#A5D6A7' if not is_even else '#C5E1C5'
            sym = '↑'
        elif pct < -0.0001:
            close_bg = '#EF9A9A' if not is_even else '#FFCCBC'
            sym = '↓'
        else:
            close_bg = '#FFF176'
            sym = '↔'

        for col_idx in range(len(col_names)):
            if col_idx == 0:
                bg = CELL_COLORS_EVEN[col_idx][1] if is_even else CELL_COLORS[col_idx][1]
            elif col_idx == 1:
                bg = close_bg
            elif col_idx == 5:
                t = min(1, abs(pct)/max_abs_pct) if max_abs_pct else 0
                if pct > 0.0001:
                    bg = '#A5D6A7' if t<0.5 else '#66BB6A'
                elif pct < -0.0001:
                    bg = '#EF9A9A' if t<0.5 else '#E57373'
                else:
                    bg = '#FFF176'
            elif col_idx == 6:
                if sel > 0.0001:
                    bg = '#AED581'
                elif sel < -0.0001:
                    bg = '#FFAB91'
                else:
                    bg = '#B2DFDB'
            else:
                bg = CELL_COLORS_EVEN[col_idx][1] if is_even else CELL_COLORS[col_idx][1]

            draw.rectangle([x, y, x+col_widths[col_idx], y+row_height], fill=bg, outline='#5a6b8a', width=1)

            if col_idx == 0:
                txt = row['Tanggal']
                draw.text((x+6, y+7), txt, fill='#0D1B2A', font=font_cell)
            elif col_idx == 1:
                txt = f"{format_rupiah(row['Terakhir'])} {sym}"
                try:
                    tw = draw.textlength(txt, font=font_bold)
                except:
                    tw = len(txt)*6
                draw.text((x+col_widths[col_idx]-tw-6, y+7), txt, fill='#0D1B2A', font=font_bold)
            elif col_idx == 2:
                txt = format_rupiah(row['Pembukaan'])
                try:
                    tw = draw.textlength(txt, font=font_cell)
                except:
                    tw = len(txt)*6
                draw.text((x+col_widths[col_idx]-tw-6, y+7), txt, fill='#212121', font=font_cell)
            elif col_idx == 3:
                txt = format_rupiah(row['Tertinggi'])
                try:
                    tw = draw.textlength(txt, font=font_cell)
                except:
                    tw = len(txt)*6
                draw.text((x+col_widths[col_idx]-tw-6, y+7), txt, fill='#212121', font=font_cell)
            elif col_idx == 4:
                txt = format_rupiah(row['Terendah'])
                try:
                    tw = draw.textlength(txt, font=font_cell)
                except:
                    tw = len(txt)*6
                draw.text((x+col_widths[col_idx]-tw-6, y+7), txt, fill='#212121', font=font_cell)
            elif col_idx == 5:
                txt = format_pct(pct)
                try:
                    tw = draw.textlength(txt, font=font_bold)
                except:
                    tw = len(txt)*6
                draw.text((x+col_widths[col_idx]-tw-6, y+7), txt, fill='#212121', font=font_bold)
            elif col_idx == 6:
                s = '▲ ' if sel>0 else ('▼ ' if sel<0 else '')
                txt = s + format_rupiah(sel)
                try:
                    tw = draw.textlength(txt, font=font_bold)
                except:
                    tw = len(txt)*6
                draw.text((x+col_widths[col_idx]-tw-6, y+7), txt, fill='#212121', font=font_bold)

            x += col_widths[col_idx]
        y += row_height

    img.save(filename)
    print(f"✅ Tabel heatmap disimpan: {filename}")

    # TAMPILKAN DI COLAB
    if COLAB_DISPLAY:
        try:
            colab_display(ColabImage(filename=filename))
        except:
            pass

    return filename

def draw_line_chart(rows, filename='grafik_gau_idr_close.png'):
    if not rows:
        return None
    sorted_rows = sorted(rows, key=lambda x: x['TanggalObj'])
    dates = [r['TanggalObj'] for r in sorted_rows]
    closes = [r['Terakhir'] for r in sorted_rows]
    selisihs = [r['selisih'] for r in sorted_rows]
    x_labels = [r['Tanggal'] for r in sorted_rows]

    fig, ax = plt.subplots(figsize=(14, 6), dpi=150)
    fig.patch.set_facecolor('#e3f2fd')
    ax.set_facecolor('white')
    ax.grid(True, which='both', color='#e0e0e0', linewidth=0.5, linestyle='--', alpha=0.6)

    ax.plot(dates, closes, color='#1E88E5', linewidth=2.8, zorder=2)
    ax.fill_between(dates, closes, min(closes)*0.995, color='#90CAF9', alpha=0.25, zorder=1)

    for i, (d, c, s) in enumerate(zip(dates, closes, selisihs)):
        if i == 0:
            color = '#F9A825'
        else:
            if s > 0.0001:
                color = '#16a34a'  # Hijau naik
            elif s < -0.0001:
                color = '#dc2626'  # Merah turun
            else:
                color = '#ca8a04'
        ax.scatter(d, c, s=110, c=color, edgecolors='white', linewidths=1.8, zorder=4)
        ax.scatter(d, c, s=28, c='white', zorder=5)

    min_close = min(closes)
    max_close = max(closes)
    ax.set_title(f"GAU/IDR Close: {format_rupiah(min_close)} -> {format_rupiah(max_close)} ({len(closes)} data) - Hijau naik, Merah turun",
                 fontsize=12, fontweight='bold', color='#0D47A1', pad=12)

    ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, _: format_rupiah(x)))
    step = max(1, len(dates)//14)
    ax.set_xticks(dates[::step])
    ax.set_xticklabels([x_labels[i] for i in range(0, len(x_labels), step)], rotation=0, fontsize=9, color='#0D47A1', fontweight='bold')

    ax.text(0.5, -0.18, f"Grafik {len(closes)} titik • Min {format_rupiah(min_close)} - Max {format_rupiah(max_close)} • Titik hijau naik, merah turun",
            transform=ax.transAxes, ha='center', fontsize=9, color='#546e7a', fontweight='600')

    plt.tight_layout()
    plt.savefig(filename, dpi=200, bbox_inches='tight', facecolor=fig.get_facecolor())
    plt.close()
    print(f"✅ Grafik line disimpan: {filename}")

    if COLAB_DISPLAY:
        try:
            colab_display(ColabImage(filename=filename))
        except:
            pass

    return filename

def main():
    print("=== 📊 GAU/IDR Python COLAB - Tabel Warna + Grafik Titik Hijau/Merah ===")
    rows = load_csv()

    # FIX: Argumen Colab ada -f dan path json, jadi hanya terima angka atau 'max'
    periode = '30'
    for arg in sys.argv[1:]:
        if arg.lower() == 'max' or arg.isdigit():
            periode = arg
            break

    filtered = filter_periode(rows, periode)
    print(f"📅 Periode {periode} hari: {len(filtered)} baris (dari {len(rows)} total)")

    # Batasi tabel max 50 baris biar tidak terlalu panjang di Colab
    tabel_file = f"tabel_gau_idr_{periode}hari_heatmap3D.png"
    draw_table_image(filtered, tabel_file, max_rows=50)

    grafik_file = f"grafik_gau_idr_{periode}hari_close.png"
    draw_line_chart(filtered, grafik_file)

    # Gabungan
    if PIL_AVAILABLE:
        try:
            from PIL import Image
            tabel_img = Image.open(tabel_file)
            grafik_img = Image.open(grafik_file)
            gap = 24
            final_w = max(tabel_img.width, grafik_img.width)
            final_h = tabel_img.height + gap + grafik_img.height
            combined = Image.new('RGB', (final_w, final_h), color='#e0eafc')
            combined.paste(tabel_img, ((final_w - tabel_img.width)//2, 0))
            combined.paste(grafik_img, ((final_w - grafik_img.width)//2, tabel_img.height + gap))
            combined_file = f"gabungan_gau_idr_{periode}hari_fit.png"
            combined.save(combined_file)
            print(f"✅ Gabungan disimpan: {combined_file}")
            if COLAB_DISPLAY:
                try:
                    colab_display(ColabImage(filename=combined_file))
                except:
                    pass
        except Exception as e:
            print(f"⚠️ Gabungan gagal: {e}")

    print("\n=== SELESAI - Format 2.500.000 (tanpa ,000) FIXED ===")

if __name__ == '__main__':
    main()
