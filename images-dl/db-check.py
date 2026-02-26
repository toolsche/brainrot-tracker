import json
import os

# Pfade definieren
image_folder = r'D:\develop\brainrot-discord-app\images-dl\brainrot_images'
json_path = r'D:\develop\brainrot-discord-app\src\data\brainrot_db.json'

def check_missing_json_entries():
    # 1. JSON laden und Keys extrahieren
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            db = json.load(f)
            json_keys = set(db.keys())
    except FileNotFoundError:
        print("Fehler: JSON Datei nicht gefunden.")
        return

    # 2. Bilder im Ordner scannen
    missing_in_json = []
    
    if not os.path.exists(image_folder):
        print("Fehler: Bildverzeichnis nicht gefunden.")
        return

    for filename in os.listdir(image_folder):
        # Nur Bilddateien prüfen (z.B. .png, .webp, .jpg)
        if filename.lower().endswith(('.png', '.webp', '.jpg', '.jpeg')):
            name_without_ext = os.path.splitext(filename)[0]
            
            # Prüfen, ob der Bildname (ohne Endung) ein Key in der JSON ist
            if name_without_ext not in json_keys:
                missing_in_json.append(filename)

    # 3. Ergebnis ausgeben
    print("--- Analyse: Fehlende JSON-Einträge ---")
    if missing_in_json:
        print(f"Gefundene Bilder ({len(missing_in_json)}), die NICHT in der JSON stehen:\n")
        for file in sorted(missing_in_json):
            print(f" ❌ {file}")
        print("\nDiese Namen müssen als Key in die brainrot_db.json aufgenommen werden.")
    else:
        print("✅ Sauber! Alle Bilder im Ordner sind bereits in der JSON definiert.")

if __name__ == "__main__":
    check_missing_json_entries()