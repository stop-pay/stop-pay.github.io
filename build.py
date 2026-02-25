import json
import os
import shutil
import re
import subprocess
from datetime import datetime

# Назва твого репозиторію на GitHub
BASE_PATH = "/stop_pay"

def get_git_mtime(filepath):
    """Отримує дату останнього комміту для конкретного файлу через Git"""
    try:
        # Команда отримує дату останнього комміту у форматі ISO
        result = subprocess.check_output(
            ['git', 'log', '-1', '--format=%ai', filepath],
            stderr=subprocess.STDOUT
        ).decode('utf-8').strip()
        
        if result:
            # Парсимо дату (наприклад, 2024-02-22 14:30:00 +0200)
            return datetime.strptime(result[:10], '%Y-%m-%d')
    except Exception:
        pass
    return datetime.now() # Fallback, якщо Git не доступний

def build():
    # 1. Очищення та створення структури
    if os.path.exists('dist'):
        shutil.rmtree('dist')
    os.makedirs('dist', exist_ok=True)

    # 2. АВТО-ПОШУК МОВ
    available_langs = [f.replace('.json', '') for f in os.listdir('i18n') if f.endswith('.json')]
    print(f"Знайдено мови: {available_langs}")

    # 3. ЗБІР СЕРВІСІВ (метадані)
    all_services = []
    if os.path.exists('services'):
        for s_file in os.listdir('services'):
            if s_file.endswith('.json'):
                s_path = os.path.join('services', s_file)
                with open(s_path, 'r', encoding='utf-8') as f:
                    try:
                        service_data = json.load(f)
                        # Отримуємо дату комміту для файлу сервісу
                        service_data['_mtime'] = get_git_mtime(s_path)
                        all_services.append(service_data)
                    except Exception as e:
                        print(f"Помилка у файлі метаданих {s_file}: {e}")

    # 4. СТВОРЕННЯ data.json
    services_for_json = []
    for s in all_services:
        s_copy = s.copy()
        if '_mtime' in s_copy: del s_copy['_mtime']
        services_for_json.append(s_copy)

    with open('dist/data.json', 'w', encoding='utf-8') as f:
        json.dump({
            "available_languages": available_langs,
            "services": services_for_json
        }, f, ensure_ascii=False, indent=2)

    # 5. КОПІЮВАННЯ АСЕТІВ
    if os.path.exists('assets'):
        shutil.copytree('assets', 'dist/assets', dirs_exist_ok=True)
    if os.path.exists('i18n'):
        shutil.copytree('i18n', 'dist/i18n', dirs_exist_ok=True)
    for file in ['Logo.png', 'manifest.json']:
        if os.path.exists(file):
            shutil.copy(file, f'dist/{file}')
    if os.path.exists('assets/favicons/favicon-32x32.png'):
        shutil.copy('assets/favicons/favicon-32x32.png', 'dist/favicon.png')
    
    with open('dist/.nojekyll', 'w') as f: pass

    # 6. ГЕНЕРАЦІЯ HTML СТОРІНОК
    try:
        layout = open('templates/layout.html', 'r', encoding='utf-8').read()
        index_body = open('templates/index_body.html', 'r', encoding='utf-8').read()
        page_tpl = open('templates/page.html', 'r', encoding='utf-8').read()
        
        for lang in available_langs:
            lang_dir = os.path.join('dist', lang)
            os.makedirs(lang_dir, exist_ok=True)
            
            with open(f'i18n/{lang}.json', 'r', encoding='utf-8') as f_lang:
                lang_data = json.load(f_lang)
                ui = lang_data.get('ui', {})
                last_update_label = ui.get('last_update', 'Last update:')

            full_index = layout.replace('{{ content }}', index_body)
            with open(os.path.join(lang_dir, 'index.html'), 'w', encoding='utf-8') as f_out:
                f_out.write(full_index)

            for s in all_services:
                content_path = f'content/{lang}/{s["id"]}.json'
                if os.path.exists(content_path):
                    with open(content_path, 'r', encoding='utf-8') as f_in:
                        c = json.load(f_in)
                    
                    # ПОРІВНЯННЯ ДАТ КОММІТІВ
                    content_mtime = get_git_mtime(content_path)
                    service_mtime = s.get('_mtime', content_mtime)
                    final_date = max(content_mtime, service_mtime).strftime('%d.%m.%Y')
                    
                    price = str(s.get('price_usd', 0))
                    sid = s['id']

                    # --- КРОКИ ---
                    steps_data = c.get('steps', {})
                    steps_html = ""
                    if isinstance(steps_data, dict):
                        for key, data in steps_data.items():
                            step_title = (data.get('title') or "").upper()
                            step_desc = data.get('description') or ""
                            formatted_desc = step_desc.replace('\n', '<br>')
                            if '*' in formatted_desc:
                                items = formatted_desc.split('*')
                                li_items = "".join([f"<li>{it.strip()}</li>" for it in items[1:] if it.strip()])
                                formatted_desc = f"{items[0]}<ul class='steps-list-inner'>{li_items}</ul>"
                            steps_html += f'<div class="instruction-card"><h2 class="step-card-title">{step_title}</h2><div class="step-card-content">{formatted_desc}</div></div>'

                    # --- URL ТА ХІНТИ ---
                    cancel_link = s.get('official_cancel_url') or s.get('official_url', '#')
                    hint_text = lang_data.get('cancel_hint', '') or ""
                    hint_text = hint_text.replace('{{ official_url }}', str(s.get("official_url", "#")))
                    hint_text = hint_text.replace('target="_blank"', f'target="_blank" onclick="handlePriceAdd(\'{price}\', \'{sid}\')"')
                    
                    # --- SEO ТА ДАТА ---
                    seo_content = c.get('seo_text', '') or ""
                    update_html = f'<div style="text-align: center; opacity: 0.5; font-size: 0.8rem; margin-top: 20px;">{last_update_label} {final_date}</div>'
                    seo_html = f'<div class="seo-text">{seo_content}{update_html}</div>'

                    pg = page_tpl.replace('{{ title }}', str(c.get('title') or sid)) \
                                 .replace('{{ price_usd }}', price) \
                                 .replace('{{ service_id }}', sid) \
                                 .replace('{{ description }}', str(c.get('desc') or c.get('description') or "")) \
                                 .replace('{{ steps }}', steps_html) \
                                 .replace('{{ cancel_hint }}', str(hint_text)) \
                                 .replace('{{ btn_cancel_text }}', ui.get('btn_cancel', 'Cancel')) \
                                 .replace('{{ cancel_url }}', str(cancel_link)) \
                                 .replace('{{ seo_text }}', seo_html)
                    
                    pg = re.sub(r'\{% if seo_text %\}.*?\{% endif %}', seo_html, pg, flags=re.DOTALL)

                    full_pg = layout.replace('{{ content }}', pg)
                    s_dir = os.path.join(lang_dir, sid)
                    os.makedirs(s_dir, exist_ok=True)
                    with open(os.path.join(s_dir, 'index.html'), 'w', encoding='utf-8') as f_out:
                        f_out.write(full_pg)
            
    except Exception as e:
        print(f"Помилка генерації HTML: {e}")

    # 7. РЕДІРЕКТ
    with open('dist/index.html', 'w', encoding='utf-8') as f:
        f.write(f'''<!DOCTYPE html><html><head><script>(function(){{var savedLang=localStorage.getItem('user_lang');var root="{BASE_PATH}";if(savedLang&&savedLang!=='ua'){{window.location.replace(root+'/'+savedLang+'/');}}else{{window.location.replace(root+'/ua/');}}}})();</script></head><body></body></html>''')

if __name__ == "__main__":
    build()
                    
