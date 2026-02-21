import os
from PIL import Image
import cairosvg
import io

# Налаштування
SOURCE_DIR = 'images'
DEST_DIR = 'assets/icons'
SIZE = (128, 128)

def process_icons():
    if not os.path.exists(DEST_DIR):
        os.makedirs(DEST_DIR)
        print(f"Створено папку: {DEST_DIR}")

    for filename in os.listdir(SOURCE_DIR):
        file_lower = filename.lower()
        if file_lower.endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg')):
            img_path = os.path.join(SOURCE_DIR, filename) # Шлях винесено сюди для доступу всюди
            try:
                # Спеціальна обробка для SVG
                if file_lower.endswith('.svg'):
                    out = cairosvg.svg2png(url=img_path, output_width=SIZE[0], output_height=SIZE[1])
                    img = Image.open(io.BytesIO(out)).convert("RGBA")
                else:
                    img = Image.open(img_path).convert("RGBA")

                # Робимо картинку квадратною без спотворень
                img.thumbnail(SIZE, Image.Resampling.LANCZOS)
                
                # Створюємо прозоре полотно 128x128
                new_img = Image.new("RGBA", SIZE, (0, 0, 0, 0))
                upper_left = (
                    (SIZE[0] - img.size[0]) // 2,
                    (SIZE[1] - img.size[1]) // 2
                )
                new_img.paste(img, upper_left)

                base_name = os.path.splitext(filename)[0]
                save_path = os.path.join(DEST_DIR, f"{base_name}.png")
                
                # Зберігаємо файл
                new_img.save(save_path, "PNG", optimize=True)
                
                # ВАЖЛИВО: Закриваємо зображення перед видаленням (для стабільності на Windows)
                img.close()
                new_img.close()
                
                # Видаляємо оригінал
                os.remove(img_path)
                
                print(f"✅ Оброблено та видалено оригінал: {filename} -> {base_name}.png")
            except Exception as e:
                print(f"❌ Помилка при обробці {filename}: {e}")

if __name__ == "__main__":
    if os.path.exists(SOURCE_DIR):
        process_icons()
    else:
        print(f"Папка {SOURCE_DIR} не знайдена!")
                
