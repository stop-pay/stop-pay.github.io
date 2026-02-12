import json
import os
import shutil

BASE_PATH = "/stop_pay"

def load_template(template_name):
    path = f'templates/{template_name}'
    if not os.path.exists(path):
        print(f"⚠️ Попередження: Шаблон {path} не знайдено!")
        return "{{ content }}"
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def fix_paths(html):
    """Функція для масової заміни відносних шляхів на абсолютні з BASE_PATH"""
    html = html.replace('href="/stop_pay', 'href="TEMP_BP') # Захист від подвійної заміни
    html = html.replace('src="/stop_pay', 'src="TEMP_BP')
    
    html = html.replace('href="/', f'href="{BASE_PATH}/')
    html = html.replace('src="/', f'src="{BASE_PATH}/')
    
    html = html.replace('TEMP_BP', f'{BASE_PATH}')
    return html

def build():
    print("🚀 Початок збирання...")
    if os.path.exists('dist'): shutil.rmtree('dist')
    os.makedirs('dist', exist_ok=True)

    # 1. Копіюємо асети та мовні файли
    for folder in ['assets', 'i18n']:
        if os.path.exists(folder):
            shutil.copytree(folder, f'dist/{folder}', dirs_exist_ok=True)
    
    # Копіюємо корінні файли
    root_files = ['manifest.json', 'favicon-32x32.png', 'apple-touch-icon.png', 'Logo.png', 'data.json']
    for rf in root_files:
        if os.path.exists(rf): shutil.copy(rf, f'dist/{rf}')

    # 2. Визначаємо мови (країни)
    languages = [f.replace('.json', '').lower() for f in os.listdir('i18n') if f.endswith('.json')]
    if not languages: languages = ['ua']

    # Завантажуємо шаблони
    layout = load_template('layout.html')
    index_body_tpl = load_template('index_body.html')
    page_tpl = load_template('page.html')

    for lang in languages:
        print(f"📦 Обробка країни: {lang.upper()}")
        lang_dir = f'dist/{lang}'
        os.makedirs(lang_dir, exist_ok=True)
        
        # --- ГЕНЕРУЄМО ГОЛОВНУ СТОРІНКУ ---
        index_html = layout.replace('{{ content }}', index_body_tpl)
        index_html = fix_paths(index_html)
        
        with open(f'{lang_dir}/index.html', 'w', encoding='utf-8') as f:
            f.write(index_html)

        # --- ГЕНЕРУЄМО СТОРІНКИ СЕРВІСІВ ---
        if os.path.exists('services'):
            for s_file in os.listdir('services'):
                if not s_file.endswith('.json'): continue
                
                s_id = s_file.replace('.json', '')
                content_path = f'content/{lang}/{s_file}'
                
                if os.path.exists(content_path):
                    with open(content_path, 'r', encoding='utf-8') as f_in:
                        c = json.load(f_in)
                    
                    # Завантажуємо дані самого сервісу (посилання на скасування)
                    with open(f'services/{s_file}', 'r', encoding='utf-8') as f_serv:
                        s_data = json.load(f_serv)

                    # Формуємо список кроків
                    steps_html = "".join([f"<li>{step}</li>" for step in c.get('steps', [])])
                    
                    # Заповнюємо шаблон сторінки інструкції
                    content_html = page_tpl
                    content_html = content_html.replace('{{ title }}', c.get('title', s_data.get('name', '')))
                    content_html = content_html.replace('{{ description }}', c.get('description', ''))
                    content_html = content_html.replace('{{ steps }}', steps_html)
                    content_html = content_html.replace('{{ seo_text }}', c.get('seo_text', ''))
                    content_html = content_html.replace('{{ cancel_url }}', s_data.get('official_cancel_url', '#'))
                    
                    # Вставляємо в layout
                    full_page = layout.replace('{{ content }}', content_html)
                    full_page = fix_paths(full_page)
                    
                    s_dir = f'{lang_dir}/{s_id}'
                    os.makedirs(s_dir, exist_ok=True)
                    with open(f'{s_dir}/index.html', 'w', encoding='utf-8') as f_out:
                        f_out.write(full_page)

    # 3. Головний редірект
    with open('dist/index.html', 'w', encoding='utf-8') as f:
        f.write(f"<html><script>window.location.href='{BASE_PATH}/ua/'</script></html>")

    print(f"✅ Успішно зібрано! Перевір папку /dist/")

if __name__ == "__main__":
    build()
            
