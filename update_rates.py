import json
import urllib.request

def update_rates():
    # 1. Отримуємо актуальні курси (база USD)
    url = "https://open.er-api.com/v6/latest/USD"
    try:
        with urllib.request.urlopen(url) as response:
            rates_data = json.loads(response.read())
            rates = rates_data.get("rates", {})
    except Exception as e:
        print(f"Помилка API: {e}")
        return

    # 2. Читаємо твій файл
    try:
        with open('data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Помилка читання файлу: {e}")
        return

    updated = False
    
    # 3. Йдемо по мовах
    for lang_id, lang_data in data['languages'].items():
        code = lang_data.get('currency_code')
        
        if code and code in rates:
            new_rate = round(rates[code], 2)
            
            # Оновлюємо тільки якщо курс змінився
            if lang_data.get('exchange_rate') != new_rate:
                print(f"Оновлення {lang_id} ({code}): {lang_data.get('exchange_rate')} -> {new_rate}")
                lang_data['exchange_rate'] = new_rate
                updated = True
        else:
            print(f"Пропущено {lang_id}: код '{code}' не знайдено в API")

    # 4. Зберігаємо, якщо були зміни
    if updated:
        with open('data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("data.json успішно оновлено!")
    else:
        print("Курси не змінилися.")

if __name__ == "__main__":
    update_rates()
