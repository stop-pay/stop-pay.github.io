import json
import os
import shutil
import re
import subprocess
from datetime import datetime

# Назва твого репозиторію на GitHub
BASE_PATH = ""

def get_git_mtime(filepath):
    """Отримує дату останнього комміту для конкретного файлу через Git"""
    try:
        result = subprocess.check_output(
            ['git', 'log', '-1', '--format=%ai', filepath],
            stderr=subprocess.STDOUT
        ).decode('utf-8').strip()
        if result:
            return datetime.strptime(result[:10], '%Y-%m-%d')
    except Exception:
        pass
    return datetime.now()

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
        json.dump({"available_languages": available_langs, "services": services_for_json}, f, ensure_ascii=False, indent=2)

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
                info_text = ui.get('last_update_info', '')
                date_label = ui.get('last_update', 'Last update:')

            full_index = layout.replace('{{ content }}', index_body)
            with open(os.path.join(lang_dir, 'index.html'), 'w', encoding='utf-8') as f_out:
                f_out.write(full_index)

            for s in all_services:
                content_path = f'content/{lang}/{s["id"]}.json'
                if os.path.exists(content_path):
                    with open(content_path, 'r', encoding='utf-8') as f_in:
                        c = json.load(f_in)
                    
                    # Дата комміта
                    content_mtime = get_git_mtime(content_path)
                    service_mtime = s.get('_mtime', content_mtime)
                    final_date = max(content_mtime, service_mtime).strftime('%d.%m.%Y')
                    
                    price = str(s.get('price_usd', 0))
                    sid = s['id']

                    # Формування кроків (як раніше)
                    steps_data = c.get('steps', {})
                    steps_html = ""
                    if isinstance(steps_data, dict):
                        for key, data in steps_data.items():
                            t = (data.get('title') or "").upper()
                            d = data.get('description', '').replace('\n', '<br>')
                            if '*' in d:
                                parts = d.split('*')
                                li = "".join([f"<li>{p.strip()}</li>" for p in parts[1:] if p.strip()])
                                d = f"{parts[0]}<ul class='steps-list-inner'>{li}</ul>"
                            steps_html += f'<div class="instruction-card"><h2 class="step-card-title">{t}</h2><div class="step-card-content">{d}</div></div>'

                    # URL та Хінти
                    cancel_link = s.get('official_cancel_url') or s.get('official_url', '#')
                    hint = (lang_data.get('cancel_hint', '') or "").replace('{{ official_url }}', str(s.get("official_url", "#")))
                    hint = hint.replace('target="_blank"', f'target="_blank" onclick="handlePriceAdd(\'{price}\', \'{sid}\')"')
                    
                    # СТВОРЕННЯ НОВОГО БЛОКУ ІНФОРМАЦІЇ (Замість SEO)
                    info_block_html = f'''
                    <div class="seo-text" style="text-align: center; margin-top: 40px; border-top: 1px solid var(--border); padding-top: 20px;">
                        <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text); opacity: 0.9;">{info_text}</p>
                        <div style="opacity: 0.5; font-size: 0.8rem; margin-top: 15px;">{date_label} {final_date}</div>
                    </div>
                    '''

                    pg = page_tpl.replace('{{ title }}', str(c.get('title') or sid)) \
                                 .replace('{{ price_usd }}', price) \
                                 .replace('{{ service_id }}', sid) \
                                 .replace('{{ description }}', str(c.get('desc') or c.get('description') or "")) \
                                 .replace('{{ steps }}', steps_html) \
                                 .replace('{{ cancel_hint }}', str(hint)) \
                                 .replace('{{ btn_cancel_text }}', ui.get('btn_cancel', 'Cancel')) \
                                 .replace('{{ cancel_url }}', str(cancel_link)) \
                                 .replace('{{ seo_text }}', info_block_html) # Підставляємо наш новий блок
                    
                    # Видаляємо старі Jinja-теги, якщо вони залишилися в шаблоні
                    pg = re.sub(r'\{% if seo_text %\}.*?\{% endif %}', info_block_html, pg, flags=re.DOTALL)

                    full_pg = layout.replace('{{ content }}', pg)
                    s_dir = os.path.join(lang_dir, sid)
                    os.makedirs(s_dir, exist_ok=True)
                    with open(os.path.join(s_dir, 'index.html'), 'w', encoding='utf-8') as f_out:
                        f_out.write(full_pg)
            
    except Exception as e:
        print(f"Помилка: {e}")

    # 7. РЕДІРЕКТ
    with open('dist/index.html', 'w', encoding='utf-8') as f:
        f.write(f'''<!DOCTYPE html><html><head><script>(function(){{var savedLang=localStorage.getItem('user_lang');var root="{BASE_PATH}";if(savedLang&&savedLang!=='ua'){{window.location.replace(root+'/'+savedLang+'/');}}else{{window.location.replace(root+'/ua/');}}}})();</script></head><body></body></html>''')

if __name__ == "__main__":
    build()
        
