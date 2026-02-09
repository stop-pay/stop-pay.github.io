import os
import os
import json
import google.generativeai as genai
import sys

def add_service():
    # Налаштування Gemini
    genai.configure(api_key=os.environ["GEMINI_KEY"])
    model = genai.GenerativeModel('gemini-2.0-flash')

    # Отримуємо назву з заголовка Issue
    issue_title = os.environ.get("ISSUE_TITLE", "")
    service_name = issue_title.replace("Add Service:", "").strip()

    if not service_name:
        return

    # Читаємо базу
    with open('data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Перевірка на дублікат
    if any(s['name'].lower() == service_name.lower() for s in data['services']):
        print("Сервіс вже є!")
        return

    # Промпт для ШІ
    prompt = f"""
    Ти — спеціаліст із наповнення бази даних сервісів StopPay. Твоє завдання: отримати назву сервісу та повернути JSON-об'єкт.

    id: латиниця, нижній регістр, без пробілів.
    
    category: вибери з ['tv', 'phone', 'other'].
    
    price: середня ціна підписки в USD (число).
    
    url: ПРЯМЕ посилання на сторінку скасування підписки.
    
    img: пряме посилання на логотип (SVG або PNG на прозорому фоні).
    
    type: 'UA', якщо сервіс локальний для України, інакше 'global'. Поверни ТІЛЬКИ чистий JSON."
     
    Find subscription cancellation info for '{service_name}'.
    Return ONLY a JSON object:
    {{
      "id": "lowercase_name",
      "name": "Official Name",
      "category": "tv, phone, or other",
      "price": 0.00,
      "url": "direct_link_to_unsubscribe",
      "img": "url_to_logo_svg_or_png",
      "type": "UA or global"
    }}
    """
    
    response = model.generate_content(prompt)
    try:
        new_service = json.loads(response.text.replace('```json', '').replace('```', '').strip())
        data['services'].append(new_service)
        
        with open('data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Успішно додано: {new_service['name']}")
    except:
        print("Помилка обробки ШІ")

if __name__ == "__main__":
    add_service()
