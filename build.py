import json
import os
import shutil

BASE_PATH = "/stop_pay"

def load_template(template_name):
    path = f'templates/{template_name}'
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def build():
    if os.path.exists('dist'): shutil.rmtree('dist')
    os.makedirs('dist', exist_ok=True)

    if os.path.exists('assets'):
        shutil.copytree('assets', 'dist/assets', dirs_exist_ok=True)
    
    root_files = ['manifest.json', 'favicon-32x32.png', 'apple-touch-icon.png', 'Logo.png', 'data.json']
    for rf in root_files:
        if os.path.exists(rf): shutil.copy(rf, f'dist/{rf}')

    with open('data.json', 'r', encoding='utf-8') as f:
        site_data = json.load(f)

    languages = [lang.lower() for lang in site_data['languages'].keys()]
    layout = load_template('layout.html')

    for lang in languages:
        lang_dir = f'dist/{lang}'
        os.makedirs(lang_dir, exist_ok=True)
        
        # Головна сторінка
        main_content = '<div id="siteContent"></div>' 
        index_html = layout.replace('{{ content }}', main_content)
        
        # ВАЖЛИВО: Заміна робиться ТІЛЬКИ якщо шлях починається з /assets або /Logo
        index_html = index_html.replace('href="/assets', f'href="{BASE_PATH}/assets')
        index_html = index_html.replace('src="/assets', f'src="{BASE_PATH}/assets')
        index_html = index_html.replace('src="/Logo.png', f'src="{BASE_PATH}/Logo.png')

        with open(f'{lang_dir}/index.html', 'w', encoding='utf-8') as f:
            f.write(index_html)

        # Сторінки сервісів
        if os.path.exists('services'):
            for s_file in os.listdir('services'):
                if not s_file.endswith('.json'): continue
                
                content_path = f'content/{lang}/{s_file}'
                if os.path.exists(content_path):
                    with open(content_path, 'r', encoding='utf-8') as f_in:
                        c = json.load(f_in)
                    
                    # Формуємо HTML інструкції
                    steps_html = "".join([f"<li>{step}</li>" for step in c['steps']])
                    service_html = f"""
                    <div class="service-container">
                        <h2>{c['title']}</h2>
                        <p>{c['description']}</p>
                        <div class="instruction-card">
                            <ol class="steps-list">{steps_html}</ol>
                        </div>
                        <div class="seo-block">{c['seo_text']}</div>
                    </div>
                    """
                    full_p = layout.replace('{{ content }}', service_html)
                    # Ті ж самі виправлення шляхів
                    full_p = full_p.replace('href="/assets', f'href="{BASE_PATH}/assets')
                    full_p = full_p.replace('src="/assets', f'src="{BASE_PATH}/assets')
                    full_p = full_p.replace('src="/Logo.png', f'src="{BASE_PATH}/Logo.png')
                    
                    s_id = s_file.replace('.json', '')
                    s_dir = f'dist/{lang}/{s_id}'
                    os.makedirs(s_dir, exist_ok=True)
                    with open(f'{s_dir}/index.html', 'w', encoding='utf-8') as f_out:
                        f_out.write(full_p)

    # Головний редірект
    with open('dist/index.html', 'w', encoding='utf-8') as f:
        f.write(f"<html><script>window.location.href='{BASE_PATH}/ua/'</script></html>")

build()
print("✅ Успішно зібрано!")
