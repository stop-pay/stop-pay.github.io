import json
import os
import shutil
import re

# Назва твого репозиторію на GitHub
BASE_PATH = "/stop_pay"

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
                with open(os.path.join('services', s_file), 'r', encoding='utf-8') as f:
                    try:
                        service_data = json.load(f)
                        sid = service_data['id']
                        
                        aliases = []
                        for lang in available_langs:
                            content_path = f'content/{lang}/{sid}.json'
                            if os.path.exists(content_path):
                                with open(content_path, 'r', encoding='utf-8') as f_c:
                                    try:
                                        c_json = json.load(f_c)
                                        t_name = c_json.get('translated_name', '').strip()
                                        if t_name:
                                            aliases.append(t_name)
                                    except:
                                        continue
                        
                        service_data['search_alias'] = ", ".join(list(set(aliases)))
                        all_services.append(service_data)
                        
                    except Exception as e:
                        print(f"Помилка у файлі метаданих {s_file}: {e}")

    # 4. СТВОРЕННЯ data.json
    with open('dist/data.json', 'w', encoding='utf-8') as f:
        json.dump({
            "available_languages": available_langs,
            "services": all_services
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

            # Рендер головної сторінки мови
            full_index = layout.replace('{{ content }}', index_body)
            with open(os.path.join(lang_dir, 'index.html'), 'w', encoding='utf-8') as f_out:
                f_out.write(full_index)

            # Рендер сторінок сервісів
            for s in all_services:
                content_path = f'content/{lang}/{s["id"]}.json'
                if os.path.exists(content_path):
                    with open(content_path, 'r', encoding='utf-8') as f_in:
                        c = json.load(f_in)
                    
                    price = str(s.get('price_usd', 0))
                    sid = s['id']

                    # --- НОВА ЛОГІКА ОБРОБКИ КРОКІВ (КАРТКИ) ---
                    steps_data = c.get('steps', {})
                    steps_html = ""

                    # Якщо steps - це словник (новий формат)
                    if isinstance(steps_data, dict):
                        for key, data in steps_data.items():
                            step_title = data.get('title', '').upper()
                            step_desc = data.get('description', '')
                            
                            # Форматування тексту
                            formatted_desc = step_desc.replace('\n', '<br>')
                            if '*' in formatted_desc:
                                items = formatted_desc.split('*')
                                main_text = items[0]
                                li_items = "".join([f"<li>{item.strip()}</li>" for item in items[1:] if item.strip()])
                                formatted_desc = f"{main_text}<ul class='steps-list-inner'>{li_items}</ul>"

                            steps_html += f'''
                            <div class="instruction-card">
                                <h2 class="step-card-title">{step_title}</h2>
                                <div class="step-card-content">{formatted_desc}</div>
                            </div>
                            '''
                    # Якщо раптом старий формат (масив) - для зворотної сумісності
                    elif isinstance(steps_data, list):
                        li_items = "".join([f"<li>{step}</li>" for step in steps_data])
                        steps_html = f'<div class="instruction-card"><ul class="steps-list">{li_items}</ul></div>'

                    # --- РЕШТА ОБРОБКИ ---
                    hint_text = lang_data.get('cancel_hint', '')
                    hint_text = hint_text.replace('{{ official_url }}', s["official_url"])
                    hint_text = hint_text.replace('target="_blank"', f'target="_blank" onclick="handlePriceAdd(\'{price}\', \'{sid}\')"')
                    
                    seo_content = c.get('seo_text', '')
                    seo_html = f'<div class="seo-text">{seo_content}</div>' if seo_content else ''

                    pg = page_tpl.replace('{{ title }}', c.get('title', '')) \
                                 .replace('{{ price_usd }}', price) \
                                 .replace('{{ service_id }}', sid) \
                                 .replace('{{ description }}', c.get('desc', c.get('description', ''))) \
                                 .replace('{{ steps }}', steps_html) \
                                 .replace('{{ cancel_hint }}', hint_text) \
                                 .replace('{{ btn_cancel_text }}', lang_data.get('ui', {}).get('btn_cancel', 'Cancel')) \
                                 .replace('{{ cancel_url }}', s['official_cancel_url'])
                    
                    pg = re.sub(r'\{% if seo_text %\}.*?\{% endif %}', seo_html, pg, flags=re.DOTALL)
                    pg = pg.replace('{{ seo_text }}', seo_html)

                    full_pg = layout.replace('{{ content }}', pg)
                    
                    s_dir = os.path.join(lang_dir, s["id"])
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
