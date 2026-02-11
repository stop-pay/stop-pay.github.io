import json
import os

def migrate():
    # Шлях до твого поточного файлу
    source_file = 'data.json'
    
    if not os.path.exists(source_file):
        print("Файл data.json не знайдено!")
        return

    with open(source_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Створюємо структуру папок
    os.makedirs('services', exist_ok=True)
    for lang in data['languages'].keys():
        os.makedirs(f'content/{lang.lower()}', exist_ok=True)

    # 1. Мігруємо сервіси
    for service in data['services']:
        s_id = service['id']
        
        # Створюємо метадані сервісу (services/{id}.json)
        service_meta = {
            "id": s_id,
            "name": service['name'],
            "category": service['category'],
            "official_url": "", # Поки порожньо, заповнимо потім
            "official_cancel_url": service['url'],
            "icon": service['img']
        }
        
        with open(f'services/{s_id}.json', 'w', encoding='utf-8') as f:
            json.dump(service_meta, f, indent=2, ensure_ascii=False)

        # 2. Створюємо базовий контент для кожної мови (content/{lang}/{id}.json)
        # Оскільки в старому data.json не було покрокових інструкцій, 
        # ми створимо "заглушки", які потім замінить AI.
        for lang_code in data['languages'].keys():
            lang_lower = lang_code.lower()
            
            # Спроба зробити базовий текст залежно від мови
            title = f"Як скасувати підписку {service['name']}" if lang_code == "UA" else f"How to cancel {service['name']}"
            
            content_data = {
                "title": title,
                "description": f"Покрокова інструкція для сервісу {service['name']}",
                "steps": [
                    f"Перейдіть за прямим посиланням: {service['url']}",
                    "Увійдіть у свій профіль",
                    "Знайдіть розділ керування підпискою",
                    "Натисніть кнопку скасування"
                ],
                "seo_text": f"Тут ви знайдете детальну інформацію про те, як зупинити списання коштів з {service['name']}."
            }
            
            with open(f'content/{lang_lower}/{s_id}.json', 'w', encoding='utf-8') as f:
                json.dump(content_data, f, indent=2, ensure_ascii=False)

    print("✅ Міграція завершена! Папки services/ та content/ створені.")

if __name__ == "__main__":
    migrate()
          
