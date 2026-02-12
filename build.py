import json
import os
import shutil

BASE_PATH = "/stop_pay"

def build():
    if os.path.exists('dist'): shutil.rmtree('dist')
    os.makedirs('dist', exist_ok=True)

    # 1. Збираємо всі сервіси в один список для data.json
    all_services = []
    if os.path.exists('services'):
        for s_file in os.listdir('services'):
            if s_file.endswith('.json'):
                with open(f'services/{s_file}', 'r', encoding='utf-8') as f:
                    all_services.append(json.load(f))
    
    # Записуємо зшитий файл у dist
    with open('dist/data.json', 'w', encoding='utf-8') as f:
        json.dump({"services": all_services}, f, ensure_ascii=False)

    # 2. Копіюємо асети та мови
    shutil.copytree('assets', 'dist/assets', dirs_exist_ok=True)
    shutil.copytree('i18n', 'dist/i18n', dirs_exist_ok=True)
    
    # Копіюємо корінні файли
    for rf in ['Logo.png', 'favicon-32x32.png', 'manifest.json']:
        if os.path.exists(rf): shutil.copy(rf, f'dist/{rf}')

    # 3. Генеруємо сторінки через шаблони (як ми робили раніше)
    layout = open('templates/layout.html', 'r', encoding='utf-8').read()
    index_body = open('templates/index_body.html', 'r', encoding='utf-8').read()
    page_tpl = open('templates/page.html', 'r', encoding='utf-8').read()

    languages = [f.replace('.json', '') for f in os.listdir('i18n') if f.endswith('.json')]

    for lang in languages:
        lang_dir = f'dist/{lang}'
        os.makedirs(lang_dir, exist_ok=True)
        
        # Головна
        index_html = layout.replace('{{ content }}', index_body)
        with open(f'{lang_dir}/index.html', 'w', encoding='utf-8') as f:
            f.write(index_html)

        # Сторінки інструкцій
        for s in all_services:
            content_path = f'content/{lang}/{s["id"]}.json'
            if os.path.exists(content_path):
                with open(content_path, 'r', encoding='utf-8') as f_in:
                    c = json.load(f_in)
                
                steps_html = "".join([f"<li>{step}</li>" for step in c['steps']])
                pg = page_tpl.replace('{{ title }}', c['title']) \
                             .replace('{{ description }}', c['description']) \
                             .replace('{{ steps }}', steps_html) \
                             .replace('{{ cancel_url }}', s['official_cancel_url']) \
                             .replace('{{ seo_text }}', c.get('seo_text', ''))
                
                full_pg = layout.replace('{{ content }}', pg)
                s_dir = f'{lang_dir}/{s["id"]}'
                os.makedirs(s_dir, exist_ok=True)
                with open(f'{s_dir}/index.html', 'w', encoding='utf-8') as f_out:
                    f_out.write(full_pg)

    # Редірект у корені
    with open('dist/index.html', 'w', encoding='utf-8') as f:
        f.write(f"<html><script>window.location.href='{BASE_PATH}/ua/'</script></html>")

build()
            
